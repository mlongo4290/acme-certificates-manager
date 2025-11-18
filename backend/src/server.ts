import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { connect } from 'mongoose';
import passport from 'passport';

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

import { initializePassport } from './config/passport';
import { AgendaController } from './controllers/agenda.controller';
import { CertificateController } from './controllers/certificate.controller';
import { DnsProviderController } from './controllers/dnsProvider.controller';
import { authMiddleware } from './middleware/auth';
import acmeAccountRoutes from './routes/acmeAccountRoutes';
import acmeCaRoutes from './routes/acmeCaRoutes';
import activityLogRoutes from './routes/activityLog.routes';
import adminUserRoutes from './routes/adminUserRoutes';
import { createAgendaRoutes } from './routes/agenda.routes';
import apiTokenRoutes from './routes/apiTokenRoutes';
import authProviderRoutes from './routes/authProviderRoutes';
import authRoutes from './routes/authRoutes';
import { createCertificateRouter } from './routes/certificate.routes';
import { createDnsProviderRouter } from './routes/dnsProvider.routes';
import postIssueScriptRoutes from './routes/postIssueScript.routes';
import sshKeyRoutes from './routes/sshKey.routes';
import userRoutes from './routes/userRoutes';
import { createV1Router } from './routes/v1Router';
import { AcmeService } from './services/acme.service';
import { AgendaService } from './services/agenda.service';
import { CertificateService } from './services/certificate.service';
import { Logger } from './services/logger.service';

const app = express();
const logger = new Logger('Server');

app.set('trust proxy', true);

app.use(cors());
app.use(helmet());
app.use(express.json());

// Initialize services
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/acme-certificates-manager';
logger.info(`Connecting to MongoDB at: ${mongoUri}`);
connect(mongoUri)
    .then(async () => {
        logger.info('MongoDB connected successfully');
        // Initialize Passport strategies after MongoDB connection
        await initializePassport();
        logger.info('Passport strategies initialized');
    })
    .catch(err => logger.error('MongoDB connection error:', err as Error));

const acmeService = new AcmeService();

// Initialize scheduler first (without certificateService yet)
const schedulerService = new AgendaService(
    mongoUri,
    async (certificateId: string) => {
        // This callback will be set up after certificateService is created
        await certificateService.renewCertificate(certificateId);
    }
);

// Initialize certificate service with scheduler
const certificateService = new CertificateService(acmeService, schedulerService);

// Start the scheduler
schedulerService.start();

// Initialize controller
const certificateController = new CertificateController(certificateService, schedulerService);
const dnsProviderController = new DnsProviderController();
const agendaController = new AgendaController(schedulerService);

// Initialize Passport
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/providers', authProviderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/api-tokens', apiTokenRoutes);
app.use('/api/acme-ca', acmeCaRoutes);
app.use('/api/acme-accounts', acmeAccountRoutes);
app.use('/api/dns-providers', authMiddleware as any, createDnsProviderRouter(dnsProviderController));
// Certificate routes handle auth internally (some endpoints like SSE need special auth)
app.use('/api/certificates', createCertificateRouter(certificateController));
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/agenda', createAgendaRoutes(agendaController));

// Post-issue script management
app.use('/api/post-issue-scripts', postIssueScriptRoutes);

// SSH key management
app.use('/api/ssh-keys', sshKeyRoutes);

// API v1 - REST API with Swagger documentation
app.use('/api/v1', createV1Router(certificateController, dnsProviderController));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Request error:', err as Error);
    res.status(500).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
});