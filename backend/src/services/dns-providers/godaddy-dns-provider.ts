import { Logger } from '../logger.service';
import { BaseDnsProvider } from './base-dns-provider';

/**
 * GoDaddy DNS provider implementation
 * Requires credentials: apiKey, apiSecret
 * 
 * GoDaddy API Documentation: https://developer.godaddy.com/doc/endpoint/domains
 */
export class GoDaddyDnsProvider extends BaseDnsProvider {
    readonly type = 'godaddy';
    private logger = new Logger('GoDaddy');

    getRequiredCredentials(): string[] {
        return ['apiKey', 'apiSecret'];
    }

    async createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiKey, apiSecret } = credentials;

        // Extract base domain and record name
        const baseDomain = this.extractBaseDomain(domain);
        const subdomain = recordName.replace(`.${baseDomain}`, '') || '@';

        const response = await fetch(
            `https://api.godaddy.com/v1/domains/${baseDomain}/records/TXT/${subdomain}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `sso-key ${apiKey}:${apiSecret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([
                    {
                        data: value,
                        ttl: 600
                    }
                ])
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GoDaddy API error: ${errorText || response.statusText}`);
        }

        this.logger.info(`Created TXT record ${recordName} = ${value}`);
    }

    async deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiKey, apiSecret } = credentials;
        const baseDomain = this.extractBaseDomain(domain);
        const subdomain = recordName.replace(`.${baseDomain}`, '') || '@';

        // GoDaddy requires replacing the records, so we set empty array to delete
        const response = await fetch(
            `https://api.godaddy.com/v1/domains/${baseDomain}/records/TXT/${subdomain}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `sso-key ${apiKey}:${apiSecret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([])
            }
        );

        if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            throw new Error(`GoDaddy API error: ${errorText || response.statusText}`);
        }

        this.logger.info(`Deleted TXT record ${recordName}`);
    }

    async validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; messageKey: string }> {
        try {
            this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

            const { apiKey, apiSecret } = credentials;

            // Test credentials by fetching available domains
            const response = await fetch('https://api.godaddy.com/v1/domains/available?checkType=FAST&domain=test.com', {
                headers: {
                    'Authorization': `sso-key ${apiKey}:${apiSecret}`
                }
            });

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
