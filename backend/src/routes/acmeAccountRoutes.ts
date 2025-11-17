import express from 'express';
import { acmeAccountController } from '../controllers/acmeAccountController';
import { authenticate, requireAdminOrCertManager } from '../middleware/auth';

const router = express.Router();

// Get all accounts
router.get('/', authenticate as any, requireAdminOrCertManager as any, acmeAccountController.getAllAccounts as any);

// Get account by ID
router.get('/:id', authenticate as any, requireAdminOrCertManager as any, acmeAccountController.getAccountById as any);

// Create new account
router.post('/', authenticate as any, requireAdminOrCertManager as any, acmeAccountController.createAccount as any);

// Update account
router.put('/:id', authenticate as any, requireAdminOrCertManager as any, acmeAccountController.updateAccount as any);

// Delete account
router.delete('/:id', authenticate as any, requireAdminOrCertManager as any, acmeAccountController.deleteAccount as any);

// Register account with CA
router.post('/:id/register', authenticate as any, requireAdminOrCertManager as any, acmeAccountController.registerWithCA as any);

export default router;
