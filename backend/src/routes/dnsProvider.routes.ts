import express from 'express';
import { DnsProviderController } from '../controllers/dnsProvider.controller';
import { authMiddleware, requireAdminOrCertManager } from '../middleware/auth';

export function createDnsProviderRouter(controller: DnsProviderController): express.Router {
    const router = express.Router();

    // Read: all authenticated users
    router.get('/types', authMiddleware as any, controller.getAvailableProviderTypes);
    router.get('/', authMiddleware as any, controller.getAllProviders);
    router.get('/:id', authMiddleware as any, controller.getProviderById);

    // Write: ADMIN or CERT_MANAGER only
    router.post('/', authMiddleware as any, requireAdminOrCertManager as any, controller.createProvider);
    router.patch('/:id', authMiddleware as any, requireAdminOrCertManager as any, controller.updateProvider);
    router.delete('/:id', authMiddleware as any, requireAdminOrCertManager as any, controller.deleteProvider);
    router.post('/:id/test', authMiddleware as any, requireAdminOrCertManager as any, controller.testProvider);

    return router;
}
