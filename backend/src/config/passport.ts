import { authenticate } from 'ldap-authentication';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { AuthProvider } from '../models/AuthProvider';
import { comparePassword, User } from '../models/User';
import { Logger } from '../services/logger.service';
const CustomStrategy = require('passport-custom').Strategy;
const OpenIDConnectStrategy = require('passport-openidconnect').Strategy;

const logger = new Logger('Passport');

// Initialize passport strategies based on enabled providers
export const initializePassport = async () => {
    // Remove all existing strategies except 'session'
    const strategyNames = Object.keys((passport as any)._strategies);
    strategyNames.forEach(name => {
        if (name !== 'session') {
            passport.unuse(name);
        }
    });

    const enabledProviders = await AuthProvider.find({ enabled: true }).sort({ priority: 1 });

    for (const provider of enabledProviders) {
        switch (provider.type) {
            case 'local':
                configureLocalStrategy();
                break;
            case 'ldap':
                configureLdapStrategy(provider);
                break;
            case 'oauth2':
                configureOAuth2Strategy(provider);
                break;
            case 'azure-ad':
                configureAzureADStrategy(provider);
                break;
            case 'oidc':
                configureOIDCStrategy(provider);
                break;
            case 'saml':
                configureSAMLStrategy(provider);
                break;
        }
    }

    logger.info(`Initialized ${enabledProviders.length} authentication strategies`);
};

// Local strategy (username/password against User model)
const configureLocalStrategy = () => {
    passport.use('local', new LocalStrategy(
        {
            usernameField: 'username',
            passwordField: 'password'
        },
        async (username, password, done) => {
            try {
                const user = await User.findOne({ username: username.toLowerCase() });

                if (!user) {
                    return done(null, false, { message: 'Invalid credentials' });
                }

                const isValid = await comparePassword(password, user.password);

                if (!isValid) {
                    return done(null, false, { message: 'Invalid credentials' });
                }

                return done(null, user);
            } catch (error) {
                return done(error);
            }
        }
    ));
};

// LDAP strategy
const configureLdapStrategy = (provider: any) => {
    const ldapSettings = provider.settings.ldap;

    if (!ldapSettings || !ldapSettings.servers || ldapSettings.servers.length === 0) {
        logger.warn(`LDAP provider ${provider.name} is missing required configuration (servers)`);
        return;
    }

    logger.debug(`Configuring LDAP provider ${provider.name} with servers: ${ldapSettings.servers}`);

    const servers = ldapSettings.servers; // For TypeScript null checking

    passport.use(`ldap-${provider.name}`, new CustomStrategy(
        async (req: any, done: any) => {
            try {
                const username = req.body.username;
                const password = req.body.password;

                if (!username || !password) {
                    return done(null, false, { message: 'Username and password are required' });
                }

                // Build LDAP authentication options
                const ldapOptions: any = {
                    ldapOpts: {
                        url: servers[0], // Use first server
                    },
                    userDn: ldapSettings.bindDN,
                    userPassword: ldapSettings.bindCredentials,
                    userSearchBase: ldapSettings.searchBase || '',
                    usernameAttribute: ldapSettings.usernameField || 'uid',
                    username: username,
                    password: password,
                };

                // Handle LDAPS and TLS options
                const isLdaps = servers.some((url: string) => url.startsWith('ldaps://'));
                if (isLdaps) {
                    const tlsRejectUnauthorized = ldapSettings.tlsRejectUnauthorized !== false;
                    ldapOptions.ldapOpts.tlsOptions = {
                        rejectUnauthorized: tlsRejectUnauthorized
                    };

                    if (tlsRejectUnauthorized && ldapSettings.tlsCaCert) {
                        ldapOptions.ldapOpts.tlsOptions.ca = [Buffer.from(ldapSettings.tlsCaCert)];
                    }

                    if (!tlsRejectUnauthorized) {
                        logger.warn(`LDAP provider ${provider.name} is configured to accept untrusted certificates. This should only be used in development!`);
                    }
                }

                // Authenticate against LDAP
                const ldapUser = await authenticate(ldapOptions);

                if (!ldapUser) {
                    return done(null, false, { message: 'Invalid LDAP credentials' });
                }

                // Find or create user
                const usernameField = ldapSettings.usernameField || 'uid';
                const emailField = ldapSettings.emailField || 'mail';
                const ldapUsername = ldapUser[usernameField] || ldapUser.uid || ldapUser.cn;
                const ldapEmail = ldapUser[emailField] || ldapUser.mail || ldapUser.email;

                let user = await User.findOne({ username: ldapUsername.toLowerCase() });

                if (!user) {
                    // Create new user from LDAP
                    user = new User({
                        username: ldapUsername.toLowerCase(),
                        email: ldapEmail || `${ldapUsername}@ldap`,
                        password: Math.random().toString(36), // Random password, won't be used
                        authProvider: 'ldap',
                        authProviderName: provider.name
                    });
                    await user.save();
                } else {
                    // Update email if it changed in LDAP
                    if (ldapEmail && user.email !== ldapEmail) {
                        user.email = ldapEmail;
                        await user.save();
                    }
                }

                return done(null, user);
            } catch (error: any) {
                logger.error(`LDAP authentication error for ${provider.name}: ${error.message}`);
                return done(null, false, { message: 'LDAP authentication failed' });
            }
        }
    ));
};

