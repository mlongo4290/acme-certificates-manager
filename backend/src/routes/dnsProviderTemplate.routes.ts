import { Router } from 'express';
import { DnsProviderTemplateController } from '../controllers/dnsProviderTemplate.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

export const createDnsProviderTemplateRouter = (controller: DnsProviderTemplateController) => {
    const router = Router();

    // Public routes (authenticated users)
    router.get('/', authenticate as any, controller.getAllTemplates.bind(controller) as any);
    router.get('/:identifier', authenticate as any, controller.getTemplateByIdentifier.bind(controller) as any);

    // Admin-only routes
    router.post('/', authenticate as any, requireAdmin as any, controller.createTemplate.bind(controller) as any);
    router.patch('/:id', authenticate as any, requireAdmin as any, controller.updateTemplate.bind(controller) as any);
    router.delete('/:id', authenticate as any, requireAdmin as any, controller.deleteTemplate.bind(controller) as any);

    return router;
};
