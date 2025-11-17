import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { DnsProvider } from '../models/dnsProvider.model';
import { ActivityLogService } from '../services/activityLog.service';
import { DnsProviderFactory } from '../services/dns-providers';

export class DnsProviderController {
    getAvailableProviderTypes = asyncHandler(async (req: Request, res: Response) => {
        const metadata = DnsProviderFactory.getProvidersMetadata();
        res.json(metadata);
    });

    getAllProviders = asyncHandler(async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 0;
        const sortField = (req.query.sortField as string) || 'name';
        const sortOrder = parseInt(req.query.sortOrder as string) || 1;

        // Build filter query - exactly like activity-log
        const filterQuery: any = {};

        // Process filters - they come as filters[fieldName]=JSON object with operator and constraints
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
                        filterQuery[field] = this.buildFilterQuery(field, constraints[0].value, constraints[0].matchMode);
                    } else {
                        // Multiple constraints - use operator (and/or)
                        const logicOp = operator === 'or' ? '$or' : '$and';
                        filterQuery[logicOp] = filterQuery[logicOp] || [];
                        constraints.forEach((constraint: any) => {
                            const condition: any = {};
                            condition[field] = this.buildFilterQuery(field, constraint.value, constraint.matchMode);
                            filterQuery[logicOp].push(condition);
                        });
                    }
                } catch (error) {
                    // Silent fail
                }
            }
        });

        // Get total count
        const totalRecords = await DnsProvider.countDocuments(filterQuery);

        // Build sort object
        const sortObj: any = {};
        sortObj[sortField] = sortOrder;

        // Get paginated data
        const providers = await DnsProvider.find(filterQuery)
            .sort(sortObj)
            .skip(page * limit)
            .limit(limit);

        res.json({
            data: providers,
            totalRecords
        });
    });

    private buildFilterQuery(field: string, value: any, matchMode: string): any {
        // Handle text fields
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
    }

    getProviderById = asyncHandler(async (req: Request, res: Response) => {
        const provider = await DnsProvider.findById(req.params.id);
        if (!provider) {
            res.status(404);
            throw new Error('DNS Provider not found');
        }
        res.json(provider);
    });

    createProvider = asyncHandler(async (req: Request, res: Response) => {
        const provider = await DnsProvider.create(req.body);

        // Log activity
        await ActivityLogService.logDnsProviderAdded(provider.name, provider._id.toString(), req);

        res.status(201).json(provider);
    });

    updateProvider = asyncHandler(async (req: Request, res: Response) => {
        const provider: any = await DnsProvider.findById(req.params.id);
        if (!provider) {
            res.status(404);
            throw new Error('DNS Provider not found');
        }

        // Update fields manually to handle Map type properly
        if (req.body.name !== undefined) provider.name = req.body.name;
        if (req.body.type !== undefined) provider.type = req.body.type;
        if (req.body.description !== undefined) provider.description = req.body.description;
        if (req.body.enabled !== undefined) provider.enabled = req.body.enabled;
        if (req.body.dnsPropagationTime !== undefined) provider.dnsPropagationTime = req.body.dnsPropagationTime;

        // Handle credentials Map
        if (req.body.credentials) {
            provider.credentials = new Map(Object.entries(req.body.credentials));
        }

        await provider.save();

        // Log activity
        await ActivityLogService.logDnsProviderUpdated(provider.name, provider._id.toString(), req);

        res.json(provider);
    });

    deleteProvider = asyncHandler(async (req: Request, res: Response) => {
        const provider = await DnsProvider.findByIdAndDelete(req.params.id);
        if (!provider) {
            res.status(404);
            throw new Error('DNS Provider not found');
        }

        // Log activity
        await ActivityLogService.logDnsProviderDeleted(provider.name, req.params.id, req);

        res.json({ message: 'DNS Provider deleted' });
    });

    testProvider = asyncHandler(async (req: Request, res: Response) => {
        const provider = await DnsProvider.findById(req.params.id);
        if (!provider) {
            res.status(404);
            throw new Error('DNS Provider not found');
        }

        // Test credentials using the provider's validateCredentials method
        try {
            const providerType = provider.type || 'manual';
            const dnsProvider = DnsProviderFactory.getProvider(providerType);

            // Convert Mongoose Map to plain object
            const credentialsObj: Record<string, string> = {};
            if (provider.credentials) {
                provider.credentials.forEach((value, key) => {
                    credentialsObj[key] = value;
                });
            }

            const result = await dnsProvider.validateCredentials(credentialsObj);

            if (result.valid) {
                // Log successful test
                await ActivityLogService.logDnsProviderTest(provider.name, provider._id?.toString() || '', true, req);

                res.json({
                    success: true,
                    messageKey: result.messageKey || 'dnsProviders.test.success',
                });
            } else {
                // Log failed test
                await ActivityLogService.logDnsProviderTest(
                    provider.name,
                    provider._id?.toString() || '',
                    false,
                    req,
                    result.messageKey || 'dnsProviders.test.invalidCredentials'
                );

                res.status(400).json({
                    success: false,
                    messageKey: result.messageKey || 'dnsProviders.test.invalidCredentials',
                });
            }
        } catch (error: any) {
            // Log failed test
            await ActivityLogService.logDnsProviderTest(
                provider.name,
                provider._id?.toString() || '',
                false,
                req,
                error.message
            );

            res.status(500).json({
                success: false,
                messageKey: 'dnsProviders.test.failed',
                error: error.message
            });
        }
    });
}
