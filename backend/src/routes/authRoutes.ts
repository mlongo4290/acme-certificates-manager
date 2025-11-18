import { Router } from 'express';
import passport from 'passport';
import { forgotPassword, login, resetPassword, verifyMfaLogin } from '../controllers/authController';
import { generateToken } from '../middleware/auth';
import { AuthProvider } from '../models/AuthProvider';
import { Logger } from '../services/logger.service';

const router = Router();
const logger = new Logger('AuthRoutes');

router.post('/login', login);
router.post('/verify-mfa', verifyMfaLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// OAuth2 authentication routes
router.get('/oauth2/:providerSlug', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'oauth2', enabled: true });
    if (!provider) {
        return res.status(404).json({ message: 'Provider not found' });
    }

    passport.authenticate(`oauth2-${provider.name}`)(req, res, next);
});

router.get('/oauth2/:providerSlug/callback', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'oauth2', enabled: true });
    if (!provider) {
        logger.error(`OAuth2 callback: Provider not found for slug: ${providerSlug}`, new Error('Provider not found'));
        return res.redirect(`http://localhost:4200/auth/login?error=provider_not_found`);
    }

    logger.debug(`OAuth2 callback: Processing authentication for provider: ${provider.name}`);

    passport.authenticate(`oauth2-${provider.name}`, (err: any, user: any, info: any) => {
        if (err) {
            logger.error('OAuth2 authentication error:', err as Error);
            return res.redirect(`http://localhost:4200/auth/login?error=oauth2_auth_error`);
        }

        if (!user) {
            logger.error(`OAuth2 authentication failed - no user returned. Info: ${JSON.stringify(info)}`, new Error('No user'));
            return res.redirect(`http://localhost:4200/auth/login?error=oauth2_no_user`);
        }

        logger.debug(`OAuth2 authentication successful for user: ${user.username}`);

        const token = generateToken({
            userId: user._id.toString(),
            username: user.username,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            role: user.role
        });

        // Redirect to frontend with token
        res.redirect(`http://localhost:4200/auth/login?token=${token}`);
    })(req, res, next);
});

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
        return res.redirect(`http://localhost:4200/auth/login?error=provider_not_found`);
    }

    logger.debug(`Azure AD callback: Processing authentication for provider: ${provider.name}`);

    passport.authenticate(`azure-${provider.name}`, (err: any, user: any, info: any) => {
        if (err) {
            logger.error('Azure AD authentication error:', err as Error);
            return res.redirect(`http://localhost:4200/auth/login?error=azure_auth_error`);
        }

        if (!user) {
            logger.error(`Azure AD authentication failed - no user returned. Info: ${JSON.stringify(info)}`, new Error('No user'));
            return res.redirect(`http://localhost:4200/auth/login?error=azure_no_user`);
        }

        logger.debug(`Azure AD authentication successful for user: ${user.username}`);

        const token = generateToken({
            userId: user._id.toString(),
            username: user.username,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            role: user.role
        });

        // Redirect to frontend with token
        res.redirect(`http://localhost:4200/auth/login?token=${token}`);
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
        scope: provider.settings.oidc?.scopes || ['openid', 'profile', 'email']
    })(req, res, next);
});

router.get('/oidc/:providerSlug/callback', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'oidc', enabled: true });
    if (!provider) {
        logger.error(`OIDC callback: Provider not found for slug: ${providerSlug}`, new Error('Provider not found'));
        return res.redirect(`http://localhost:4200/auth/login?error=provider_not_found`);
    }

    logger.debug(`OIDC callback: Processing authentication for provider: ${provider.name}`);

    passport.authenticate(`oidc-${provider.name}`, (err: any, user: any, info: any) => {
        if (err) {
            logger.error('OIDC authentication error:', err as Error);
            return res.redirect(`http://localhost:4200/auth/login?error=oidc_auth_error`);
        }

        if (!user) {
            logger.error(`OIDC authentication failed - no user returned. Info: ${JSON.stringify(info)}`, new Error('No user'));
            return res.redirect(`http://localhost:4200/auth/login?error=oidc_no_user`);
        }

        logger.debug(`OIDC authentication successful for user: ${user.username}`);

        const token = generateToken({
            userId: user._id.toString(),
            username: user.username,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            role: user.role
        });

        res.redirect(`http://localhost:4200/auth/login?token=${token}`);
    })(req, res, next);
});

// SAML authentication routes
router.get('/saml/:providerSlug', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'saml', enabled: true });
    if (!provider) {
        return res.status(404).json({ message: 'Provider not found' });
    }

    passport.authenticate(`saml-${provider.name}`)(req, res, next);
});

router.post('/saml/:providerSlug/callback', async (req, res, next) => {
    const { providerSlug } = req.params;

    const provider = await AuthProvider.findOne({ slug: providerSlug, type: 'saml', enabled: true });
    if (!provider) {
        logger.error(`SAML callback: Provider not found for slug: ${providerSlug}`, new Error('Provider not found'));
        return res.redirect(`http://localhost:4200/auth/login?error=provider_not_found`);
    }

    logger.debug(`SAML callback: Processing authentication for provider: ${provider.name}`);

    passport.authenticate(`saml-${provider.name}`, (err: any, user: any, info: any) => {
        if (err) {
            logger.error('SAML authentication error:', err as Error);
            return res.redirect(`http://localhost:4200/auth/login?error=saml_auth_error`);
        }

        if (!user) {
            logger.error(`SAML authentication failed - no user returned. Info: ${JSON.stringify(info)}`, new Error('No user'));
            return res.redirect(`http://localhost:4200/auth/login?error=saml_no_user`);
        }

        logger.debug(`SAML authentication successful for user: ${user.username}`);

        const token = generateToken({
            userId: user._id.toString(),
            username: user.username,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            role: user.role
        });

        res.redirect(`http://localhost:4200/auth/login?token=${token}`);
    })(req, res, next);
});

export default router;
