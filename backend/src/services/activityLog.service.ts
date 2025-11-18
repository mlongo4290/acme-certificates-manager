import { Request } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { logger } from './logger.service';

export class ActivityLogService {
    /**
     * Estrae l'IP reale del client considerando proxy e header
     */
    private static getRealIpAddress(req?: Request): string | undefined {
        if (!req) return undefined;

        // Con trust proxy abilitato, req.ip dovrebbe già contenere l'IP corretto
        // Ma controlliamo anche gli header come fallback
        return req.ip ||
            req.headers['x-real-ip'] as string ||
            (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    }

    /**
     * Crea un log di attività
     */
    static async log(
        type: string,
        req?: Request,
        metadata?: any
    ): Promise<void> {
        // Controlla se l'activity logging è abilitato
        const enabled = process.env.ACTIVITY_LOG_ENABLED !== 'false';
        if (!enabled) {
            return;
        }

        try {
            const user = (req as any)?.user;

            const metadataToSave = {
                ...metadata,
                ipAddress: this.getRealIpAddress(req),
                userAgent: req?.get('user-agent'),
            };

            // Remove circular references by using a safe serializer
            const seen = new WeakSet();
            const safeMetadata = JSON.parse(JSON.stringify(metadataToSave, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[Circular]';
                    }
                    seen.add(value);
                }
                return value;
            }));

            await ActivityLog.create({
                type,
                userId: user?.userId,
                username: user?.username,
                metadata: safeMetadata,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error(`Error creating activity log: ${error}`);
            // Non lanciare errore per non bloccare l'operazione principale
        }
    }

    /**
     * Log per creazione certificato
     */
    static async logCertificateCreated(domain: string, certificateId: string, req?: Request): Promise<void> {
        await this.log(
            'certificateCreated',
            req,
            {
                resourceType: 'certificate',
                resourceId: certificateId,
                resourceName: domain,
            }
        );
    }

    /**
     * Log per emissione certificato
     */
    static async logCertificateIssued(domain: string, certificateId: string, req?: Request): Promise<void> {
        await this.log(
            'certificateIssued',
            req,
            {
                resourceType: 'certificate',
                resourceId: certificateId,
                resourceName: domain,
            }
        );
    }

    /**
     * Log per rinnovo certificato
     */
    static async logCertificateRenewed(domain: string, certificateId: string, req?: Request): Promise<void> {
        await this.log(
            'certificateRenewed',
            req,
            {
                resourceType: 'certificate',
                resourceId: certificateId,
                resourceName: domain,
            }
        );
    }

    /**
     * Log per aggiornamento certificato
     */
    static async logCertificateUpdated(
        domain: string,
        certificateId: string,
        req?: Request
    ): Promise<void> {
        await this.log(
            'certificateUpdated',
            req,
            {
                resourceType: 'certificate',
                resourceId: certificateId,
                resourceName: domain
            }
        );
    }

    /**
     * Log per eliminazione certificato
     */
    static async logCertificateDeleted(domain: string, certificateId: string, req?: Request): Promise<void> {
        await this.log(
            'certificateDeleted',
            req,
            {
                resourceType: 'certificate',
                resourceId: certificateId,
                resourceName: domain,
            }
        );
    }

    /**
     * Log per errore certificato
     */
    static async logCertificateError(
        domain: string,
        certificateId: string,
        error: Error,
        req?: Request
    ): Promise<void> {
        await this.log(
            'certificateError',
            req,
            {
                resourceType: 'certificate',
                resourceId: certificateId,
                resourceName: domain,
                errorMessage: error.message,
                errorStack: error.stack,
            }
        );
    }

