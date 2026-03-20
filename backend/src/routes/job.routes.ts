import express from 'express';
import { JobController } from '../controllers/job.controller';
import { authMiddleware, requirePermission, sseAuthMiddleware } from '../middleware/auth';

export const createJobRouter = (controller: JobController) => {
    const router = express.Router();

    // Read
    router.get('/', authMiddleware as any, requirePermission('jobs', 'read') as any, controller.getJobs);

    // Write (stream + dismiss)
    router.get('/:id/stream', sseAuthMiddleware as any, requirePermission('jobs', 'write') as any, controller.streamJob);
    router.delete('/:id', authMiddleware as any, requirePermission('jobs', 'write') as any, controller.dismissJob);

    return router;
};
