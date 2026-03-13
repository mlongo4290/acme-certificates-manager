import express from 'express';
import { configExportController } from '../controllers/configExport.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Export full configuration (admin only)
router.get('/export', authenticate as any, requireAdmin as any, configExportController.exportConfig);

// Import configuration (admin only)
router.post('/import', authenticate as any, requireAdmin as any, configExportController.importConfig);

export default router;
