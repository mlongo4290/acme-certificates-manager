import express from 'express';
import { CertificateController } from '../controllers/certificate.controller';
import { authMiddleware, requireAdminOrCertManager, sseAuthMiddleware } from '../middleware/auth';

export const createCertificateRouter = (controller: CertificateController) => {
    const router = express.Router();

    // Read: all authenticated users
    router.get('/', authMiddleware as any, controller.getAllCertificates);
    router.get('/stats', authMiddleware as any, controller.getCertificatesStats);
    router.get('/renewal-config', authMiddleware as any, controller.getRenewalConfig);
    router.get('/check-scheduling-conflicts', authMiddleware as any, controller.checkSchedulingConflicts);
    router.get('/proxy-ca-cert', authMiddleware as any, controller.downloadCACertificate);
    router.get('/tags', authMiddleware as any, requireAdminOrCertManager as any, controller.getAllTags);
    router.get('/:id', authMiddleware as any, controller.getCertificateById);
    router.get('/:id/download/:type', authMiddleware as any, controller.downloadCertificate);
    router.get('/:id/logs', authMiddleware as any, controller.getCertificateLogs);

    // Write: ADMIN or CERT_MANAGER only
    router.post('/bulk', authMiddleware as any, requireAdminOrCertManager as any, controller.bulkAction);
    router.post('/export-zip', authMiddleware as any, requireAdminOrCertManager as any, controller.exportCertificatesZip);
    router.post('/', authMiddleware as any, requireAdminOrCertManager as any, controller.createCertificate);
    router.patch('/:id', authMiddleware as any, requireAdminOrCertManager as any, controller.updateCertificate);
    router.delete('/:id', authMiddleware as any, requireAdminOrCertManager as any, controller.deleteCertificate);
    router.post('/:id/test-script', authMiddleware as any, requireAdminOrCertManager as any, controller.testPostIssueScript);

    // SSE operations (issue/renew): ADMIN or CERT_MANAGER only
    router.get('/:id/issue', sseAuthMiddleware as any, requireAdminOrCertManager as any, controller.issueCertificate);
    router.get('/:id/reissue', sseAuthMiddleware as any, requireAdminOrCertManager as any, controller.reissueCertificate);
    router.get('/:id/renew', sseAuthMiddleware as any, requireAdminOrCertManager as any, controller.renewCertificate);

    return router;
};