// Generic OAuth2 strategy
const configureOAuth2Strategy = (provider: any) => {
    if (!provider.settings.oauth2) {
        logger.warn(`OAuth2 provider ${provider.name} is missing required configuration`);
        return;
    }

    const strategy = new OAuth2Strategy(
        {
            authorizationURL: provider.settings.oauth2.authorizationURL || '',
            tokenURL: provider.settings.oauth2.tokenURL || '',
            clientID: provider.settings.oauth2.clientID || '',
            clientSecret: provider.settings.oauth2.clientSecret || '',
            callbackURL: provider.settings.oauth2.callbackURL || '',
            scope: provider.settings.oauth2.scopes || []
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {
            try {
                // Fetch user info from userInfoURL if provided
                if (provider.settings.oauth2?.userInfoURL) {
                    const response = await fetch(provider.settings.oauth2.userInfoURL, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });

                    if (!response.ok) {
                        logger.error(`Failed to fetch user profile from OAuth2 provider: ${response.statusText}`, new Error(response.statusText));
                        return done(new Error('Failed to fetch user profile'));
                    }

                    const userInfo = await response.json();
                    logger.debug(`OAuth2 user info: ${JSON.stringify(userInfo)}`);

                    // Try common username fields
                    const username = (userInfo as any).username ||
                        (userInfo as any).email ||
                        (userInfo as any).login ||
                        (userInfo as any).id;

                    if (!username) {
                        logger.error(`No username found in OAuth2 profile: ${JSON.stringify(userInfo)}`, new Error('No username'));
                        return done(new Error('No username in OAuth2 profile'));
                    }

                    let user = await User.findOne({ username: username.toLowerCase() });

                    if (!user) {
                        user = new User({
                            username: username.toLowerCase(),
                            password: Math.random().toString(36),
                            authProvider: 'oauth2',
                            authProviderName: provider.name
                        });
                        await user.save();
                        logger.info(`Created new user from OAuth2: ${username}`);
                    }

                    return done(null, user);
                } else {
                    // Fallback to profile if no userInfoURL
                    const username = profile.username || profile.email || profile.id;
                    if (!username) {
                        return done(new Error('No username in OAuth2 profile'));
                    }

                    let user = await User.findOne({ username: username.toLowerCase() });

                    if (!user) {
                        user = new User({
                            username: username.toLowerCase(),
                            password: Math.random().toString(36),
                            authProvider: 'oauth2',
                            authProviderName: provider.name
                        });
                        await user.save();
                    }

                    return done(null, user);
                }
            } catch (error) {
                logger.error('OAuth2 authentication error:', error as Error);
                return done(error);
            }
        }
    );

    passport.use(`oauth2-${provider.name}`, strategy);
};

