import { Router } from 'express';
import {
    createWebhook,
    deleteWebhook,
    getAllWebhooks,
    getValidEvents,
    getWebhookById,
    getWebhookLogs,
    testWebhook,
    updateWebhook,
} from '../controllers/webhook.controller';
import { authMiddleware, requireAdminOrCertManager } from '../middleware/auth';

const router = Router();

// Read: all authenticated users
router.get('/events', authMiddleware as any, getValidEvents);
router.get('/', authMiddleware as any, getAllWebhooks);
router.get('/:id/logs', authMiddleware as any, getWebhookLogs);
router.get('/:id', authMiddleware as any, getWebhookById);

// Write: ADMIN or CERT_MANAGER only
router.post('/', authMiddleware as any, requireAdminOrCertManager as any, createWebhook);
router.put('/:id', authMiddleware as any, requireAdminOrCertManager as any, updateWebhook);
router.delete('/:id', authMiddleware as any, requireAdminOrCertManager as any, deleteWebhook);
router.post('/:id/test', authMiddleware as any, requireAdminOrCertManager as any, testWebhook);

export default router;
