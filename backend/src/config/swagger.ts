import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ACME Certificate Manager API',
            version: '1.0.0',
            description: 'REST API for managing ACME SSL/TLS certificates, DNS providers, and certificate authorities',
        },
        servers: [
            {
                url: '/api/v1',
                description: 'API v1'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token for web session authentication'
                },
                apiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                    description: 'API token for programmatic access'
                }
            },
            schemas: {
                Certificate: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        domain: { type: 'string', example: 'example.com' },
                        additionalDomains: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['www.example.com', '*.example.com']
                        },
                        challengeType: {
                            type: 'string',
                            enum: ['http-01', 'dns-01', 'tls-alpn-01'],
                            example: 'dns-01'
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'valid', 'invalid', 'expired'],
                            example: 'valid'
                        },
                        certificateAuthority: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        acmeAccount: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        dnsProvider: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        expiryDate: { type: 'string', format: 'date-time' },
                        issueDate: { type: 'string', format: 'date-time' },
                        autoRenewal: { type: 'boolean', example: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                DnsProvider: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string', example: 'Cloudflare Production' },
                        providerType: { type: 'string', example: 'cloudflare' },
                        description: { type: 'string' },
                        enabled: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                AcmeCA: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string', example: "Let's Encrypt Production" },
                        server: { type: 'string', example: 'https://acme-v02.api.letsencrypt.org/directory' },
                        accountEmail: { type: 'string', example: 'admin@example.com' },
                        isDefault: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                ApiToken: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string', example: 'Production API Token' },
                        scopes: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['certificates:read', 'certificates:write']
                        },
                        expiresAt: { type: 'string', format: 'date-time' },
                        lastUsedAt: { type: 'string', format: 'date-time' },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                }
            }
        },
        security: [
            { bearerAuth: [] },
            { apiKeyAuth: [] }
        ]
    },
    apis: ['./src/routes/v1/*.ts'], // Path to API route files with JSDoc comments
};

export const swaggerSpec = swaggerJsdoc(options);
