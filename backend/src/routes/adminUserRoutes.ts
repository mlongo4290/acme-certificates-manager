import { Router } from 'express';
import { createUser, deleteUser, getUsers, updateUser } from '../controllers/adminUserController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate as any);
router.use(requireAdmin as any);

// Get all users
router.get('/', getUsers as any);

// Create a new user
router.post('/', createUser as any);

// Update a user
router.put('/:id', updateUser as any);

// Delete a user
router.delete('/:id', deleteUser as any);

export default router;
