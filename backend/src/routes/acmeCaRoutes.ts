import { Router } from 'express';
import { acmeCaController } from '../controllers/acmeCaController';
import { authenticate, requireAdminOrCertManager } from '../middleware/auth';

const router = Router();

// All routes require authentication and ADMIN or CERT_MANAGER role
router.get('/', authenticate as any, requireAdminOrCertManager as any, acmeCaController.getAllCAs as any);
router.get('/:id', authenticate as any, requireAdminOrCertManager as any, acmeCaController.getCAById as any);
router.post('/', authenticate as any, requireAdminOrCertManager as any, acmeCaController.createCA as any);
router.put('/:id', authenticate as any, requireAdminOrCertManager as any, acmeCaController.updateCA as any);
router.delete('/:id', authenticate as any, requireAdminOrCertManager as any, acmeCaController.deleteCA as any);
router.patch('/:id/set-default', authenticate as any, requireAdminOrCertManager as any, acmeCaController.setAsDefault as any);
router.post('/:id/test-connection', authenticate as any, requireAdminOrCertManager as any, acmeCaController.testConnection as any);

export default router;
