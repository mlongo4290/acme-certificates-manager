import express from 'express';
import {
    cleanupOldActivityLogs,
    getActivityLogConfig,
    getActivityLogs,
    getRecentActivityLogs,
    updateActivityLogConfig,
} from '../controllers/activityLog.controller';
import { authMiddleware, requireAdmin, requirePermission } from '../middleware/auth';

const router = express.Router();

// Read: requires activityLogs:read
router.get('/', authMiddleware as any, requirePermission('activityLogs', 'read') as any, getActivityLogs);
router.get('/recent', authMiddleware as any, requirePermission('activityLogs', 'read') as any, getRecentActivityLogs);

// Config and cleanup: ADMIN only
router.get('/config', authMiddleware as any, requireAdmin as any, getActivityLogConfig);
router.post('/config', authMiddleware as any, requireAdmin as any, updateActivityLogConfig);
router.delete('/cleanup', authMiddleware as any, requireAdmin as any, cleanupOldActivityLogs);

export default router;
