import { Router } from 'express';
import multer from 'multer';
import { PostIssueScriptController } from '../controllers/postIssueScript.controller';
import { authMiddleware, requireAdminOrCertManager } from '../middleware/auth';

const router = Router();
const controller = new PostIssueScriptController();

// Configure multer for file upload (store in memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Read: all authenticated users
router.get('/', authMiddleware as any, controller.getAllScripts);
router.get('/base_path', authMiddleware as any, controller.getBasePath);
router.get('/:id', authMiddleware as any, controller.getScriptById);
router.get('/:id/export', authMiddleware as any, controller.exportScript);

// Write: ADMIN or CERT_MANAGER only
router.post('/', authMiddleware as any, requireAdminOrCertManager as any, controller.createScript);
router.post('/import', authMiddleware as any, requireAdminOrCertManager as any, upload.single('file'), controller.importScript);
router.put('/:id', authMiddleware as any, requireAdminOrCertManager as any, controller.updateScript);
router.delete('/:id', authMiddleware as any, requireAdminOrCertManager as any, controller.deleteScript);
router.post('/:id/run-init', authMiddleware as any, requireAdminOrCertManager as any, controller.runInit);

export default router;
