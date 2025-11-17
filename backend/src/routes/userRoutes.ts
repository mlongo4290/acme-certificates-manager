import { Router } from 'express';
import {
    changePassword,
    disableMFA,
    getCurrentUser,
    getTrustedDevices,
    revokeAllTrustedDevices,
    revokeTrustedDevice,
    setupMFA,
    updateEmail,
    updateMfaTrustDuration,
    updateNotificationEvents,
    verifyAndEnableMFA
} from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get current user (requires authentication)
router.get('/me', authenticate as any, getCurrentUser as any);

// Update email (requires authentication)
router.put('/email', authenticate as any, updateEmail as any);

// Change password (requires authentication)
router.post('/change-password', authenticate as any, changePassword as any);

// MFA routes (require authentication)
router.post('/mfa/setup', authenticate as any, setupMFA as any);
router.post('/mfa/verify', authenticate as any, verifyAndEnableMFA as any);
router.post('/mfa/disable', authenticate as any, disableMFA as any);
router.put('/mfa/trust-duration', authenticate as any, updateMfaTrustDuration as any);

// Trusted devices (require authentication)
router.get('/mfa/trusted-devices', authenticate as any, getTrustedDevices as any);
router.delete('/mfa/trusted-devices/:deviceId', authenticate as any, revokeTrustedDevice as any);
router.delete('/mfa/trusted-devices', authenticate as any, revokeAllTrustedDevices as any);

// Notification events (requires authentication)
router.put('/notification-events', authenticate as any, updateNotificationEvents as any);

export default router;
