import express from 'express';
import {
    cleanupOldActivityLogs,
    getActivityLogConfig,
    getActivityLogs,
    getRecentActivityLogs,
    updateActivityLogConfig,
} from '../controllers/activityLog.controller';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Read: all authenticated users
router.get('/', authMiddleware as any, getActivityLogs);
router.get('/recent', authMiddleware as any, getRecentActivityLogs);

// Config and cleanup: ADMIN only
router.get('/config', authMiddleware as any, requireAdmin as any, getActivityLogConfig);
router.post('/config', authMiddleware as any, requireAdmin as any, updateActivityLogConfig);
router.delete('/cleanup', authMiddleware as any, requireAdmin as any, cleanupOldActivityLogs);

export default router;
