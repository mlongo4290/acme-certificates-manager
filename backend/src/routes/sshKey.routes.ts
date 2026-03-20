import express from 'express';
import { sshKeyController } from '../controllers/sshKey.controller';
import { authenticate, requirePermission } from '../middleware/auth';

const router = express.Router();

router.use(authenticate as any);

// Read
router.get('/', requirePermission('sshKeys', 'read') as any, sshKeyController.getAllKeys);
router.get('/:id', requirePermission('sshKeys', 'read') as any, sshKeyController.getKey);

// Write
router.post('/generate', requirePermission('sshKeys', 'write') as any, sshKeyController.generateKeyPair);
router.post('/', requirePermission('sshKeys', 'write') as any, sshKeyController.createKey);
router.put('/:id', requirePermission('sshKeys', 'write') as any, sshKeyController.updateKey);
router.delete('/:id', requirePermission('sshKeys', 'write') as any, sshKeyController.deleteKey);

export default router;
