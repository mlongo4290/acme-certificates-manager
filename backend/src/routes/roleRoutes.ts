import { Router } from 'express';
import {
    createRole,
    deleteRole,
    getRoleById,
    getRoles,
    updateRole
} from '../controllers/roleController';

const router = Router();

router.get('/', getRoles as any);
router.get('/:id', getRoleById as any);
router.post('/', createRole as any);
router.put('/:id', updateRole as any);
router.delete('/:id', deleteRole as any);

export default router;
