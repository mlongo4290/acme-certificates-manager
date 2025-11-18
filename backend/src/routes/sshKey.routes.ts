import express from 'express';
import { sshKeyController } from '../controllers/sshKey.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate as any);
router.use(requireAdmin as any);

router.get('/', sshKeyController.getAllKeys);
router.post('/generate', sshKeyController.generateKeyPair);
router.get('/:id', sshKeyController.getKey);
router.post('/', sshKeyController.createKey);
router.put('/:id', sshKeyController.updateKey);
router.delete('/:id', sshKeyController.deleteKey);

export default router;
