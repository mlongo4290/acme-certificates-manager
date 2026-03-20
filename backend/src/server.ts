import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { connect } from 'mongoose';
import passport from 'passport';
import session from 'express-session';

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

import { initializePassport } from './config/passport';
import { seedInitialData } from './seed';
import { AgendaController } from './controllers/agenda.controller';
import { CertificateController } from './controllers/certificate.controller';
import { JobController } from './controllers/job.controller';
import { DnsProviderController } from './controllers/dnsProvider.controller';
import { authMiddleware, requireAdmin } from './middleware/auth';
import roleRoutes from './routes/roleRoutes';
import acmeAccountRoutes from './routes/acmeAccountRoutes';
import acmeCaRoutes from './routes/acmeCaRoutes';
import activityLogRoutes from './routes/activityLog.routes';
import adminUserRoutes from './routes/adminUserRoutes';
import { createAgendaRoutes } from './routes/agenda.routes';
import apiTokenRoutes from './routes/apiTokenRoutes';
import authProviderRoutes from './routes/authProviderRoutes';
import authRoutes from './routes/authRoutes';
import { createCertificateRouter } from './routes/certificate.routes';
import { createJobRouter } from './routes/job.routes';
import { createDnsProviderRouter } from './routes/dnsProvider.routes';
import notificationLogRoutes from './routes/notificationLog.routes';
import postIssueScriptRoutes from './routes/postIssueScript.routes';
import sshKeyRoutes from './routes/sshKey.routes';
import userRoutes from './routes/userRoutes';
import webhookRoutes from './routes/webhook.routes';
import configExportRoutes from './routes/configExport.routes';
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
app.use(express.urlencoded({ extended: true })); // Required for SAML POST binding

// Session middleware — required by OIDC/SAML for state/nonce during the redirect flow.
// The app uses JWT for auth; this session is transient and only lives during the OAuth handshake.
app.use(session({
    secret: process.env.JWT_SECRET || 'acm-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 5 * 60 * 1000 }
}));

// Initialize services
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/acme-certificates-manager';
logger.info(`Connecting to MongoDB at: ${mongoUri}`);
connect(mongoUri)
    .then(async () => {
        logger.info('MongoDB connected successfully');
        await seedInitialData();
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
const jobController = new JobController();
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
app.use('/api/jobs', createJobRouter(jobController));
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/agenda', createAgendaRoutes(agendaController));

// Post-issue script management
app.use('/api/post-issue-scripts', postIssueScriptRoutes);

// SSH key management
app.use('/api/ssh-keys', sshKeyRoutes);

// Notification logs
app.use('/api/notification-logs', notificationLogRoutes);

// Webhooks
app.use('/api/webhooks', webhookRoutes);

// Config export/import
app.use('/api/config', configExportRoutes);

// Roles (admin only)
app.use('/api/roles', authMiddleware as any, requireAdmin as any, roleRoutes);

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