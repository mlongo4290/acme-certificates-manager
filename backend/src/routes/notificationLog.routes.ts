import { Router } from 'express';
import {
    getNotificationLogs,
    getNotificationStats,
    retryNotification,
} from '../controllers/notificationLog.controller';
import { authMiddleware, requireAdminOrCertManager } from '../middleware/auth';

const router = Router();

// Read: all authenticated users
router.use(authMiddleware);

router.get('/', getNotificationLogs);
router.get('/stats', getNotificationStats);

// Retry: ADMIN or CERT_MANAGER only
router.post('/:id/retry', requireAdminOrCertManager as any, retryNotification);

export default router;
