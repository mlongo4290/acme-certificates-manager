import crypto from 'crypto';
import { Request, Response } from 'express';
import passport from 'passport';
import { generateToken } from '../middleware/auth';
import { AuthProvider } from '../models/AuthProvider';
import { Role } from '../models/Role';
import { MfaTrustedDevice } from '../models/MfaTrustedDevice';
import { User } from '../models/User';
import { ActivityLogService } from '../services/activityLog.service';
import { emailService } from '../services/email.service';
import { Logger } from '../services/logger.service';

export { verifyMfaLogin } from './authController_mfa';

const logger = new Logger('AuthController');

/**
 * Load role permissions for a user and build the full token payload.
 * Returns { isAdmin, permissions }.
 */
export const buildRolePermissions = async (user: any): Promise<{ isAdmin: boolean; permissions?: Record<string, string> }> => {
    if (!user.role) return { isAdmin: false };

    try {
        const role = await Role.findById(user.role);
        if (!role) return { isAdmin: false };

        if ((role as any).isAdmin) return { isAdmin: true };

        const permsObj = (role as any).permissions;
        if (!permsObj) return { isAdmin: false };

        const raw = permsObj.toObject ? permsObj.toObject() : permsObj;
        const permissions: Record<string, string> = {};
        for (const key of Object.keys(raw)) {
            permissions[key] = raw[key];
        }
        return { isAdmin: false, permissions };
    } catch {
        return { isAdmin: false };
    }
};

const authenticateUser = (strategyName: string, req: Request): Promise<any> => {
    return new Promise((resolve, reject) => {
        passport.authenticate(strategyName, (err: any, user: any, info: any) => {
            if (err) {
                reject(err);
            } else if (!user) {
                reject({ status: 401, message: info?.message || 'LOGIN_FAILED' });
            } else {
                resolve(user);
            }
        })(req);
    });
};

export const login = async (req: Request, res: Response) => {
    const { username, password, deviceId } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'USERNAME_AND_PASSWORD_REQUIRED' });
        return;
    }

    try {
        // Get all enabled direct providers (local, ldap) sorted by priority
        const directProviders = await AuthProvider.find({
            enabled: true,
            type: { $in: ['local', 'ldap'] }
        }).sort({ priority: 1 });

        if (directProviders.length === 0) {
            res.status(500).json({ message: 'No authentication providers configured' });
            return;
        }

        let lastError: any = null;

        // Try each provider in sequence
        for (const provider of directProviders) {
            try {
                const strategyName = provider.type === 'local' ? 'local' : `${provider.type}-${provider.name}`;

                logger.debug(`Trying authentication with provider: ${provider.name} (${provider.type})`);

                const user = await authenticateUser(strategyName, req);

                // Load role permissions
                const { isAdmin, permissions } = await buildRolePermissions(user);

                // Check if MFA is enabled
                if (user.mfaEnabled) {
                    // Check if device is already trusted
                    if (deviceId) {
                        const trustedDevice = await MfaTrustedDevice.findOne({
                            userId: user._id,
                            deviceId,
                            expiresAt: { $gt: new Date() }
                        });

                        if (trustedDevice) {
                            // Update last used
                            trustedDevice.lastUsedAt = new Date();
                            await trustedDevice.save();

                            // Generate token without requiring MFA
                            const token = generateToken({
                                userId: user._id.toString(),
                                username: user.username,
                                authProvider: user.authProvider,
                                authProviderName: user.authProviderName,
                                isAdmin,
                                permissions
                            });

                            // Log successful login
                            await ActivityLogService.logUserLogin(user.username, user._id.toString(), req);

                            res.json({
                                token,
                                deviceId: trustedDevice.deviceId,
                                user: {
                                    id: user._id,
                                    username: user.username,
                                    authProvider: user.authProvider,
                                    authProviderName: user.authProviderName,
                                    isAdmin,
                                    permissions
                                }
                            });
                            return;
                        }
                    }

                    // Device not trusted or no deviceId - require MFA
                    res.json({
                        requiresMfa: true,
                        tempUserId: user._id.toString(),
                        username: user.username
                    });
                    return;
                }

                // Authentication successful (no MFA)
                const token = generateToken({
                    userId: user._id.toString(),
                    username: user.username,
                    authProvider: user.authProvider,
                    authProviderName: user.authProviderName,
                    isAdmin,
                    permissions
                });

                // Log successful login
                await ActivityLogService.logUserLogin(user.username, user._id.toString(), req);

                res.json({
                    token,
                    user: {
                        id: user._id,
                        username: user.username,
                        authProvider: user.authProvider,
                        authProviderName: user.authProviderName,
                        isAdmin,
                        permissions
                    }
                });
                return;

            } catch (error: any) {
                logger.debug(`Authentication failed with provider ${provider.name}: ${error.message || error}`);
                lastError = error;
                // Continue to next provider
            }
        }

        // All providers failed
        if (lastError?.status === 401) {
            res.status(401).json({ message: lastError.message || 'LOGIN_FAILED' });
        } else {
            res.status(500).json({ message: 'Authentication error' });
        }

    } catch (error) {
        logger.error('Login error:', error as Error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Request password reset (only for local users)
export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { username } = req.body;

        if (!username) {
            res.status(400).json({ message: 'USERNAME_REQUIRED' });
            return;
        }

        const user = await User.findOne({ username: username.toLowerCase(), authProvider: 'local' });

        if (!user) {
            // Don't reveal if user exists
            res.json({ message: 'RESET_EMAIL_SENT_IF_USER_EXISTS' });
            return;
        }

        // Check if user is local
        if (user.authProvider !== 'local') {
            res.status(403).json({
                message: 'PASSWORD_RESET_NOT_ALLOWED',
                details: `Password is managed by ${user.authProviderName || user.authProvider}`
            });
            return;
        }

        // Check if user has email
        if (!user.email) {
            res.status(400).json({
                message: 'EMAIL_NOT_SET',
                details: 'Please set your email address in your profile before requesting a password reset'
            });
            return;
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/reset-password/${resetToken}`;

        // Send email with reset link
        const emailSent = await emailService.sendEmail(
            user.email,
            user.preferredLanguage == "it" ? 'Richiesta reimpostazione password' : 'Password Reset Request',
            "password_reset",
            {
                username: user.username,
                resetUrl: resetUrl
            },
            user.preferredLanguage || 'en'
        );

        if (!emailSent) {
            // Email service not configured, log the token for development
            logger.info(`Reset token generated for user: ${username}`);
            logger.info(`Reset URL: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/reset-password/${resetToken}`);
        }

        // Always return the same message to avoid user enumeration
        const response: any = { message: 'RESET_EMAIL_SENT_IF_USER_EXISTS' };

        // In development, return the token if email is not configured
        if (process.env.NODE_ENV === 'development') {
            response.resetToken = resetToken;
        }

        res.json(response);
    } catch (error) {
        logger.error('Forgot password error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Reset password with token
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            res.status(400).json({ message: 'NEW_PASSWORD_REQUIRED' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ message: 'PASSWORD_TOO_SHORT' });
            return;
        }

        // Hash the token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            res.status(400).json({ message: 'INVALID_OR_EXPIRED_TOKEN' });
            return;
        }

        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'PASSWORD_RESET_SUCCESSFULLY' });
    } catch (error) {
        logger.error('Reset password error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};
