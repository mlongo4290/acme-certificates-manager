import express from 'express';
import { createToken, deleteToken, getAvailableScopes, getTokens } from '../controllers/apiTokenController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication (JWT only, not API tokens)
router.use(authenticate as any);

// Get all tokens for current user
router.get('/', getTokens as any);

// Get available scopes for current user
router.get('/scopes', getAvailableScopes as any);

// Create a new API token
router.post('/', createToken as any);

// Delete a token permanently
router.delete('/:id', deleteToken as any);

export default router;
