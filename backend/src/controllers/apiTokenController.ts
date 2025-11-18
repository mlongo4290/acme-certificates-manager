import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ApiToken, generateApiToken } from '../models/ApiToken';
import { User } from '../models/User';
import { Logger } from '../services/logger.service';

const logger = new Logger('ApiTokenController');

// Available scopes based on user role
const SCOPE_DEFINITIONS = {
    READ_ONLY: [
        'certificates:read',
        'dns-providers:read',
        'acme-ca:read',
        'acme-accounts:read',
        'activity-logs:read'
    ],
    CERT_MANAGER: [
        'certificates:read',
        'certificates:write',
        'certificates:issue',
        'dns-providers:read',
        'dns-providers:write',
        'acme-ca:read',
        'acme-accounts:read',
        'acme-accounts:write',
        'activity-logs:read'
    ],
    ADMIN: ['*'] // Full access
};

// Get all API tokens for the current user
export const getTokens = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        const tokens = await ApiToken.find({ userId, isActive: true })
            .select('-tokenHash')
            .sort({ createdAt: -1 });

        res.json(tokens);
    } catch (error) {
        logger.error('Error fetching API tokens:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create a new API token
export const createToken = async (req: AuthRequest, res: Response) => {
    try {
        const { name, scopes, expiresInDays } = req.body;
        const userId = req.user!.userId;

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Token name is required' });
        }

        // Get user to determine allowed scopes
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Determine allowed scopes based on user role
        const allowedScopes = SCOPE_DEFINITIONS[user.role] || [];

        // Validate requested scopes
        let tokenScopes = scopes || allowedScopes;

        if (user.role !== 'ADMIN') {
            // Non-admin users can only request scopes they're allowed
            tokenScopes = tokenScopes.filter((scope: string) => allowedScopes.includes(scope));

            if (tokenScopes.length === 0) {
                return res.status(400).json({ message: 'No valid scopes provided' });
            }
        }

        // Generate the actual token
        const rawToken = generateApiToken();

        // Calculate expiration
        let expiresAt: Date | undefined;
        if (expiresInDays && expiresInDays > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        }

        // Create token document (tokenHash will be hashed in pre-save hook)
        const apiToken = new ApiToken({
            name,
            tokenHash: rawToken, // Will be hashed before save
            userId,
            scopes: tokenScopes,
            expiresAt,
            isActive: true
        });

        await apiToken.save();

        logger.info(`API token created for user ${user.username}: ${name}`);

        // Return the raw token ONLY ONCE (cannot be retrieved again)
        const { tokenHash, ...tokenResponse } = apiToken.toObject();

        res.status(201).json({
            ...tokenResponse,
            token: rawToken, // Return raw token only on creation
            warning: 'Save this token now. You won\'t be able to see it again!'
        });
    } catch (error) {
        logger.error('Error creating API token:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete an API token permanently
export const deleteToken = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const token = await ApiToken.findOne({ _id: id, userId });
        if (!token) {
            return res.status(404).json({ message: 'Token not found' });
        }

        await ApiToken.findByIdAndDelete(id);

        logger.info(`API token deleted: ${token.name} (${id})`);

        res.json({ message: 'Token deleted successfully' });
    } catch (error) {
        logger.error('Error deleting API token:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get available scopes for the current user
export const getAvailableScopes = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const scopes = SCOPE_DEFINITIONS[user.role] || [];

        res.json({ scopes });
    } catch (error) {
        logger.error('Error fetching available scopes:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};
