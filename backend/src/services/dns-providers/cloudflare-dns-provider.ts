import { Logger } from '../logger.service';
import { BaseDnsProvider } from './base-dns-provider';

/**
 * Cloudflare DNS provider implementation
 * Requires credentials: apiToken
 * Optional: zoneId (if not provided, will auto-detect from domain)
 */
export class CloudflareDnsProvider extends BaseDnsProvider {
    readonly type = 'cloudflare';
    private logger = new Logger('Cloudflare');

    getRequiredCredentials(): string[] {
        return ['apiToken'];
    }

    getOptionalCredentials(): string[] {
        return ['zoneId'];
    }

    /**
     * Get zone ID for a domain
     * If zoneId is provided in credentials, use it
     * Otherwise, query Cloudflare API to find the zone
     */
    private async getZoneId(domain: string, apiToken: string, providedZoneId?: string): Promise<string> {
        if (providedZoneId) {
            return providedZoneId;
        }

        // Extract base domain (e.g., example.com from sub.example.com)
        const parts = domain.split('.');
        const baseDomain = parts.slice(-2).join('.');

        // Query Cloudflare to find zone
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones?name=${baseDomain}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json() as any;

        if (!data.success || !data.result || data.result.length === 0) {
            throw new Error(`Could not find Cloudflare zone for domain: ${baseDomain}`);
        }

        return data.result[0].id;
    }

    async createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiToken, zoneId: providedZoneId } = credentials;
        const zoneId = await this.getZoneId(domain, apiToken, providedZoneId);

        const response1 = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${recordName}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            });
        const data1 = await response1.json() as any;
        if (data1.success && data1.result_info.total_count > 0) {
            this.logger.info(`TXT record ${recordName} already exists. Skipping creation.`);
            return;
        }

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'TXT',
                    name: recordName,
                    content: value,
                    ttl: 120 // 2 minutes for faster propagation
                })
            }
        );

        const data = await response.json() as any;

        if (!data.success) {
            throw new Error(`Cloudflare API error: ${data.errors?.map((e: any) => e.message).join(', ')}`);
        }

        this.logger.info(`Created TXT record ${recordName} = ${value}`);
    }

    async deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiToken, zoneId: providedZoneId } = credentials;
        const zoneId = await this.getZoneId(domain, apiToken, providedZoneId);

        // First, find the record ID
        const listResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&name=${recordName}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const listData = await listResponse.json() as any;

        if (!listData.success || listData.result.length === 0) {
            this.logger.warn(`Record ${recordName} not found for deletion`);
            return;
        }

        // Delete the record
        const recordId = listData.result[0].id;
        const deleteResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const deleteData = await deleteResponse.json() as any;

        if (!deleteData.success) {
            throw new Error(`Cloudflare API error: ${deleteData.errors?.map((e: any) => e.message).join(', ')}`);
        }

        this.logger.info(`Deleted TXT record ${recordName}`);
    }

    async verifyTxtRecord(
        domain: string,
        recordName: string,
        expectedValue: string,
        credentials: Record<string, string>
    ): Promise<boolean> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiToken, zoneId: providedZoneId } = credentials;
        const zoneId = await this.getZoneId(domain, apiToken, providedZoneId);

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&name=${recordName}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json() as any;

        if (!data.success || data.result_info.total_count === 0) {
            return false;
        }

        // Check if any record matches the expected value
        const recordExists = data.result.some((record: any) => record.content === expectedValue);
        return recordExists;
    }

    async validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; messageKey: string }> {
        try {
            this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

            const { apiToken, zoneId } = credentials;

            // If zoneId is provided, test it specifically
            if (zoneId) {
                const response = await fetch(
                    `https://api.cloudflare.com/client/v4/zones/${zoneId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${apiToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const data = await response.json() as any;

                if (data.success) {
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
            } else {
                // Just validate the API token by listing zones
                const response = await fetch(
                    'https://api.cloudflare.com/client/v4/zones?per_page=1',
                    {
                        headers: {
                            'Authorization': `Bearer ${apiToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const data = await response.json() as any;

                if (data.success) {
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
            }
        } catch (error: any) {
            return {
                valid: false,
                messageKey: 'dnsProviders.test.failed'
            };
        }
    }
}
