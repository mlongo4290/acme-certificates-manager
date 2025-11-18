import { Logger } from '../logger.service';
import { BaseDnsProvider } from './base-dns-provider';

/**
 * Manual DNS provider - requires user to manually create DNS records
 * This is the default fallback when no automated provider is configured
 */
export class ManualDnsProvider extends BaseDnsProvider {
    readonly type = 'manual';
    private logger: Logger;

    constructor() {
        super();
        this.logger = new Logger('Manual DNS Provider');
    }

    getRequiredCredentials(): string[] {
        return []; // No credentials needed for manual mode
    }

    async createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void> {
        // In manual mode, we just log the instructions
        // The actual record creation is done by the user
        this.logger.warn('\n=== MANUAL DNS RECORD CREATION REQUIRED ===');
        this.logger.info(`Domain: ${domain}`);
        this.logger.info(`Record Name: ${recordName}`);
        this.logger.info(`Record Type: TXT`);
        this.logger.info(`Record Value: ${value}`);
        this.logger.info(`TTL: 300 (or as low as your DNS provider allows)`);
        this.logger.warn('\nPlease create this DNS record in your DNS provider\'s control panel.');
        this.logger.info('The system will wait for DNS propagation before continuing...');
        this.logger.warn('===========================================\n');

        // Return immediately - user must create record manually
        return Promise.resolve();
    }

    async deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.logger.warn(`\n[Manual Mode] Please manually delete DNS record: ${recordName}`);
        return Promise.resolve();
    }

    async verifyTxtRecord(
        domain: string,
        recordName: string,
        expectedValue: string,
        credentials: Record<string, string>
    ): Promise<boolean> {
        // Manual mode cannot verify - assume user has created the record
        this.logger.info(`[Manual Mode] Assuming DNS record ${recordName} has been created manually`);
        return Promise.resolve(true);
    }

    async validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; messageKey: string }> {
        return {
            valid: true,
            messageKey: 'dnsProviders.test.success'
        };
    }
}
