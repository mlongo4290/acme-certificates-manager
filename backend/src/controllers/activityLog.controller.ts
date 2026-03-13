import { Request, Response } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { Logger } from '../services/logger.service';

const logger = new Logger('ActivityLogController');

// Helper per creare un activity log
export const createActivityLog = async (
    type: string,
    message: string,
    userId?: string,
    username?: string,
    metadata?: any
) => {
    // Controlla se l'activity logging è abilitato
    const enabled = process.env.ACTIVITY_LOG_ENABLED !== 'false';
    if (!enabled) {
        return;
    } try {
        await ActivityLog.create({
            type,
            message,
            userId,
            username,
            metadata,
            timestamp: new Date(),
        });
    } catch (error) {
    }
};

// Helper function to build filter query based on matchMode
const buildFilterQuery = (field: string, value: any, matchMode: string) => {
    // Handle timestamp field specially
    if (field === 'timestamp') {
        const inputDate = new Date(value);
        // Normalize to start of day in UTC to avoid timezone issues
        const date = new Date(Date.UTC(
            inputDate.getUTCFullYear(),
            inputDate.getUTCMonth(),
            inputDate.getUTCDate()
        ));

        switch (matchMode) {
            case 'dateIs':
                // Same day (entire day in UTC)
                const startOfDay = new Date(date);
                const endOfDay = new Date(date);
                endOfDay.setUTCHours(23, 59, 59, 999);
                return { $gte: startOfDay, $lte: endOfDay };
            case 'dateAfter':
                // After means from start of next day
                const nextDay = new Date(date);
                nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                return { $gte: nextDay };
            case 'dateBefore':
                // Before means before start of this day
                return { $lt: date };
            default:
                return { $gte: date };
        }
    } else {
        // Handle text filters with matchMode
        switch (matchMode) {
            case 'startsWith':
                return { $regex: `^${value}`, $options: 'i' };
            case 'endsWith':
                return { $regex: `${value}$`, $options: 'i' };
            case 'equals':
                return value;
            case 'notEquals':
                return { $ne: value };
            case 'contains':
            default:
                return { $regex: value, $options: 'i' };
        }
    }
};

// GET /api/activity-logs
export const getActivityLogs = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 0;
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
        const totalRecords = await ActivityLog.countDocuments(filterQuery);

        // Get paginated data - always sorted by timestamp descending (most recent first)
        const logs = await ActivityLog.find(filterQuery)
            .sort({ timestamp: -1 })
            .skip(page * limit)
            .limit(limit).populate('userId', 'username email')
            .lean();

        res.json({
            data: logs,
            totalRecords
        });
    } catch (error: any) {
        logger.error('Error fetching activity logs:', error);
        res.status(500).json({ message: 'Error fetching activity logs', error: error.message });
    }
};

// GET /api/activity-logs/recent - Per il widget dashboard
export const getRecentActivityLogs = async (req: Request, res: Response) => {
    try {
        const { limit = 15 } = req.query;

        const logs = await ActivityLog.find()
            .sort({ timestamp: -1 })
            .limit(Number(limit))
            .populate('userId', 'username email')
            .lean();

        res.json(logs);
    } catch (error: any) {
        logger.error('Error fetching recent activity logs:', error);
        res.status(500).json({ message: 'Error fetching recent activity logs', error: error.message });
    }
};

// GET /api/activity-logs/config
export const getActivityLogConfig = async (req: Request, res: Response) => {
    try {
        res.json({
            enabled: process.env.ACTIVITY_LOG_ENABLED !== 'false',
            retentionDays: Number(process.env.ACTIVITY_LOG_RETENTION_DAYS) || 90,
            housekeepingSchedule: process.env.ACTIVITY_LOG_HOUSEKEEPING_SCHEDULE || '0 2 * * *',
        });
    } catch (error: any) {
        logger.error('Error fetching activity log config:', error);
        res.status(500).json({ message: 'Error fetching activity log config', error: error.message });
    }
};

// POST /api/activity-logs/config
export const updateActivityLogConfig = async (req: Request, res: Response) => {
    try {
        const { enabled, retentionDays, housekeepingSchedule } = req.body;

        // Nota: In produzione, questi valori andrebbero salvati in un database o file di configurazione
        // Per ora aggiorniamo solo le variabili d'ambiente runtime (non persistenti tra restart)
        if (typeof enabled === 'boolean') {
            process.env.ACTIVITY_LOG_ENABLED = enabled.toString();
        }

        if (typeof retentionDays === 'number' && retentionDays > 0) {
            process.env.ACTIVITY_LOG_RETENTION_DAYS = retentionDays.toString();
        }

        if (typeof housekeepingSchedule === 'string') {
            process.env.ACTIVITY_LOG_HOUSEKEEPING_SCHEDULE = housekeepingSchedule;
        }

        const newConfig = {
            enabled: process.env.ACTIVITY_LOG_ENABLED !== 'false',
            retentionDays: Number(process.env.ACTIVITY_LOG_RETENTION_DAYS) || 90,
            housekeepingSchedule: process.env.ACTIVITY_LOG_HOUSEKEEPING_SCHEDULE || '0 2 * * *',
        };

        // Crea activity log per il cambio di configurazione
        await createActivityLog(
            'configChanged',
            'Activity log configuration updated',
            (req as any).user?.userId,
            (req as any).user?.username,
            {
                resourceType: 'config',
                resourceName: 'activityLog',
                newValue: newConfig,
            }
        );

        res.json({
            message: 'Activity log configuration updated successfully (runtime only, not persisted)',
            config: newConfig,
        });
    } catch (error: any) {
        logger.error('Error updating activity log config:', error);
        res.status(500).json({ message: 'Error updating activity log config', error: error.message });
    }
};

// DELETE /api/activity-logs/cleanup - Housekeeping manuale
export const cleanupOldActivityLogs = async (req: Request, res: Response) => {
    try {
        const retentionDays = Number(process.env.ACTIVITY_LOG_RETENTION_DAYS) || 90;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const result = await ActivityLog.deleteMany({
            timestamp: { $lt: cutoffDate },
        });

        await createActivityLog(
            'configChanged',
            `Activity logs cleanup completed: ${result.deletedCount} logs removed`,
            (req as any).user?.userId,
            (req as any).user?.username,
            {
                resourceType: 'activityLog',
                deletedCount: result.deletedCount,
                cutoffDate,
            }
        );

        res.json({
            message: 'Activity logs cleaned up successfully',
            deletedCount: result.deletedCount,
            cutoffDate,
        });
    } catch (error: any) {
        logger.error('Error cleaning up activity logs:', error);
        res.status(500).json({ message: 'Error cleaning up activity logs', error: error.message });
    }
};
