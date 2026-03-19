import express from 'express';
import { JobController } from '../controllers/job.controller';
import { authMiddleware, requireAdminOrCertManager, sseAuthMiddleware } from '../middleware/auth';

export const createJobRouter = (controller: JobController) => {
    const router = express.Router();

    router.get('/', authMiddleware as any, controller.getJobs);
    router.get('/:id/stream', sseAuthMiddleware as any, requireAdminOrCertManager as any, controller.streamJob);
    router.delete('/:id', authMiddleware as any, requireAdminOrCertManager as any, controller.dismissJob);

    return router;
};
