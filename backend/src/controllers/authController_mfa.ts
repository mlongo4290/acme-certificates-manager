import crypto from 'crypto';
import { Request, Response } from 'express';
import speakeasy from 'speakeasy';
import { generateToken } from '../middleware/auth';
import { MfaTrustedDevice } from '../models/MfaTrustedDevice';
import { User } from '../models/User';
import { ActivityLogService } from '../services/activityLog.service';
import { Logger } from '../services/logger.service';
import { buildRolePermissions } from './authController';

const logger = new Logger('AuthMFA');

// Verify MFA token during login
export const verifyMfaLogin = async (req: Request, res: Response) => {
    try {
        const { tempUserId, token, trustDevice, deviceId } = req.body;

        if (!tempUserId || !token) {
            res.status(400).json({ message: 'USER_ID_AND_TOKEN_REQUIRED' });
            return;
        }

        const user = await User.findById(tempUserId);

        if (!user) {
            res.status(404).json({ message: 'USER_NOT_FOUND' });
            return;
        }

        if (!user.mfaEnabled || !user.mfaSecret) {
            res.status(400).json({ message: 'MFA_NOT_ENABLED' });
            return;
        }

        // Verify MFA token
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

        // If user wants to trust this device
        let finalDeviceId = deviceId;
        if (trustDevice) {
            if (!finalDeviceId) {
                finalDeviceId = crypto.randomBytes(32).toString('hex');
            }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + (user.mfaTrustDuration || 30));

            await MfaTrustedDevice.create({
                userId: user._id,
                deviceId: finalDeviceId,
                deviceName: req.headers['user-agent'] || 'Unknown Device',
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
                expiresAt
            });
        }

        // Load role permissions
        const { isAdmin, permissions } = await buildRolePermissions(user);

        // MFA verification successful, generate JWT token
        const jwtToken = generateToken({
            userId: user.id,
            username: user.username,
            authProvider: user.authProvider as 'local' | 'ldap' | 'azure-ad' | 'oidc',
            authProviderName: user.authProviderName ? user.authProviderName : undefined,
            isAdmin,
            permissions
        });

        // Log successful login with MFA
        await ActivityLogService.logUserLogin(user.username, (user._id).toString(), req);

        res.json({
            token: jwtToken,
            deviceId: finalDeviceId,
            user: {
                id: user._id,
                username: user.username,
                authProvider: user.authProvider,
                authProviderName: user.authProviderName,
                isAdmin,
                permissions
            }
        });
    } catch (error) {
        logger.error('Verify MFA login error:', error as Error);
        res.status(500).json({ message: 'SERVER_ERROR' });
    }
};
