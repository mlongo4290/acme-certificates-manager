import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { initializePassport } from '../config/passport';
import { AuthProvider } from '../models/AuthProvider';
import { ActivityLogService } from '../services/activityLog.service';

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

// Get all auth providers
export const getAuthProviders = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 0;
    const sortField = (req.query.sortField as string) || 'priority';
    const sortOrder = parseInt(req.query.sortOrder as string) || 1;

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

    const totalRecords = await AuthProvider.countDocuments(filterQuery);

    const sortObj: any = {};
    sortObj[sortField] = sortOrder;

    const providers = await AuthProvider.find(filterQuery)
        .sort(sortObj)
        .skip(page * limit)
        .limit(limit);

    res.json({
        data: providers,
        totalRecords
    });
});

// Get enabled auth providers (public endpoint for login page)
export const getEnabledProviders = asyncHandler(async (req: Request, res: Response) => {
    const providers = await AuthProvider.find({ enabled: true }).sort({ priority: 1 }).select('name slug type priority');
    res.json(providers);
});

// Create new auth provider
export const createAuthProvider = asyncHandler(async (req: Request, res: Response) => {
    const { name, type, enabled, priority, settings } = req.body;

    if (!name || !type) {
        res.status(400).json({ message: 'Name and type are required' });
        return;
    }

    const validTypes: string[] = ['local', 'ldap', 'azure-ad', 'oidc'];
    if (!validTypes.includes(type)) {
        res.status(400).json({ message: 'Invalid provider type' });
        return;
    }

    const existingProvider = await AuthProvider.findOne({ name });
    if (existingProvider) {
        res.status(400).json({ message: 'Provider with this name already exists' });
        return;
    }

    const provider = new AuthProvider({
        name,
        type,
        enabled: enabled !== undefined ? enabled : false,
        priority: priority !== undefined ? priority : 0,
        settings: settings || {}
    });

    await provider.save();

    // Log auth provider creation
    await ActivityLogService.logAuthProviderAdded(provider.name, (provider._id).toString(), req);

    // Reinitialize passport with new provider
    if (provider.enabled) {
        await initializePassport();
    }

    res.status(201).json(provider);
});

// Update auth provider
export const updateAuthProvider = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, enabled, priority, settings } = req.body;

    const provider = await AuthProvider.findById(id);

    if (!provider) {
        res.status(404).json({ message: 'Provider not found' });
        return;
    }

    if (name !== undefined) provider.name = name;
    if (enabled !== undefined) provider.enabled = enabled;
    if (priority !== undefined) provider.priority = priority;
    if (settings !== undefined) provider.settings = { ...provider.settings, ...settings };

    await provider.save();

    // Log auth provider update
    await ActivityLogService.logAuthProviderUpdated(provider.name, (provider._id).toString(), req);

    // Reinitialize passport
    await initializePassport();

    res.json(provider);
});

// Delete auth provider
export const deleteAuthProvider = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const provider = await AuthProvider.findById(id);

    if (!provider) {
        res.status(404).json({ message: 'Provider not found' });
        return;
    }

    // Prevent deletion of local provider if it's the only enabled one
    if (provider.type === 'local') {
        const enabledCount = await AuthProvider.countDocuments({ enabled: true });
        if (enabledCount === 1 && provider.enabled) {
            res.status(400).json({ message: 'Cannot delete the only enabled authentication provider' });
            return;
        }
    }

    await AuthProvider.findByIdAndDelete(id);

    // Log auth provider deletion
    await ActivityLogService.logAuthProviderDeleted(provider.name, (provider._id).toString(), req);

    // Reinitialize passport
    await initializePassport();

    res.json({ message: 'Provider deleted successfully' });
});
