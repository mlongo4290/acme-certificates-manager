import express from 'express';
import { CertificateController } from '../controllers/certificate.controller';
import { authMiddleware, sseAuthMiddleware } from '../middleware/auth';

export const createCertificateRouter = (controller: CertificateController) => {
    const router = express.Router();

    // Apply standard auth middleware to most routes
    router.get('/', authMiddleware as any, controller.getAllCertificates);
    router.get('/stats', authMiddleware as any, controller.getCertificatesStats);
    router.get('/check-scheduling-conflicts', authMiddleware as any, controller.checkSchedulingConflicts);
    router.get('/proxy-ca-cert', authMiddleware as any, controller.downloadCACertificate);
    router.get('/:id/issue', sseAuthMiddleware as any, controller.issueCertificate);
    router.get('/:id/reissue', sseAuthMiddleware as any, controller.reissueCertificate);
    router.get('/:id/logs', authMiddleware as any, controller.getCertificateLogs);
    router.get('/:id', authMiddleware as any, controller.getCertificateById);
    router.get('/:id/download/:type', authMiddleware as any, controller.downloadCertificate);
    router.post('/', authMiddleware as any, controller.createCertificate);
    router.patch('/:id', authMiddleware as any, controller.updateCertificate);
    router.delete('/:id', authMiddleware as any, controller.deleteCertificate);
    router.get('/:id/renew', sseAuthMiddleware as any, controller.renewCertificate);
    router.post('/:id/test-script', authMiddleware as any, controller.testPostIssueScript);

    return router;
};