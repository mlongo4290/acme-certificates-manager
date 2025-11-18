import express from 'express';
import { CertificateController } from '../../controllers/certificate.controller';
import { authOrApiToken } from '../../middleware/auth';

export const createV1CertificateRouter = (controller: CertificateController) => {
    const router = express.Router();

    /**
     * @swagger
     * /certificates:
     *   get:
     *     summary: Get all certificates
     *     description: Retrieve a list of all SSL/TLS certificates
     *     tags: [Certificates]
     *     security:
     *       - bearerAuth: []
     *       - apiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 0
     *         description: Page number for pagination
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of items per page
     *       - in: query
     *         name: sortField
     *         schema:
     *           type: string
     *         description: Field to sort by
     *       - in: query
     *         name: sortOrder
     *         schema:
     *           type: integer
     *           enum: [1, -1]
     *         description: Sort order (1 for ascending, -1 for descending)
     *     responses:
     *       200:
     *         description: List of certificates
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Certificate'
     *                 totalRecords:
     *                   type: integer
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/',
        authOrApiToken as any,
        controller.getAllCertificates
    );

    /**
     * @swagger
     * /certificates/stats:
     *   get:
     *     summary: Get certificate statistics
     *     description: Retrieve statistics about certificates (total, valid, expiring, expired)
     *     tags: [Certificates]
     *     security:
     *       - bearerAuth: []
     *       - apiKeyAuth: []
     *     responses:
     *       200:
     *         description: Certificate statistics
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 total:
     *                   type: integer
     *                 valid:
     *                   type: integer
     *                 expiringSoon:
     *                   type: integer
     *                 expired:
     *                   type: integer
     */
    router.get('/stats',
        authOrApiToken as any,
        controller.getCertificatesStats
    );

    /**
     * @swagger
     * /certificates/{id}:
     *   get:
     *     summary: Get certificate by ID
     *     description: Retrieve detailed information about a specific certificate
     *     tags: [Certificates]
     *     security:
     *       - bearerAuth: []
     *       - apiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Certificate ID
     *     responses:
     *       200:
     *         description: Certificate details
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Certificate'
     *       404:
     *         description: Certificate not found
     */
    router.get('/:id',
        authOrApiToken as any,
        controller.getCertificateById
    );

    /**
     * @swagger
     * /certificates:
     *   post:
     *     summary: Create a new certificate
     *     description: Create a new SSL/TLS certificate configuration
     *     tags: [Certificates]
     *     security:
     *       - bearerAuth: []
     *       - apiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - domain
     *               - challengeType
     *               - certificateAuthority
     *               - acmeAccount
     *             properties:
     *               domain:
     *                 type: string
     *                 example: example.com
     *               additionalDomains:
     *                 type: array
     *                 items:
     *                   type: string
     *                 example: ['www.example.com']
     *               challengeType:
     *                 type: string
     *                 enum: [http-01, dns-01, tls-alpn-01]
     *               certificateAuthority:
     *                 type: string
     *                 description: CA ID
     *               acmeAccount:
     *                 type: string
     *                 description: ACME Account ID
     *               dnsProvider:
     *                 type: string
     *                 description: DNS Provider ID (required for dns-01)
     *               autoRenewal:
     *                 type: boolean
     *                 default: false
     *     responses:
     *       201:
     *         description: Certificate created successfully
     *       400:
     *         description: Invalid input
     */
    router.post('/',
        authOrApiToken as any,
        controller.createCertificate
    );

    /**
     * @swagger
     * /certificates/{id}:
     *   patch:
     *     summary: Update certificate
     *     description: Update certificate configuration
     *     tags: [Certificates]
     *     security:
     *       - bearerAuth: []
     *       - apiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *     responses:
     *       200:
     *         description: Certificate updated
     *       404:
     *         description: Certificate not found
     */
    router.patch('/:id',
        authOrApiToken as any,
        controller.updateCertificate
    );

    /**
     * @swagger
     * /certificates/{id}:
     *   delete:
     *     summary: Delete certificate
     *     description: Delete a certificate permanently
     *     tags: [Certificates]
     *     security:
     *       - bearerAuth: []
     *       - apiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Certificate deleted
     *       404:
     *         description: Certificate not found
     */
    router.delete('/:id',
        authOrApiToken as any,
        controller.deleteCertificate
    );

    /**
     * @swagger
     * /certificates/{id}/download/{type}:
     *   get:
     *     summary: Download certificate files
     *     description: Download certificate, private key, or chain
     *     tags: [Certificates]
     *     security:
     *       - bearerAuth: []
     *       - apiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: type
     *         required: true
     *         schema:
     *           type: string
     *           enum: [certificate, privateKey, fullChain]
     *     responses:
     *       200:
     *         description: File downloaded
     *         content:
     *           application/x-pem-file:
     *             schema:
     *               type: string
     *       404:
     *         description: Certificate not found
     */
    router.get('/:id/download/:type',
        authOrApiToken as any,
        controller.downloadCertificate
    );

    return router;
};
