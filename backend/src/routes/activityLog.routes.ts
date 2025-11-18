import express from 'express';
import {
    cleanupOldActivityLogs,
    getActivityLogConfig,
    getActivityLogs,
    getRecentActivityLogs,
    updateActivityLogConfig,
} from '../controllers/activityLog.controller';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// GET /api/activity-logs - Lista paginata con filtri
router.get('/', authMiddleware as any, getActivityLogs);

// GET /api/activity-logs/recent - Ultimi log per dashboard
router.get('/recent', authMiddleware as any, getRecentActivityLogs);

// GET /api/activity-logs/config - Configurazione
router.get('/config', authMiddleware as any, getActivityLogConfig);

// POST /api/activity-logs/config - Aggiorna configurazione
router.post('/config', authMiddleware as any, updateActivityLogConfig);

// DELETE /api/activity-logs/cleanup - Housekeeping manuale
router.delete('/cleanup', authMiddleware as any, cleanupOldActivityLogs);

export default router;
