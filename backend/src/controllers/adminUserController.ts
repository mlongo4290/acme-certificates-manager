import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { ActivityLogService } from '../services/activityLog.service';
import { Logger } from '../services/logger.service';

const logger = new Logger('AdminUserController');

// Helper to build filter query
const buildFilterQuery = (field: string, value: any, matchMode: string): any => {
    switch (matchMode) {
        case 'contains':
            return { $regex: value, $options: 'i' };
        case 'startsWith':
            return { $regex: `^${value}`, $options: 'i' };
        case 'equals':
            return value;
        default:
            return { $regex: value, $options: 'i' };
    }
};

// Get all users
export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 0;
        const sortField = (req.query.sortField as string) || 'createdAt';
        const sortOrder = parseInt(req.query.sortOrder as string) || -1;

        // Build filter query
        const filterQuery: any = {};

        Object.keys(req.query).forEach(key => {
            if (key.startsWith('filters[') && key.endsWith(']')) {
                const field = key.substring(8, key.length - 1);
                const fieldFilterStr = req.query[key] as string;

                try {
                    const fieldFilter = JSON.parse(fieldFilterStr);

                    if (!fieldFilter.constraints || fieldFilter.constraints.length === 0) {
                        return;
                    }

                    const constraints = fieldFilter.constraints;
                    const operator = fieldFilter.operator || 'and';

                    if (constraints.length === 1) {
                        filterQuery[field] = buildFilterQuery(field, constraints[0].value, constraints[0].matchMode);
                    } else {
                        const logicOp = operator === 'or' ? '$or' : '$and';
                        filterQuery[logicOp] = filterQuery[logicOp] || [];
                        constraints.forEach((constraint: any) => {
                            const condition: any = {};
                            condition[field] = buildFilterQuery(field, constraint.value, constraint.matchMode);
                            filterQuery[logicOp].push(condition);
                        });
                    }
                } catch (error) {
                    // Silent fail
                }
            }
        });

        const totalRecords = await User.countDocuments(filterQuery);

        const sortObj: any = {};
        sortObj[sortField] = sortOrder;

        const users = await User.find(filterQuery)
            .select('-password -mfaSecret -resetPasswordToken -resetPasswordExpires')
            .sort(sortObj)
            .skip(page * limit)
            .limit(limit);

        res.json({
            data: users,
            totalRecords
        });
    } catch (error) {
        logger.error('Error fetching users:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create a new user
export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        const { username, password, email, role, isActive, authProvider } = req.body;

        // Validate required fields
        if (!username || !email) {
            return res.status(400).json({ message: 'Username and email are required' });
        }

        // Set default auth provider
        const userAuthProvider = authProvider || 'local';

        // Password is required only for local users
        if (userAuthProvider === 'local' && !password) {
            return res.status(400).json({ message: 'Password is required for local users' });
        }

        // Password should not be provided for external auth users
        if (userAuthProvider !== 'local' && password) {
            return res.status(400).json({ message: 'Password should not be provided for external authentication users' });
        }

        // Validate role
        if (role && !['ADMIN', 'CERT_MANAGER', 'READ_ONLY'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Create new user
        const userData: any = {
            username,
            email,
            authProvider: userAuthProvider,
            role: role || 'CERT_MANAGER',
            isActive: isActive !== undefined ? isActive : true,
            mfaEnabled: false
        };

        // Only set password for local users
        if (userAuthProvider === 'local') {
            userData.password = password;
        }

        const user = new User(userData);

        await user.save();

        // Log user creation
        await ActivityLogService.logUserCreated(user.username, (user._id).toString(), req);

        // Return user without sensitive data
        const { password: _, mfaSecret, resetPasswordToken, resetPasswordExpires, ...userResponse } = user.toObject();

        res.status(201).json(userResponse);
    } catch (error) {
        logger.error('Error creating user:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update a user
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { username, email, password, role, isActive, mfaEnabled } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Validate role if provided
        if (role && !['ADMIN', 'CERT_MANAGER', 'READ_ONLY'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const isExternalAuth = user.authProvider !== 'local';

        // Username can be updated for all users
        if (username !== undefined) {
            if (!username || username.trim() === '') {
                return res.status(400).json({ message: 'Username cannot be empty' });
            }
            user.username = username;
        }

        // Email can only be changed for local users (external users get it from auth provider)
        if (email !== undefined) {
            if (isExternalAuth) {
                return res.status(400).json({
                    message: 'Cannot update email for external authentication users. Email is managed by the authentication provider.'
                });
            }
            if (!email || email.trim() === '') {
                return res.status(400).json({ message: 'Email cannot be empty' });
            }
            user.email = email;
        }

        // Password can only be changed for local users
        if (password !== undefined) {
            if (isExternalAuth) {
                return res.status(400).json({
                    message: 'Cannot update password for external authentication users. Password is managed by the authentication provider.'
                });
            }
            user.password = password;
        }

        // Role and isActive can be updated for all users
        if (role !== undefined) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;

        // Handle MFA toggle - available for local and LDAP users
        if (mfaEnabled !== undefined) {
            const isMfaSupported = user.authProvider === 'local' || user.authProvider === 'ldap';

            if (!isMfaSupported) {
                return res.status(400).json({
                    message: 'MFA is only available for local and LDAP authentication users'
                });
            }

            if (mfaEnabled === false) {
                // Disable MFA - remove secret
                user.mfaEnabled = false;
                user.mfaSecret = undefined;
            } else if (mfaEnabled === true && user.mfaSecret) {
                // Enable MFA only if secret already exists
                user.mfaEnabled = true;
            }
        }

        logger.info(`Updated user ${user.username} (provider: ${user.authProvider})`);


        await user.save();

        // Log user update
        await ActivityLogService.logUserUpdated(user.username, (user._id).toString(), req);

        // Return user without sensitive data
        const { password: _pwd, mfaSecret: _mfa, resetPasswordToken: _token, resetPasswordExpires: _exp, ...userResponse } = user.toObject();

        res.json(userResponse);
    } catch (error) {
        logger.error('Error updating user:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete a user
export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting yourself
        if (user.id === req.user?.userId) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        await User.findByIdAndDelete(id);

        // Log user deletion
        await ActivityLogService.logUserDeleted(user.username, (user._id).toString(), req);

        logger.info(`User ${user.username} (provider: ${user.authProvider}) deleted by admin`);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        logger.error('Error deleting user:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};
