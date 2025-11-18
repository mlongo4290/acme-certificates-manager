import { Router } from 'express';
import {
    getNotificationLogs,
    getNotificationStats,
    retryNotification,
} from '../controllers/notificationLog.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', getNotificationLogs);
router.get('/stats', getNotificationStats);
router.post('/:id/retry', retryNotification);

export default router;
