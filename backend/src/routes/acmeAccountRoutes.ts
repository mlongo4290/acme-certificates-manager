import express from 'express';
import { acmeAccountController } from '../controllers/acmeAccountController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = express.Router();

// Read
router.get('/', authenticate as any, requirePermission('acmeAccounts', 'read') as any, acmeAccountController.getAllAccounts as any);
router.get('/:id', authenticate as any, requirePermission('acmeAccounts', 'read') as any, acmeAccountController.getAccountById as any);

// Write
router.post('/', authenticate as any, requirePermission('acmeAccounts', 'write') as any, acmeAccountController.createAccount as any);
router.put('/:id', authenticate as any, requirePermission('acmeAccounts', 'write') as any, acmeAccountController.updateAccount as any);
router.delete('/:id', authenticate as any, requirePermission('acmeAccounts', 'write') as any, acmeAccountController.deleteAccount as any);
router.post('/:id/register', authenticate as any, requirePermission('acmeAccounts', 'write') as any, acmeAccountController.registerWithCA as any);
router.post('/:id/reregister', authenticate as any, requirePermission('acmeAccounts', 'write') as any, acmeAccountController.reregisterWithCA as any);
router.post('/:id/deactivate', authenticate as any, requirePermission('acmeAccounts', 'write') as any, acmeAccountController.deactivateAccount as any);

export default router;
