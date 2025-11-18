import { Logger } from '../logger.service';
import { BaseDnsProvider } from './base-dns-provider';

/**
 * OVH DNS provider implementation
 * Requires credentials: endpoint, applicationKey, applicationSecret, consumerKey, zoneName
 * 
 * OVH API endpoints:
 * - ovh-eu: https://eu.api.ovh.com/1.0
 * - ovh-ca: https://ca.api.ovh.com/1.0
 * - ovh-us: https://api.us.ovhcloud.com/1.0
 * 
 * Note: This implementation requires the ovh package.
 * Install with: npm install ovh
 */
export class OvhDnsProvider extends BaseDnsProvider {
    readonly type = 'ovh';
    private logger = new Logger('OVH');

    getRequiredCredentials(): string[] {
        return ['endpoint', 'applicationKey', 'applicationSecret', 'consumerKey', 'zoneName'];
    }

    async createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        throw new Error(
            'OVH DNS provider requires the ovh package. ' +
            'Install with: npm install ovh\n\n' +
            'Then uncomment the implementation below.'
        );

        // TODO: Uncomment after installing ovh package
        /*
        const ovh = require('ovh');

        const { endpoint, applicationKey, applicationSecret, consumerKey, zoneName } = credentials;

        const client = ovh({
            endpoint,
            appKey: applicationKey,
            appSecret: applicationSecret,
            consumerKey
        });

        // Extract subdomain
        const subdomain = recordName.replace(`.${zoneName}`, '') || '@';

        // Create the TXT record
        await client.requestPromised('POST', `/domain/zone/${zoneName}/record`, {
            fieldType: 'TXT',
            subDomain: subdomain,
            target: value,
            ttl: 60
        });

        // Refresh the zone to apply changes
        await client.requestPromised('POST', `/domain/zone/${zoneName}/refresh`);

        this.logger.info(`Created TXT record ${recordName} = ${value}`);
        */
    }

    async deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        throw new Error(
            'OVH DNS provider requires the ovh package. ' +
            'Install with: npm install ovh'
        );

        // TODO: Uncomment after installing ovh package
        /*
        const ovh = require('ovh');

        const { endpoint, applicationKey, applicationSecret, consumerKey, zoneName } = credentials;

        const client = ovh({
            endpoint,
            appKey: applicationKey,
            appSecret: applicationSecret,
            consumerKey
        });

        const subdomain = recordName.replace(`.${zoneName}`, '') || '@';

        try {
            // Find the record
            const recordIds = await client.requestPromised(
                'GET',
                `/domain/zone/${zoneName}/record`,
                {
                    fieldType: 'TXT',
                    subDomain: subdomain
                }
            );

            if (recordIds && recordIds.length > 0) {
                // Delete the record
                await client.requestPromised('DELETE', `/domain/zone/${zoneName}/record/${recordIds[0]}`);

                // Refresh the zone
                await client.requestPromised('POST', `/domain/zone/${zoneName}/refresh`);

                this.logger.info(`Deleted TXT record ${recordName}`);
            } else {
                this.logger.warn(`Record ${recordName} not found for deletion`);
            }
        } catch (error: any) {
            this.logger.warn(`Error deleting record: ${error.message}`);
        }
        */
    }

    async validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; messageKey: string }> {
        try {
            this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

            throw new Error(
                'OVH DNS provider requires the ovh package. ' +
                'Install with: npm install ovh'
            );

            // TODO: Uncomment after installing ovh package
            /*
            const ovh = require('ovh');

            const { endpoint, applicationKey, applicationSecret, consumerKey, zoneName } = credentials;

            const client = ovh({
                endpoint,
                appKey: applicationKey,
                appSecret: applicationSecret,
                consumerKey
            });

            // Test credentials by fetching zone info
            const zone = await client.requestPromised('GET', `/domain/zone/${zoneName}`);

            return {
                valid: true,
                messageKey: 'dnsProviders.test.success'
            };
            */
        } catch (error: any) {
            return {
                valid: false,
                messageKey: 'dnsProviders.test.failed'
            };
        }
    }
}
