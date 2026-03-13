import { createHmac } from 'crypto';
import { NotificationLog } from '../models/notificationLog.model';
import { User } from '../models/User';
import { Webhook } from '../models/webhook.model';
import { EmailService } from './email.service';
import { Logger } from './logger.service';

export type AlertType =
    | 'certificate_renewed_success'
    | 'certificate_renewed_failed'
    | 'certificate_issued_success'
    | 'certificate_issued_failed'
    | 'post_script_success'
    | 'post_script_failed';

export interface NotificationMetadata {
    certificateId?: string;
    domain?: string;
    error?: string;
    scriptName?: string;
    expiryDate?: string;
    [key: string]: any;
}

export class NotificationService {
    private logger: Logger;
    private emailService = new EmailService();

    constructor() {
        this.logger = new Logger('NotificationService');
    }

    async sendNotification(alertType: AlertType, metadata: NotificationMetadata): Promise<void> {
        this.logger.info(`Sending notification for alert type: ${alertType}`);

        const users = await User.find({
            notificationEvents: alertType,
            email: { $exists: true, $ne: '' }
        });

        if (users.length === 0) {
            this.logger.info(`No users configured to receive notifications for ${alertType}`);
            return;
        }

        for (const user of users) {
            try {
                await this.sendEmail(user, alertType, metadata);
            } catch (error: any) {
                this.logger.error(`Failed to send email to ${user.email}: ${error.message}`);
            }
        }

        // Also dispatch to all enabled webhooks subscribed to this event
        await this.sendWebhooks(alertType, metadata);
    }

    private async sendEmail(user: any, alertType: AlertType, metadata: NotificationMetadata): Promise<void> {
        const logEntry = new NotificationLog({
            alertType,
            userId: user._id,
            recipient: user.email,
            status: 'pending',
            metadata,
        });

        try {
            if (!user.email) {
                throw new Error('User has no email address configured');
            }

            const language = user.preferredLanguage || 'en';

            // Prepare template variables
            const templateVariables = {
                domain: metadata.domain || 'N/A',
                certificateId: metadata.certificateId || 'N/A',
                expiryDate: metadata.expiryDate || 'N/A',
                error: metadata.error || 'Unknown error',
                scriptName: metadata.scriptName || 'N/A'
            };

            let subject, templateName;
            switch (alertType) {
                case 'certificate_renewed_success':
                    subject = language === 'it' ? 'Certificato rinnovato con successo' : 'Certificate Renewed Successfully';
                    templateName = 'certificate_renewed_success';
                    break;
                case 'certificate_renewed_failed':
                    subject = language === 'it' ? 'Rinnovo del certificato non riuscito' : 'Certificate Renewal Failed';
                    templateName = 'certificate_renewed_failed';
                    break;
                case 'certificate_issued_success':
                    subject = language === 'it' ? 'Certificato emesso con successo' : 'Certificate Issued Successfully';
                    templateName = 'certificate_issued_success';
                    break;
                case 'certificate_issued_failed':
                    subject = language === 'it' ? 'Emissione del certificato non riuscita' : 'Certificate Issuance Failed';
                    templateName = 'certificate_issued_failed';
                    break;
                case 'post_script_success':
                    subject = language === 'it' ? 'Script post-esecuzione riuscito' : 'Post Script Succeeded';
                    templateName = 'post_script_success';
                    break;
                case 'post_script_failed':
                    subject = language === 'it' ? 'Script post-esecuzione non riuscito' : 'Post Script Failed';
                    templateName = 'post_script_failed';
                    break;
            }

            // Send email using template
            const emailSent = await this.emailService.sendEmail(
                user.email,
                subject,
                templateName,
                templateVariables,
                language
            );

            if (!emailSent) {
                throw new Error('Email sending failed');
            }

            logEntry.status = 'sent';
            logEntry.sentAt = new Date();
            await logEntry.save();

            this.logger.info(`Email sent successfully to ${user.email} for ${alertType}`);
        } catch (error: any) {
            logEntry.status = 'failed';
            logEntry.error = error.message;
            await logEntry.save();

            this.logger.error(`Failed to send email to ${user.email}: ${error.message}`);
            throw error;
        }
    }

    private async sendWebhooks(alertType: AlertType, metadata: NotificationMetadata): Promise<void> {
        const webhooks = await Webhook.find({ enabled: true, events: alertType });
        if (webhooks.length === 0) return;

        const payload = {
            event: alertType,
            timestamp: new Date().toISOString(),
            data: metadata,
        };
        const body = JSON.stringify(payload);

        for (const webhook of webhooks) {
            const logEntry = new NotificationLog({
                alertType,
                webhookId: webhook._id,
                channel: 'webhook',
                recipient: webhook.url,
                status: 'pending',
                metadata,
            });

            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'X-Webhook-Event': alertType,
                    'X-Webhook-Timestamp': String(Date.now()),
                    ...(webhook.headers as any || {}),
                };

                if (webhook.secret) {
                    const sig = createHmac('sha256', webhook.secret).update(body).digest('hex');
                    headers['X-Webhook-Signature'] = `sha256=${sig}`;
                }

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(webhook.url, { method: 'POST', headers, body, signal: controller.signal });
                clearTimeout(timeout);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText}`);
                }

                logEntry.status = 'sent';
                logEntry.sentAt = new Date();
                await logEntry.save();

                this.logger.info(`Webhook delivered to ${webhook.url} for ${alertType}`);
            } catch (error: any) {
                logEntry.status = 'failed';
                logEntry.error = error.message;
                await logEntry.save();

                this.logger.error(`Webhook delivery failed to ${webhook.url}: ${error.message}`);
            }
        }
    }
}

export const notificationService = new NotificationService();