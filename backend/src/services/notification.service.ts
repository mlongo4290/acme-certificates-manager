import { NotificationLog } from '../models/notificationLog.model';
import { User } from '../models/User';
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
            await this.emailService.sendEmail(
                user.email,
                subject,
                templateName,
                templateVariables,
                language
            );

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
}

export const notificationService = new NotificationService();