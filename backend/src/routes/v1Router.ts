import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';
import { CertificateController } from '../controllers/certificate.controller';
import { DnsProviderController } from '../controllers/dnsProvider.controller';
import { createV1CertificateRouter } from './v1/certificates.routes';

export const createV1Router = (
    certificateController: CertificateController,
    dnsProviderController: DnsProviderController
) => {
    // strict: true so that /docs and /docs/ are distinct — needed for the trailing-slash redirect below
    const router = express.Router({ strict: true });

    // API Documentation — redirect /docs → /docs/ so relative asset URLs resolve correctly
    router.get('/docs', (req, res) => res.redirect(`${req.baseUrl}/docs/`));
    // serve is an array in v5, must be spread
    router.use('/docs', ...swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'ACME Certificate Manager API Docs'
    }));

    // Serve OpenAPI spec as JSON
    router.get('/openapi.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    // API Routes
    router.use('/certificates', createV1CertificateRouter(certificateController));
    // Add more v1 routes here as needed

    return router;
};