// Azure AD / Microsoft 365 strategy
const configureAzureADStrategy = (provider: any) => {
    if (!provider.settings.azureAd) {
        logger.warn(`Azure AD provider ${provider.name} is missing required configuration`);
        return;
    }

    const strategy = new OAuth2Strategy(
        {
            authorizationURL: `https://login.microsoftonline.com/${provider.settings.azureAd.tenantID}/oauth2/v2.0/authorize`,
            tokenURL: `https://login.microsoftonline.com/${provider.settings.azureAd.tenantID}/oauth2/v2.0/token`,
            clientID: provider.settings.azureAd.clientID || '',
            clientSecret: provider.settings.azureAd.clientSecret || '',
            callbackURL: provider.settings.azureAd.callbackURL || '',
            scope: ['openid', 'profile', 'email', 'User.Read']
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {
            try {
                // Fetch user info from Microsoft Graph
                const response = await fetch('https://graph.microsoft.com/v1.0/me', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (!response.ok) {
                    logger.error(`Failed to fetch user profile from Microsoft Graph: ${response.statusText}`, new Error(response.statusText));
                    return done(new Error('Failed to fetch user profile'));
                }

                const userInfo = await response.json();
                logger.debug(`Azure AD user info: ${JSON.stringify(userInfo)}`);

                const username = (userInfo as any).userPrincipalName || (userInfo as any).mail || (userInfo as any).id;
                if (!username) {
                    logger.error(`No username found in Azure AD profile: ${JSON.stringify(userInfo)}`, new Error('No username'));
                    return done(new Error('No username in Azure AD profile'));
                }

                let user = await User.findOne({ username: username.toLowerCase() });

                if (!user) {
                    user = new User({
                        username: username.toLowerCase(),
                        password: Math.random().toString(36),
                        authProvider: 'azure-ad',
                        authProviderName: provider.name
                    });
                    await user.save();
                    logger.info(`Created new user from Azure AD: ${username}`);
                }

                return done(null, user);
            } catch (error) {
                logger.error('Azure AD authentication error:', error as Error);
                return done(error);
            }
        }
    );

    passport.use(`azure-${provider.name}`, strategy);
};

// OIDC (OpenID Connect) strategy
const configureOIDCStrategy = (provider: any) => {
    if (!provider.settings.oidc) {
        logger.warn(`OIDC provider ${provider.name} is missing required configuration`);
        return;
    }

    const strategy = new OpenIDConnectStrategy(
        {
            issuer: provider.settings.oidc.issuerURL || '',
            clientID: provider.settings.oidc.clientID || '',
            clientSecret: provider.settings.oidc.clientSecret || '',
            callbackURL: provider.settings.oidc.callbackURL || '',
            authorizationURL: `${provider.settings.oidc.issuerURL}/protocol/openid-connect/auth`,
            tokenURL: `${provider.settings.oidc.issuerURL}/protocol/openid-connect/token`,
            userInfoURL: `${provider.settings.oidc.issuerURL}/protocol/openid-connect/userinfo`,
            scope: provider.settings.oidc.scopes || ['openid', 'profile', 'email']
        },
        async (issuer: any, profile: any, done: any) => {
            try {
                logger.debug(`OIDC profile: ${JSON.stringify(profile)}`);

                // Extract username from OIDC profile
                const username = profile.emails?.[0]?.value ||
                    profile.username ||
                    profile.preferred_username ||
                    profile.id;

                if (!username) {
                    logger.error(`No username found in OIDC profile: ${JSON.stringify(profile)}`, new Error('No username'));
                    return done(new Error('No username in OIDC profile'));
                }

                let user = await User.findOne({ username: username.toLowerCase() });

                if (!user) {
                    user = new User({
                        username: username.toLowerCase(),
                        password: Math.random().toString(36),
                        authProvider: 'oidc',
                        authProviderName: provider.name
                    });
                    await user.save();
                    logger.info(`Created new user from OIDC: ${username}`);
                }

                return done(null, user);
            } catch (error) {
                logger.error('OIDC authentication error:', error as Error);
                return done(error);
            }
        }
    );

    passport.use(`oidc-${provider.name}`, strategy);
};

// SAML 2.0 strategy
const configureSAMLStrategy = (provider: any) => {
    if (!provider.settings.saml) {
        logger.warn(`SAML provider ${provider.name} is missing required configuration`);
        return;
    }
    return;
};

// Get list of enabled auth providers for frontend
export const getEnabledProviders = async () => {
    return await AuthProvider.find({ enabled: true }).sort({ priority: 1 }).select('name type priority');
};
