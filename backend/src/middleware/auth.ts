import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiToken, compareToken } from '../models/ApiToken';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface JWTPayload {
    userId: string;
    username: string;
    authProvider: 'local' | 'ldap' | 'oauth2' | 'azure-ad' | 'oidc' | 'saml';
    authProviderName?: string;
    role: 'ADMIN' | 'CERT_MANAGER' | 'READ_ONLY';
}

export interface AuthRequest extends Request {
    user?: JWTPayload;
    apiToken?: {
        tokenId: string;
        userId: string;
        userRole: 'ADMIN' | 'CERT_MANAGER' | 'READ_ONLY';
    };
}

export const generateToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload => {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        (req as AuthRequest).user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export const authenticate = authMiddleware;

/**
 * Auth middleware for SSE endpoints that accept token as query parameter
 * (EventSource doesn't support custom headers)
 */
export const sseAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Try to get token from query parameter first (for SSE)
        let token = req.query.token as string;

        // Fallback to Authorization header
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!(req as AuthRequest).user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Import User model dynamically to avoid circular dependencies
        const { User } = await import('../models/User');
        const user = await User.findById((req as AuthRequest).user!.userId);

        if (!user || user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
};

export const requireAdminOrCertManager = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!(req as AuthRequest).user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Import User model dynamically to avoid circular dependencies
        const { User } = await import('../models/User');
        const user = await User.findById((req as AuthRequest).user!.userId);

        if (!user || (user.role !== 'ADMIN' && user.role !== 'CERT_MANAGER')) {
            return res.status(403).json({ message: 'Access denied. Certificate management privileges required.' });
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Middleware for API token authentication
 * Checks for Bearer token in Authorization header (format: Bearer <token>)
 * or X-API-Key header
 */
export const apiTokenAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Try to get token from Authorization header (Bearer <token>) or X-API-Key header
        let token: string | undefined;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (req.headers['x-api-key']) {
            token = req.headers['x-api-key'] as string;
        }

        if (!token) {
            return res.status(401).json({ message: 'No API token provided' });
        }

        // Find all active tokens
        const apiTokens = await ApiToken.find({ isActive: true }).populate('userId');

        // Check each token until we find a match
        let matchedToken = null;
        for (const apiToken of apiTokens) {
            const isMatch = await compareToken(token, apiToken.tokenHash);
            if (isMatch) {
                matchedToken = apiToken;
                break;
            }
        }

        if (!matchedToken) {
            return res.status(401).json({ message: 'Invalid API token' });
        }

        // Check if token is expired
        if (matchedToken.expiresAt && new Date() > matchedToken.expiresAt) {
            return res.status(401).json({ message: 'API token expired' });
        }

        // Update last used timestamp
        matchedToken.lastUsedAt = new Date();
        await matchedToken.save();

        // Get user details
        const user = await User.findById(matchedToken.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'User account is not active' });
        }

        // Set API token info on request
        req.apiToken = {
            tokenId: (matchedToken._id as any).toString(),
            userId: (user._id as any).toString(),
            userRole: user.role
        };

        // Also set user info for compatibility with existing middleware
        req.user = {
            userId: (user._id as any).toString(),
            username: user.username,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName ? user.authProviderName : undefined,
            role: user.role
        };

        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid API token' });
    }
};

/**
 * Combined middleware that accepts both JWT and API tokens
 */
export const authOrApiToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Try JWT first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        try {
            // Try to verify as JWT first
            const decoded = verifyToken(token);
            req.user = decoded;
            return next();
        } catch (error) {
            // If JWT fails, continue to try as API token
        }
    }

    // Try API token
    return apiTokenAuth(req, res, next);
};

