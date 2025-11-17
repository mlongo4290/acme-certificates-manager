import { Router } from 'express';
import {
    createAuthProvider,
    deleteAuthProvider,
    getAuthProviders,
    getEnabledProviders,
    updateAuthProvider
} from '../controllers/authProviderController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Public endpoint for login page
router.get('/enabled', getEnabledProviders);

// Protected endpoints for admin
router.get('/', authenticate as any, requireAdmin as any, getAuthProviders);
router.post('/', authenticate as any, requireAdmin as any, createAuthProvider);
router.put('/:id', authenticate as any, requireAdmin as any, updateAuthProvider);
router.delete('/:id', authenticate as any, requireAdmin as any, deleteAuthProvider);

export default router;
