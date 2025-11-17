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
    const router = express.Router();

    // API Documentation
    router.use('/docs', swaggerUi.serve);
    router.get('/docs', swaggerUi.setup(swaggerSpec, {
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
