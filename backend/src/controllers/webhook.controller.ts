import { createHmac } from 'crypto';
import { Request, Response } from 'express';
import { NotificationLog } from '../models/notificationLog.model';
import { VALID_EVENTS, Webhook } from '../models/webhook.model';
import { Logger } from '../services/logger.service';

const logger = new Logger('WebhookController');

// GET /api/webhooks
export const getAllWebhooks = async (req: Request, res: Response) => {
    try {
        const webhooks = await Webhook.find().sort({ createdAt: -1 }).lean();
        // Never expose secrets in list response
        const sanitized = webhooks.map(({ secret, ...w }) => ({ ...w, hasSecret: !!secret }));
        res.json(sanitized);
    } catch (error: any) {
        logger.error('Error fetching webhooks:', error);
        res.status(500).json({ message: 'Error fetching webhooks', error: error.message });
    }
};

// GET /api/webhooks/:id
export const getWebhookById = async (req: Request, res: Response) => {
    try {
        const webhook = await Webhook.findById(req.params.id).lean();
        if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
        const { secret, ...sanitized } = webhook as any;
        res.json({ ...sanitized, hasSecret: !!secret });
    } catch (error: any) {
        logger.error('Error fetching webhook:', error);
        res.status(500).json({ message: 'Error fetching webhook', error: error.message });
    }
};

// POST /api/webhooks
export const createWebhook = async (req: Request, res: Response) => {
    try {
        const { name, url, events, secret, headers, enabled } = req.body;

        if (!name || !url) {
            return res.status(400).json({ message: 'name and url are required' });
        }

        if (events && !events.every((e: string) => VALID_EVENTS.includes(e as any))) {
            return res.status(400).json({ message: 'Invalid event type', validEvents: VALID_EVENTS });
        }

        const webhook = await Webhook.create({ name, url, events: events || [], secret, headers, enabled });
        const { secret: _s, ...sanitized } = webhook.toObject();
        res.status(201).json({ ...sanitized, hasSecret: !!_s });
    } catch (error: any) {
        logger.error('Error creating webhook:', error);
        res.status(500).json({ message: 'Error creating webhook', error: error.message });
    }
};

// PUT /api/webhooks/:id
export const updateWebhook = async (req: Request, res: Response) => {
    try {
        const { name, url, events, secret, headers, enabled } = req.body;

        if (events && !events.every((e: string) => VALID_EVENTS.includes(e as any))) {
            return res.status(400).json({ message: 'Invalid event type', validEvents: VALID_EVENTS });
        }

        const update: any = {};
        if (name !== undefined) update.name = name;
        if (url !== undefined) update.url = url;
        if (events !== undefined) update.events = events;
        if (headers !== undefined) update.headers = headers;
        if (enabled !== undefined) update.enabled = enabled;
        // Only update secret if explicitly provided (empty string = remove secret)
        if (secret !== undefined) update.secret = secret || null;

        const webhook = await Webhook.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
        if (!webhook) return res.status(404).json({ message: 'Webhook not found' });

        const { secret: _s, ...sanitized } = webhook as any;
        res.json({ ...sanitized, hasSecret: !!_s });
    } catch (error: any) {
        logger.error('Error updating webhook:', error);
        res.status(500).json({ message: 'Error updating webhook', error: error.message });
    }
};

// DELETE /api/webhooks/:id
export const deleteWebhook = async (req: Request, res: Response) => {
    try {
        const webhook = await Webhook.findByIdAndDelete(req.params.id);
        if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
        res.json({ message: 'Webhook deleted successfully' });
    } catch (error: any) {
        logger.error('Error deleting webhook:', error);
        res.status(500).json({ message: 'Error deleting webhook', error: error.message });
    }
};

// POST /api/webhooks/:id/test
export const testWebhook = async (req: Request, res: Response) => {
    try {
        const webhook = await Webhook.findById(req.params.id);
        if (!webhook) return res.status(404).json({ message: 'Webhook not found' });

        const payload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            data: { message: 'This is a test webhook from ACME Certificates Manager' },
        };

        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'test',
            'X-Webhook-Timestamp': String(Date.now()),
            ...(webhook.headers as any || {}),
        };

        if (webhook.secret) {
            const sig = createHmac('sha256', webhook.secret).update(body).digest('hex');
            headers['X-Webhook-Signature'] = `sha256=${sig}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(webhook.url, { method: 'POST', headers, body, signal: controller.signal });
            clearTimeout(timeout);
            res.json({ success: response.ok, statusCode: response.status, statusText: response.statusText });
        } catch (fetchError: any) {
            clearTimeout(timeout);
            res.json({ success: false, error: fetchError.message });
        }
    } catch (error: any) {
        logger.error('Error testing webhook:', error);
        res.status(500).json({ message: 'Error testing webhook', error: error.message });
    }
};

// GET /api/webhooks/events - list of valid event types
export const getValidEvents = async (_req: Request, res: Response) => {
    res.json(VALID_EVENTS);
};

// GET /api/webhooks/:id/logs - delivery logs for a specific webhook
export const getWebhookLogs = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;

        const logs = await NotificationLog.find({ webhookId: req.params.id, channel: 'webhook' })
            .sort({ createdAt: -1 })
            .skip(page * limit)
            .limit(limit)
            .lean();

        const total = await NotificationLog.countDocuments({ webhookId: req.params.id, channel: 'webhook' });
        res.json({ data: logs, totalRecords: total });
    } catch (error: any) {
        logger.error('Error fetching webhook logs:', error);
        res.status(500).json({ message: 'Error fetching webhook logs', error: error.message });
    }
};
