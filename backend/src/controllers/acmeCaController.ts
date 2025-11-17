import { Request, Response } from 'express';
import { AcmeCa } from '../models/AcmeCa';
import { AcmeService } from '../services/acme.service';
import { ActivityLogService } from '../services/activityLog.service';

const acmeService = new AcmeService();

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

export const acmeCaController = {
    // Get all CAs
    async getAllCAs(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 0;
            const limit = parseInt(req.query.limit as string) || 0;
            const sortField = (req.query.sortField as string) || 'name';
            const sortOrder = parseInt(req.query.sortOrder as string) || 1;

            // Build filter query - exactly like activity-log
            const filterQuery: any = {};

            // Process filters
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
                            // Single constraint
                            filterQuery[field] = buildFilterQuery(field, constraints[0].value, constraints[0].matchMode);
                        } else {
                            // Multiple constraints - use operator (and/or)
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

            // Get total count
            const totalRecords = await AcmeCa.countDocuments(filterQuery);

            // Build sort object
            const sortObj: any = {};
            sortObj[sortField] = sortOrder;

            // Get paginated data
            const cas = await AcmeCa.find(filterQuery)
                .sort(sortObj)
                .skip(page * limit)
                .limit(limit);

            res.json({
                data: cas,
                totalRecords
            });
        } catch (error: any) {
            res.status(500).json({ message: 'Error fetching CAs', error: error.message });
        }
    },

    // Get CA by ID
    async getCAById(req: Request, res: Response) {
        try {
            const ca = await AcmeCa.findById(req.params.id);
            if (!ca) {
                return res.status(404).json({ message: 'CA not found' });
            }
            res.json(ca);
        } catch (error: any) {
            res.status(500).json({ message: 'Error fetching CA', error: error.message });
        }
    },

    // Create new CA
    async createCA(req: Request, res: Response) {
        try {
            const { name, server, enabled, isDefault } = req.body;

            // Validation
            if (!name || !server) {
                return res.status(400).json({ message: 'Name and server are required' });
            }

            // Check if name already exists
            const existingCa = await AcmeCa.findOne({ name });
            if (existingCa) {
                return res.status(400).json({ message: 'CA with this name already exists' });
            }

            const ca = new AcmeCa({
                name,
                server,
                enabled: enabled !== undefined ? enabled : true,
                isDefault: isDefault || false
            });

            await ca.save();

            // Log activity
            await ActivityLogService.logCaAdded(ca.name, ca.id, req);

            res.status(201).json(ca);
        } catch (error: any) {
            res.status(500).json({ message: 'Error creating CA', error: error.message });
        }
    },

    // Update CA
    async updateCA(req: Request, res: Response) {
        try {
            const { name, server, enabled, isDefault } = req.body;

            const ca = await AcmeCa.findById(req.params.id);
            if (!ca) {
                return res.status(404).json({ message: 'CA not found' });
            }

            // Update fields
            if (name !== undefined) ca.name = name;
            if (server !== undefined) ca.server = server;
            if (enabled !== undefined) ca.enabled = enabled;
            if (isDefault !== undefined) ca.isDefault = isDefault;

            await ca.save();

            // Log activity
            await ActivityLogService.logCaUpdated(ca.name, ca.id, req);

            res.json(ca);
        } catch (error: any) {
            res.status(500).json({ message: 'Error updating CA', error: error.message });
        }
    },

    // Delete CA
    async deleteCA(req: Request, res: Response) {
        try {
            const ca = await AcmeCa.findById(req.params.id);
            if (!ca) {
                return res.status(404).json({ message: 'CA not found' });
            }

            // Prevent deletion of default CA
            if (ca.isDefault) {
                return res.status(400).json({ message: 'Cannot delete default CA. Set another CA as default first.' });
            }

            await AcmeCa.findByIdAndDelete(req.params.id);

            // Log activity
            await ActivityLogService.logCaDeleted(ca.name, req.params.id, req);

            res.json({ message: 'CA deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ message: 'Error deleting CA', error: error.message });
        }
    },

    // Set CA as default
    async setAsDefault(req: Request, res: Response) {
        try {
            const ca = await AcmeCa.findById(req.params.id);
            if (!ca) {
                return res.status(404).json({ message: 'CA not found' });
            }

            ca.isDefault = true;
            await ca.save();

            // Log activity
            await ActivityLogService.logCaSetDefault(ca.name, ca.id, req);

            res.json(ca);
        } catch (error: any) {
            res.status(500).json({ message: 'Error setting default CA', error: error.message });
        }
    },

    // Test CA connection
    async testConnection(req: Request, res: Response) {
        try {
            const ca = await AcmeCa.findById(req.params.id);
            if (!ca) {
                return res.status(404).json({ message: 'CA not found' });
            }

            const result = await acmeService.testConnection(ca.server);

            res.json({
                success: result.success,
                message: result.message,
                server: ca.server
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Error testing CA connection',
                error: error.message
            });
        }
    }
};
