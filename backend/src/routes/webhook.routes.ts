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
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

// Read
router.get('/events', authMiddleware as any, requirePermission('webhooks', 'read') as any, getValidEvents);
router.get('/', authMiddleware as any, requirePermission('webhooks', 'read') as any, getAllWebhooks);
router.get('/:id/logs', authMiddleware as any, requirePermission('webhooks', 'read') as any, getWebhookLogs);
router.get('/:id', authMiddleware as any, requirePermission('webhooks', 'read') as any, getWebhookById);

// Write
router.post('/', authMiddleware as any, requirePermission('webhooks', 'write') as any, createWebhook);
router.put('/:id', authMiddleware as any, requirePermission('webhooks', 'write') as any, updateWebhook);
router.delete('/:id', authMiddleware as any, requirePermission('webhooks', 'write') as any, deleteWebhook);
router.post('/:id/test', authMiddleware as any, requirePermission('webhooks', 'write') as any, testWebhook);

export default router;
