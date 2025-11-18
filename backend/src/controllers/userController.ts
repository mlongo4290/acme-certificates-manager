import { Response } from 'express';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import { AuthRequest } from '../middleware/auth';
import { MfaTrustedDevice } from '../models/MfaTrustedDevice';
import { User, comparePassword } from '../models/User';
import { Logger } from '../services/logger.service';

const logger = new Logger('UserController');

// Change password for local users only
export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?.userId; // From auth middleware

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        if (!currentPassword || !newPassword) {
            res.status(400).json({ message: 'CURRENT_AND_NEW_PASSWORD_REQUIRED' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ message: 'PASSWORD_TOO_SHORT' });
            return;
        }

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        // Check if user is local
        if (user.authProvider !== 'local') {
            res.status(403).json({
                message: 'PASSWORD_CHANGE_NOT_ALLOWED',
                details: `Password is managed by ${user.authProviderName || user.authProvider}`
            });
            return;
        }

        // Verify current password
        const isValidPassword = await comparePassword(currentPassword, user.password);
        if (!isValidPassword) {
            res.status(401).json({ message: 'INVALID_CURRENT_PASSWORD' });
            return;
        }

        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        await user.save();

        res.json({ message: 'PASSWORD_CHANGED_SUCCESSFULLY' });
    } catch (error) {
        logger.error('Change password error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Update user email
export const updateEmail = async (req: AuthRequest, res: Response) => {
    try {
        const { email, preferredLanguage } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        if (!email) {
            res.status(400).json({ message: 'EMAIL_REQUIRED' });
            return;
        }

        if (!preferredLanguage || (preferredLanguage !== 'en' && preferredLanguage !== 'it')) {
            res.status(400).json({ message: 'INVALID_PREFERRED_LANGUAGE' });
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ message: 'INVALID_EMAIL_FORMAT' });
            return;
        }

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        // Update email
        user.email = email.toLowerCase();
        user.preferredLanguage = preferredLanguage;
        await user.save();

        res.json({
            message: 'EMAIL_UPDATED_SUCCESSFULLY',
            email: user.email,
            preferredLanguage: user.preferredLanguage
        });
    } catch (error) {
        logger.error('Update email error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Get current user profile
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const user = await User.findById(userId).select('-password -resetPasswordToken -resetPasswordExpires');

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            mfaEnabled: user.mfaEnabled,
            mfaTrustDuration: user.mfaTrustDuration || 30,
            notificationEvents: user.notificationEvents || [],
            preferredLanguage: user.preferredLanguage || 'en',
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });
    } catch (error) {
        logger.error('Get current user error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Setup MFA - Generate secret and QR code
export const setupMFA = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        // Only allow for local and LDAP users
        if (user.authProvider !== 'local' && user.authProvider !== 'ldap') {
            res.status(403).json({
                message: 'MFA_NOT_ALLOWED_FOR_PROVIDER',
                details: `MFA is not available for ${user.authProviderName || user.authProvider} authentication`
            });
            return;
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `ACME Manager (${user.username})`,
            issuer: 'ACME Certificates Manager'
        });

        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

        // Store secret temporarily (will be confirmed on verification)
        user.mfaSecret = secret.base32;
        await user.save();

        res.json({
            secret: secret.base32,
            qrCode: qrCodeDataUrl,
            otpauthUrl: secret.otpauth_url
        });
    } catch (error) {
        logger.error('Setup MFA error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Verify MFA token and enable MFA
export const verifyAndEnableMFA = async (req: AuthRequest, res: Response) => {
    try {
        const { token } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        if (!token) {
            res.status(400).json({ message: 'MFA_TOKEN_REQUIRED' });
            return;
        }

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        if (!user.mfaSecret) {
            res.status(400).json({ message: 'MFA_NOT_SETUP' });
            return;
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: token,
            window: 2 // Allow 2 time steps of variance
        });

        if (!verified) {
            res.status(401).json({ message: 'INVALID_MFA_TOKEN' });
            return;
        }

        // Enable MFA
        user.mfaEnabled = true;
        await user.save();

        res.json({
            message: 'MFA_ENABLED_SUCCESSFULLY',
            mfaEnabled: true
        });
    } catch (error) {
        logger.error('Verify MFA error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Disable MFA
export const disableMFA = async (req: AuthRequest, res: Response) => {
    try {
        const { password, token } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        if (!user.mfaEnabled) {
            res.status(400).json({ message: 'MFA_NOT_ENABLED' });
            return;
        }

        // For local users, verify password
        if (user.authProvider === 'local') {
            if (!password) {
                res.status(400).json({ message: 'PASSWORD_REQUIRED' });
                return;
            }

            const isValidPassword = await comparePassword(password, user.password);
            if (!isValidPassword) {
                res.status(401).json({ message: 'INVALID_PASSWORD' });
                return;
            }
        }

        // Verify current MFA token
        if (!token) {
            res.status(400).json({ message: 'MFA_TOKEN_REQUIRED' });
            return;
        }

        if (!user.mfaSecret) {
            res.status(400).json({ message: 'MFA_SECRET_NOT_FOUND' });
            return;
        }

        const verified = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            res.status(401).json({ message: 'INVALID_MFA_TOKEN' });
            return;
        }

        // Disable MFA and remove secret
        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        await user.save();

        res.json({
            message: 'MFA_DISABLED_SUCCESSFULLY',
            mfaEnabled: false
        });
    } catch (error) {
        logger.error('Disable MFA error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Update notification events
export const updateNotificationEvents = async (req: AuthRequest, res: Response) => {
    try {
        const { notificationEvents } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        if (!Array.isArray(notificationEvents)) {
            res.status(400).json({ message: 'INVALID_NOTIFICATION_EVENTS' });
            return;
        }

        // Valid event types
        const validEvents = [
            'certificate_renewed_success',
            'certificate_renewed_failed',
            'certificate_issued_success',
            'certificate_issued_failed',
            'post_script_success',
            'post_script_failed'
        ];

        // Validate all events
        for (const event of notificationEvents) {
            if (!validEvents.includes(event)) {
                res.status(400).json({ message: 'INVALID_EVENT_TYPE', invalidEvent: event });
                return;
            }
        }

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        // Update notification events
        user.notificationEvents = notificationEvents;
        await user.save();

        res.json({
            message: 'NOTIFICATION_EVENTS_UPDATED_SUCCESSFULLY',
            notificationEvents: user.notificationEvents
        });
    } catch (error) {
        logger.error('Update notification events error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Update MFA trust duration
export const updateMfaTrustDuration = async (req: AuthRequest, res: Response) => {
    try {
        const { mfaTrustDuration } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        if (typeof mfaTrustDuration !== 'number' || mfaTrustDuration < 0 || mfaTrustDuration > 365) {
            res.status(400).json({ message: 'INVALID_TRUST_DURATION', details: 'Must be between 0 and 365 days' });
            return;
        }

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        user.mfaTrustDuration = mfaTrustDuration;
        await user.save();

        res.json({
            message: 'MFA_TRUST_DURATION_UPDATED',
            mfaTrustDuration: user.mfaTrustDuration
        });
    } catch (error) {
        logger.error('Update MFA trust duration error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Get trusted devices
export const getTrustedDevices = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const devices = await MfaTrustedDevice.find({
            userId,
            expiresAt: { $gt: new Date() }
        }).sort({ lastUsedAt: -1 });

        res.json(devices);
    } catch (error) {
        logger.error('Get trusted devices error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Revoke trusted device
export const revokeTrustedDevice = async (req: AuthRequest, res: Response) => {
    try {
        const { deviceId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const result = await MfaTrustedDevice.deleteOne({
            userId,
            deviceId
        });

        if (result.deletedCount === 0) {
            res.status(404).json({ message: 'DEVICE_NOT_FOUND' });
            return;
        }

        res.json({ message: 'DEVICE_REVOKED_SUCCESSFULLY' });
    } catch (error) {
        logger.error('Revoke trusted device error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};

// Revoke all trusted devices
export const revokeAllTrustedDevices = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const result = await MfaTrustedDevice.deleteMany({ userId });

        res.json({
            message: 'ALL_DEVICES_REVOKED_SUCCESSFULLY',
            count: result.deletedCount
        });
    } catch (error) {
        logger.error('Revoke all trusted devices error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};
