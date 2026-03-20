import { Router } from 'express';
import {
    getNotificationLogs,
    getNotificationStats,
    retryNotification,
} from '../controllers/notificationLog.controller';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

// Read: activityLogs:read (notifications are part of activity)
router.use(authMiddleware as any);

router.get('/', requirePermission('activityLogs', 'read') as any, getNotificationLogs);
router.get('/stats', requirePermission('activityLogs', 'read') as any, getNotificationStats);

// Retry: activityLogs:write
router.post('/:id/retry', requirePermission('activityLogs', 'write') as any, retryNotification);

export default router;
