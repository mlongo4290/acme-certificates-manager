import { Request, Response } from 'express';
import { AcmeAccount } from '../models/AcmeAccount';
import { AcmeCa } from '../models/AcmeCa';
import { AcmeService } from '../services/acme.service';
import { ActivityLogService } from '../services/activityLog.service';
import { decrypt, encrypt } from '../utils/encryption';

const acmeService = new AcmeService();

// Helper to build filter query
const buildFilterQuery = (field: string, value: any, matchMode: string): any => {
    // Special handling for registeredAt status filter
    if (field === 'registeredAt') {
        if (value === true || value === 'true') {
            return { $ne: null }; // Registered: has a date
        } else if (value === false || value === 'false') {
            return null; // Not registered: null
        }
    }

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

export const acmeAccountController = {
    // Get all accounts
    async getAllAccounts(req: Request, res: Response) {
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

                        // Special handling for registeredAt
                        if (field === 'registeredAt' && constraints.length > 0) {
                            let hasTrue = false;
                            let hasFalse = false;

                            constraints.forEach((c: any) => {
                                const values = Array.isArray(c.value) ? c.value : [c.value];
                                values.forEach((val: any) => {
                                    if (val === true || val === 'true') hasTrue = true;
                                    if (val === false || val === 'false') hasFalse = true;
                                });
                            });

                            if (hasTrue && hasFalse && operator === 'or') {
                                // Both selected with OR: show all records (no filter needed)
                            } else if (hasTrue && !hasFalse) {
                                // Only "registered" selected
                                filterQuery[field] = { $ne: null };
                            } else if (hasFalse && !hasTrue) {
                                // Only "not registered" selected
                                filterQuery[field] = { $eq: null };
                            }
                            return; // Always return after handling registeredAt
                        }

                        // Handle all other fields
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

            const totalRecords = await AcmeAccount.countDocuments(filterQuery);

            const sortObj: any = {};
            sortObj[sortField] = sortOrder;

            const accounts = await AcmeAccount.find(filterQuery)
                .populate('caId', 'name server')
                .sort(sortObj)
                .skip(page * limit)
                .limit(limit);

            res.json({
                data: accounts,
                totalRecords
            });
        } catch (error: any) {
            res.status(500).json({ message: 'Error fetching accounts', error: error.message });
        }
    },

    // Get account by ID
    async getAccountById(req: Request, res: Response) {
        try {
            const account = await AcmeAccount.findById(req.params.id).populate('caId', 'name server');
            if (!account) {
                return res.status(404).json({ message: 'Account not found' });
            }
            res.json(account);
        } catch (error: any) {
            res.status(500).json({ message: 'Error fetching account', error: error.message });
        }
    },

    // Deactivate account at CA, then delete from DB
    async deactivateAccount(req: Request, res: Response) {
        try {
            const account = await AcmeAccount.findById(req.params.id)
                .select('+accountKeyJwk')
                .populate('caId');
            if (!account) {
                return res.status(404).json({ message: 'Account not found' });
            }

            const ca: any = account.caId;
            let caDeactivated = false;
            let caMessage = '';

            if (account.accountKeyJwk && ca?.server) {
                try {
                    const decryptedKeyJson = decrypt(account.accountKeyJwk);
                    const accountKeyJwk = JSON.parse(decryptedKeyJson);
                    const result = await acmeService.deactivateAccount(ca.server, accountKeyJwk);
                    caDeactivated = result.success;
                    caMessage = result.message;
                } catch (err: any) {
                    caMessage = `Could not deactivate at CA: ${err.message}`;
                }
            }

            await AcmeAccount.findByIdAndDelete(req.params.id);
            await ActivityLogService.logAcmeAccountDeleted(account.email, req.params.id, req);

            res.json({
                message: 'Account deleted from local database',
                caDeactivated,
                caMessage
            });
        } catch (error: any) {
            res.status(500).json({ message: 'Error deactivating account', error: error.message });
        }
    },

    // Re-register account with CA (new key pair, same EAB)
    async reregisterWithCA(req: Request, res: Response) {
        try {
            const account = await AcmeAccount.findById(req.params.id).populate('caId');
            if (!account) {
                return res.status(404).json({ message: 'Account not found' });
            }

            const ca: any = account.caId;
            if (!ca) {
                return res.status(404).json({ message: 'CA not found' });
            }

            const result = await acmeService.registerAccount(
                ca.server,
                account.email,
                account.eabKeyId || undefined,
                account.eabHmacKey || undefined
            );

            if (result.success) {
                account.registeredAt = new Date();
                if (result.accountUrl) account.accountUrl = result.accountUrl;
                if (result.accountKeyJwk) {
                    account.accountKeyJwk = encrypt(JSON.stringify(result.accountKeyJwk));
                }
                await account.save();
                await ActivityLogService.logAcmeAccountRegistered(account.email, account.id, req);
            }

            res.json({
                success: result.success,
                message: result.message,
                account: await AcmeAccount.findById(account._id).populate('caId', 'name server')
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error re-registering account', error: error.message });
        }
    },

    // Create new account
    async createAccount(req: Request, res: Response) {
        try {
            const { name, email, caId, eabKeyId, eabHmacKey, supportsSAN } = req.body;

            // Validation
            if (!name || !email || !caId) {
                return res.status(400).json({ message: 'Name, email, and CA are required' });
            }

            // Check if CA exists
            const ca = await AcmeCa.findById(caId);
            if (!ca) {
                return res.status(404).json({ message: 'CA not found' });
            }

            // Check if account name already exists for this CA
            const existingAccount = await AcmeAccount.findOne({ caId, name });
            if (existingAccount) {
                return res.status(400).json({ message: 'Account with this name already exists for this CA' });
            }

            const account = new AcmeAccount({
                name,
                email,
                caId,
                eabKeyId,
                eabHmacKey,
                supportsSAN: supportsSAN !== false
            });

            await account.save();

            // Log activity
            await ActivityLogService.logAcmeAccountCreated(account.email, account.id, req);

            const populatedAccount = await AcmeAccount.findById(account._id).populate('caId', 'name server');
            res.status(201).json(populatedAccount);
        } catch (error: any) {
            res.status(500).json({ message: 'Error creating account', error: error.message });
        }
    },

    // Update account
    async updateAccount(req: Request, res: Response) {
        try {
            const { name, email, caId, eabKeyId, eabHmacKey, supportsSAN } = req.body;

            const account = await AcmeAccount.findById(req.params.id);
            if (!account) {
                return res.status(404).json({ message: 'Account not found' });
            }

            // Update fields
            if (name !== undefined) account.name = name;
            if (email !== undefined) account.email = email;
            if (caId !== undefined) {
                // Check if CA exists
                const ca = await AcmeCa.findById(caId);
                if (!ca) {
                    return res.status(404).json({ message: 'CA not found' });
                }
                account.caId = caId;
            }
            if (eabKeyId !== undefined) account.eabKeyId = eabKeyId;
            if (eabHmacKey !== undefined) account.eabHmacKey = eabHmacKey;
            if (supportsSAN !== undefined) (account as any).supportsSAN = supportsSAN;

            await account.save();
            const populatedAccount = await AcmeAccount.findById(account._id).populate('caId', 'name server');
            res.json(populatedAccount);
        } catch (error: any) {
            res.status(500).json({ message: 'Error updating account', error: error.message });
        }
    },

    // Delete account
    async deleteAccount(req: Request, res: Response) {
        try {
            const account = await AcmeAccount.findById(req.params.id);
            if (!account) {
                return res.status(404).json({ message: 'Account not found' });
            }

            await AcmeAccount.findByIdAndDelete(req.params.id);

            // Log activity
            await ActivityLogService.logAcmeAccountDeleted(account.email, req.params.id, req);

            res.json({ message: 'Account deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ message: 'Error deleting account', error: error.message });
        }
    },

    // Register account with CA
    async registerWithCA(req: Request, res: Response) {
        try {
            const account = await AcmeAccount.findById(req.params.id).populate('caId');
            if (!account) {
                return res.status(404).json({ message: 'Account not found' });
            }

            const ca: any = account.caId;
            if (!ca) {
                return res.status(404).json({ message: 'CA not found' });
            }

            const result = await acmeService.registerAccount(
                ca.server,
                account.email,
                account.eabKeyId ? account.eabKeyId : undefined,
                account.eabHmacKey ? account.eabHmacKey : undefined
            );

            if (result.success) {
                account.registeredAt = new Date();
                if (result.accountUrl) {
                    account.accountUrl = result.accountUrl;
                }
                if (result.accountKeyJwk) {
                    // Encrypt and store the account key
                    const keyJson = JSON.stringify(result.accountKeyJwk);
                    account.accountKeyJwk = encrypt(keyJson);
                }
                await account.save();

                // Log successful registration
                await ActivityLogService.logAcmeAccountRegistered(account.email, account.id, req);
            }

            res.json({
                success: result.success,
                message: result.message,
                account: await AcmeAccount.findById(account._id).populate('caId', 'name server')
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Error registering account',
                error: error.message
            });
        }
    }
};
