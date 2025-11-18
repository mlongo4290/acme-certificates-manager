import express from 'express';
import { DnsProviderController } from '../controllers/dnsProvider.controller';

export function createDnsProviderRouter(controller: DnsProviderController): express.Router {
    const router = express.Router();

    router.get('/types', controller.getAvailableProviderTypes);
    router.get('/', controller.getAllProviders);
    router.get('/:id', controller.getProviderById);
    router.post('/', controller.createProvider);
    router.patch('/:id', controller.updateProvider);
    router.delete('/:id', controller.deleteProvider);
    router.post('/:id/test', controller.testProvider);

    return router;
}
