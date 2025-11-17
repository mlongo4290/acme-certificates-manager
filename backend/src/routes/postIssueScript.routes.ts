import { Router } from 'express';
import multer from 'multer';
import { PostIssueScriptController } from '../controllers/postIssueScript.controller';

const router = Router();
const controller = new PostIssueScriptController();

// Configure multer for file upload (store in memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.get('/', controller.getAllScripts);
router.get('/base_path', controller.getBasePath);
router.get('/:id/export', controller.exportScript);
router.post('/:id/run-init', controller.runInit);
router.get('/:id', controller.getScriptById);
router.post('/', controller.createScript);
router.post('/import', upload.single('file'), controller.importScript);
router.put('/:id', controller.updateScript);
router.delete('/:id', controller.deleteScript);

export default router;
