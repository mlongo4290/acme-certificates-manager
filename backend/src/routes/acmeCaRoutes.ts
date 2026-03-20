import { Router } from 'express';
import { acmeCaController } from '../controllers/acmeCaController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// Read
router.get('/', authenticate as any, requirePermission('acmeCa', 'read') as any, acmeCaController.getAllCAs as any);
router.get('/:id', authenticate as any, requirePermission('acmeCa', 'read') as any, acmeCaController.getCAById as any);

// Write
router.post('/', authenticate as any, requirePermission('acmeCa', 'write') as any, acmeCaController.createCA as any);
router.put('/:id', authenticate as any, requirePermission('acmeCa', 'write') as any, acmeCaController.updateCA as any);
router.delete('/:id', authenticate as any, requirePermission('acmeCa', 'write') as any, acmeCaController.deleteCA as any);
router.patch('/:id/set-default', authenticate as any, requirePermission('acmeCa', 'write') as any, acmeCaController.setAsDefault as any);
router.post('/:id/test-connection', authenticate as any, requirePermission('acmeCa', 'write') as any, acmeCaController.testConnection as any);

export default router;
