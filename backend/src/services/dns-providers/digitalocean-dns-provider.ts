import { Logger } from '../logger.service';
import { BaseDnsProvider } from './base-dns-provider';

/**
 * DigitalOcean DNS provider implementation
 * Requires credentials: apiToken
 */
export class DigitalOceanDnsProvider extends BaseDnsProvider {
    readonly type = 'digitalocean';
    private logger = new Logger('DigitalOcean');

    getRequiredCredentials(): string[] {
        return ['apiToken'];
    }

    async createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiToken } = credentials;

        // Extract base domain from recordName
        const baseDomain = this.extractBaseDomain(domain);
        const subdomain = recordName.replace(`.${baseDomain}`, '');

        const response = await fetch(
            `https://api.digitalocean.com/v2/domains/${baseDomain}/records`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'TXT',
                    name: subdomain,
                    data: value,
                    ttl: 300
                })
            }
        );

        const data = await response.json() as any;

        if (!response.ok) {
            throw new Error(`DigitalOcean API error: ${data.message || response.statusText}`);
        }

        this.logger.info(`Created TXT record ${recordName} = ${value}`);
    }

    async deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiToken } = credentials;
        const baseDomain = this.extractBaseDomain(domain);
        const subdomain = recordName.replace(`.${baseDomain}`, '');

        // First, find the record
        const listResponse = await fetch(
            `https://api.digitalocean.com/v2/domains/${baseDomain}/records?type=TXT&name=${subdomain}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const listData = await listResponse.json() as any;

        if (!listResponse.ok || !listData.domain_records || listData.domain_records.length === 0) {
            this.logger.warn(`Record ${recordName} not found for deletion`);
            return;
        }

        const recordId = listData.domain_records[0].id;

        // Delete the record
        const deleteResponse = await fetch(
            `https://api.digitalocean.com/v2/domains/${baseDomain}/records/${recordId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${apiToken}`
                }
            }
        );

        if (!deleteResponse.ok) {
            throw new Error(`DigitalOcean API error: ${deleteResponse.statusText}`);
        }

        this.logger.info(`Deleted TXT record ${recordName}`);
    }

    async validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; messageKey: string }> {
        try {
            this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

            const { apiToken } = credentials;

            // Test credentials by fetching account info
            const response = await fetch('https://api.digitalocean.com/v2/account', {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json() as any;

            if (response.ok) {
                return {
                    valid: true,
                    messageKey: 'dnsProviders.test.success'
                };
            } else {
                return {
                    valid: false,
                    messageKey: 'dnsProviders.test.invalidCredentials'
                };
            }
        } catch (error: any) {
            return {
                valid: false,
                messageKey: 'dnsProviders.test.failed'
            };
        }
    }

    private extractBaseDomain(domain: string): string {
        // Simple extraction - get last two parts of domain
        const parts = domain.split('.');
        return parts.slice(-2).join('.');
    }
}
