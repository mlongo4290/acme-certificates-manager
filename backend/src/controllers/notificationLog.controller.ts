import { Request, Response } from 'express';
import { NotificationLog } from '../models/notificationLog.model';

/**
 * Get notification logs with filters and pagination
 */
export const getNotificationLogs = async (req: Request, res: Response) => {
    try {
        const {
            page = 0,
            limit = 0,
            alertType,
            status,
            userId,
            startDate,
            endDate,
        } = req.query;

        const query: any = {};

        if (alertType) {
            query.alertType = alertType;
        }

        if (status) {
            query.status = status;
        }

        if (userId) {
            query.userId = userId;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate as string);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate as string);
            }
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [logs, total] = await Promise.all([
            NotificationLog.find(query)
                .populate('userId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            NotificationLog.countDocuments(query),
        ]);

        res.json({
            logs,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get notification log statistics
 */
export const getNotificationStats = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) {
                dateFilter.createdAt.$gte = new Date(startDate as string);
            }
            if (endDate) {
                dateFilter.createdAt.$lte = new Date(endDate as string);
            }
        }

        const [
            totalSent,
            totalFailed,
            totalPending,
            byAlertType,
        ] = await Promise.all([
            NotificationLog.countDocuments({ ...dateFilter, status: 'sent' }),
            NotificationLog.countDocuments({ ...dateFilter, status: 'failed' }),
            NotificationLog.countDocuments({ ...dateFilter, status: 'pending' }),
            NotificationLog.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$alertType', count: { $sum: 1 } } },
            ]),
        ]);

        res.json({
            totalSent,
            totalFailed,
            totalPending,
            byAlertType,
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Retry failed notification
 */
export const retryNotification = async (req: Request, res: Response) => {
    try {
        const log = await NotificationLog.findById(req.params.id);

        if (!log) {
            return res.status(404).json({ message: 'Notification log not found' });
        }

        if (log.status !== 'failed') {
            return res.status(400).json({ message: 'Only failed notifications can be retried' });
        }

        // TODO: Implement retry logic through notification service
        // For now, just mark as pending
        log.status = 'pending';
        log.retryCount += 1;
        await log.save();

        res.json({ message: 'Notification queued for retry', log });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
