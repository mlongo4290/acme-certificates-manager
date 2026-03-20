import express from 'express';
import { DnsProviderController } from '../controllers/dnsProvider.controller';
import { authMiddleware, requirePermission } from '../middleware/auth';

export function createDnsProviderRouter(controller: DnsProviderController): express.Router {
    const router = express.Router();

    // Read
    router.get('/types', authMiddleware as any, requirePermission('dnsProviders', 'read') as any, controller.getAvailableProviderTypes);
    router.get('/', authMiddleware as any, requirePermission('dnsProviders', 'read') as any, controller.getAllProviders);
    router.get('/:id', authMiddleware as any, requirePermission('dnsProviders', 'read') as any, controller.getProviderById);

    // Write
    router.post('/', authMiddleware as any, requirePermission('dnsProviders', 'write') as any, controller.createProvider);
    router.patch('/:id', authMiddleware as any, requirePermission('dnsProviders', 'write') as any, controller.updateProvider);
    router.delete('/:id', authMiddleware as any, requirePermission('dnsProviders', 'write') as any, controller.deleteProvider);
    router.post('/:id/test', authMiddleware as any, requirePermission('dnsProviders', 'write') as any, controller.testProvider);

    return router;
}