    /**
     * Log per DNS provider aggiunto
     */
    static async logDnsProviderAdded(name: string, providerId: string, req?: Request): Promise<void> {
        await this.log(
            'dnsProviderAdded',
            req,
            {
                resourceType: 'dnsProvider',
                resourceId: providerId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per DNS provider aggiornato
     */
    static async logDnsProviderUpdated(name: string, providerId: string, req?: Request): Promise<void> {
        await this.log(
            'dnsProviderUpdated',
            req,
            {
                resourceType: 'dnsProvider',
                resourceId: providerId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per DNS provider eliminato
     */
    static async logDnsProviderDeleted(name: string, providerId: string, req?: Request): Promise<void> {
        await this.log(
            'dnsProviderDeleted',
            req,
            {
                resourceType: 'dnsProvider',
                resourceId: providerId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per test DNS provider
     */
    static async logDnsProviderTest(
        name: string,
        providerId: string,
        success: boolean,
        req?: Request,
        message?: string
    ): Promise<void> {
        await this.log(
            success ? 'dnsProviderTestSuccess' : 'dnsProviderTestFailed',
            req,
            {
                resourceType: 'dnsProvider',
                resourceId: providerId,
                resourceName: name,
                testResult: success,
                message: message
            }
        );
    }

    /**
     * Log per CA aggiunta
     */
    static async logCaAdded(name: string, caId: string, req?: Request): Promise<void> {
        await this.log(
            'caAdded',
            req,
            {
                resourceType: 'ca',
                resourceId: caId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per CA aggiornata
     */
    static async logCaUpdated(name: string, caId: string, req?: Request): Promise<void> {
        await this.log(
            'caUpdated',
            req,
            {
                resourceType: 'ca',
                resourceId: caId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per CA eliminata
     */
    static async logCaDeleted(name: string, caId: string, req?: Request): Promise<void> {
        await this.log(
            'caDeleted',
            req,
            {
                resourceType: 'ca',
                resourceId: caId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per CA impostata come default
     */
    static async logCaSetDefault(name: string, caId: string, req?: Request): Promise<void> {
        await this.log(
            'caSetDefault',
            req,
            {
                resourceType: 'ca',
                resourceId: caId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per ACME account creato
     */
    static async logAcmeAccountCreated(email: string, accountId: string, req?: Request): Promise<void> {
        await this.log(
            'acmeAccountCreated',
            req,
            {
                resourceType: 'acmeAccount',
                resourceId: accountId,
                resourceName: email,
            }
        );
    }

    /**
     * Log per ACME account registrato
     */
    static async logAcmeAccountRegistered(email: string, accountId: string, req?: Request): Promise<void> {
        await this.log(
            'acmeAccountRegistered',
            req,
            {
                resourceType: 'acmeAccount',
                resourceId: accountId,
                resourceName: email,
            }
        );
    }

    /**
     * Log per ACME account eliminato
     */
    static async logAcmeAccountDeleted(email: string, accountId: string, req?: Request): Promise<void> {
        await this.log(
            'acmeAccountDeleted',
            req,
            {
                resourceType: 'acmeAccount',
                resourceId: accountId,
                resourceName: email,
            }
        );
    }

    /**
     * Log per utente creato
     */
    static async logUserCreated(username: string, userId: string, req?: Request): Promise<void> {
        await this.log(
            'userCreated',
            req,
            {
                resourceType: 'user',
                resourceId: userId,
                resourceName: username,
            }
        );
    }

    /**
     * Log per utente aggiornato
     */
    static async logUserUpdated(username: string, userId: string, req?: Request): Promise<void> {
        await this.log(
            'userUpdated',
            req,
            {
                resourceType: 'user',
                resourceId: userId,
                resourceName: username,
            }
        );
    }

    /**
     * Log per utente eliminato
     */
    static async logUserDeleted(username: string, userId: string, req?: Request): Promise<void> {
        await this.log(
            'userDeleted',
            req,
            {
                resourceType: 'user',
                resourceId: userId,
                resourceName: username,
            }
        );
    }

    /**
     * Log per provider di autenticazione aggiunto
     */
    static async logAuthProviderAdded(name: string, providerId: string, req?: Request): Promise<void> {
        await this.log(
            'authProviderAdded',
            req,
            {
                resourceType: 'authProvider',
                resourceId: providerId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per provider di autenticazione aggiornato
     */
    static async logAuthProviderUpdated(name: string, providerId: string, req?: Request): Promise<void> {
        await this.log(
            'authProviderUpdated',
            req,
            {
                resourceType: 'authProvider',
                resourceId: providerId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per provider di autenticazione eliminato
     */
    static async logAuthProviderDeleted(name: string, providerId: string, req?: Request): Promise<void> {
        await this.log(
            'authProviderDeleted',
            req,
            {
                resourceType: 'authProvider',
                resourceId: providerId,
                resourceName: name,
            }
        );
    }

    /**
     * Log per login utente
     */
    static async logUserLogin(username: string, userId: string, req?: Request): Promise<void> {
        await this.log(
            'userLogin',
            req,
            {
                resourceType: 'user',
                resourceId: userId,
                resourceName: username,
            }
        );
    }

    /**
     * Log per errore di sistema
     */
    static async logSystemError(error: Error, context?: string, req?: Request): Promise<void> {
        await this.log(
            'systemError',
            req,
            {
                errorMessage: error.message,
                errorStack: error.stack,
                context,
            }
        );
    }

    /**
     * Log per esecuzione script post-emissione con successo
     */
    static async logPostScriptExecuted(
        scriptPath: string,
        domain: string,
        certificateId: string,
        output: string,
        req?: Request
    ): Promise<void> {
        await this.log(
            'postScriptExecuted',
            req,
            {
                resourceType: 'certificate',
                resourceId: certificateId,
                resourceName: domain,
                scriptPath,
                output,
            }
        );
    }

    /**
     * Log per errore esecuzione script post-emissione
     */
    static async logPostScriptFailed(
        scriptPath: string,
        domain: string,
        certificateId: string,
        error: string,
        req?: Request
    ): Promise<void> {
        await this.log(
            'postScriptFailed',
            req,
            {
                resourceType: 'certificate',
                resourceId: certificateId,
                resourceName: domain,
                scriptPath,
                errorMessage: error,
            }
        );
    }
}
