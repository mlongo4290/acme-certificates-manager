import express from 'express';
import { CertificateController } from '../controllers/certificate.controller';
import { authMiddleware, requirePermission } from '../middleware/auth';

export const createCertificateRouter = (controller: CertificateController) => {
    const router = express.Router();

    // Read: all authenticated users with certificates:read
    router.get('/', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.getAllCertificates);
    router.get('/stats', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.getCertificatesStats);
    router.get('/renewal-config', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.getRenewalConfig);
    router.get('/check-scheduling-conflicts', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.checkSchedulingConflicts);
    router.get('/proxy-ca-cert', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.downloadCACertificate);
    router.get('/tags', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.getAllTags);
    router.get('/:id', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.getCertificateById);
    router.get('/:id/download/:type', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.downloadCertificate);
    router.get('/:id/logs', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.getCertificateLogs);

    // Write: certificates:write
    router.post('/bulk', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.bulkAction);
    router.post('/export-zip', authMiddleware as any, requirePermission('certificates', 'read') as any, controller.exportCertificatesZip);
    router.post('/', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.createCertificate);
    router.patch('/:id', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.updateCertificate);
    router.delete('/:id', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.deleteCertificate);
    router.post('/:id/test-script', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.testPostIssueScript);

    // Certificate operations — now POST (return jobId, run in background)
    router.post('/:id/issue', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.issueCertificate);
    router.post('/:id/reissue', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.reissueCertificate);
    router.post('/:id/renew', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.renewCertificate);
    router.post('/:id/dry-run', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.dryRunCertificate);
    router.post('/:id/revoke', authMiddleware as any, requirePermission('certificates', 'write') as any, controller.revokeCertificate);

    return router;
};
