import { Router } from 'express';
import passport from 'passport';
import { forgotPassword, login, resetPassword, verifyMfaLogin } from '../controllers/authController';
import { buildRolePermissions } from '../controllers/authController';
import { generateToken } from '../middleware/auth';
import { AuthProvider } from '../models/AuthProvider';
import { Logger } from '../services/logger.service';

const router = Router();
const logger = new Logger('AuthRoutes');
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');

router.post('/login', login);
router.post('/verify-mfa', verifyMfaLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Azure AD authentication routes
router.get('/azure-ad/:providerSlug', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'azure-ad', enabled: true });
    if (!provider) {
        return res.status(404).json({ message: 'Provider not found' });
    }

    passport.authenticate(`azure-${provider.name}`, {
        scope: ['openid', 'profile', 'email', 'User.Read']
    })(req, res, next);
});

router.get('/azure-ad/:providerSlug/callback', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'azure-ad', enabled: true });
    if (!provider) {
        logger.error(`Azure AD callback: Provider not found for slug: ${providerSlug}`, new Error('Provider not found'));
        return res.redirect(`${FRONTEND_URL}/auth/login?error=provider_not_found`);
    }

    logger.debug(`Azure AD callback: Processing authentication for provider: ${provider.name}`);

    passport.authenticate(`azure-${provider.name}`, async (err: any, user: any, info: any) => {
        if (err) {
            logger.error('Azure AD authentication error:', err as Error);
            return res.redirect(`${FRONTEND_URL}/auth/login?error=azure_auth_error`);
        }

        if (!user) {
            logger.error(`Azure AD authentication failed - no user returned. Info: ${JSON.stringify(info)}`, new Error('No user'));
            return res.redirect(`${FRONTEND_URL}/auth/login?error=azure_no_user`);
        }

        logger.debug(`Azure AD authentication successful for user: ${user.username}`);

        const { isAdmin, permissions } = await buildRolePermissions(user);

        const token = generateToken({
            userId: user._id.toString(),
            username: user.username,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            isAdmin,
            permissions
        });

        // Redirect to frontend with token
        res.redirect(`${FRONTEND_URL}/auth/login?token=${token}`);
    })(req, res, next);
});

// OIDC authentication routes
router.get('/oidc/:providerSlug', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'oidc', enabled: true });
    if (!provider) {
        return res.status(404).json({ message: 'Provider not found' });
    }

    passport.authenticate(`oidc-${provider.name}`, {
        scope: ['openid', 'profile', 'email']
    })(req, res, next);
});

router.get('/oidc/:providerSlug/callback', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'oidc', enabled: true });
    if (!provider) {
        logger.error(`OIDC callback: Provider not found for slug: ${providerSlug}`, new Error('Provider not found'));
        return res.redirect(`${FRONTEND_URL}/auth/login?error=provider_not_found`);
    }

    logger.debug(`OIDC callback: Processing authentication for provider: ${provider.name}`);

    passport.authenticate(`oidc-${provider.name}`, async (err: any, user: any, info: any) => {
        if (err) {
            logger.error('OIDC authentication error:', err as Error);
            return res.redirect(`${FRONTEND_URL}/auth/login?error=oidc_auth_error`);
        }

        if (!user) {
            logger.error(`OIDC authentication failed - no user returned. Info: ${JSON.stringify(info)}`, new Error('No user'));
            return res.redirect(`${FRONTEND_URL}/auth/login?error=oidc_no_user`);
        }

        logger.debug(`OIDC authentication successful for user: ${user.username}`);

        const { isAdmin, permissions } = await buildRolePermissions(user);

        const token = generateToken({
            userId: user._id.toString(),
            username: user.username,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            isAdmin,
            permissions
        });

        res.redirect(`${FRONTEND_URL}/auth/login?token=${token}`);
    })(req, res, next);
});

export default router;
