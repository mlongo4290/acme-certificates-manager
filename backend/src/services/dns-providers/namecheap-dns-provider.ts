import { Logger } from '../logger.service';
import { BaseDnsProvider } from './base-dns-provider';

/**
 * Namecheap DNS provider implementation
 * Requires credentials: apiUser, apiKey, clientIp
 * 
 * Note: Namecheap API requires whitelisting your server IP in their dashboard.
 * API Documentation: https://www.namecheap.com/support/api/methods/
 */
export class NamecheapDnsProvider extends BaseDnsProvider {
    readonly type = 'namecheap';
    private logger = new Logger('Namecheap');

    getRequiredCredentials(): string[] {
        return ['apiUser', 'apiKey', 'clientIp'];
    }

    async createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiUser, apiKey, clientIp } = credentials;

        // Extract SLD and TLD
        const { sld, tld } = this.parseDomain(domain);

        // Extract hostname (subdomain)
        const hostname = recordName.replace(`.${domain}`, '') || '@';

        // Get existing records first
        const getHostsUrl = new URL('https://api.namecheap.com/xml.response');
        getHostsUrl.searchParams.append('ApiUser', apiUser);
        getHostsUrl.searchParams.append('ApiKey', apiKey);
        getHostsUrl.searchParams.append('UserName', apiUser);
        getHostsUrl.searchParams.append('Command', 'namecheap.domains.dns.getHosts');
        getHostsUrl.searchParams.append('ClientIp', clientIp);
        getHostsUrl.searchParams.append('SLD', sld);
        getHostsUrl.searchParams.append('TLD', tld);

        const getResponse = await fetch(getHostsUrl.toString());
        const getXml = await getResponse.text();

        // Parse existing hosts (simplified - in production use XML parser)
        const existingHosts = this.parseNamecheapHosts(getXml);

        // Add new TXT record
        existingHosts.push({
            HostName: hostname,
            RecordType: 'TXT',
            Address: value,
            TTL: '60'
        });

        // Set all hosts (Namecheap requires sending all records at once)
        const setHostsUrl = new URL('https://api.namecheap.com/xml.response');
        setHostsUrl.searchParams.append('ApiUser', apiUser);
        setHostsUrl.searchParams.append('ApiKey', apiKey);
        setHostsUrl.searchParams.append('UserName', apiUser);
        setHostsUrl.searchParams.append('Command', 'namecheap.domains.dns.setHosts');
        setHostsUrl.searchParams.append('ClientIp', clientIp);
        setHostsUrl.searchParams.append('SLD', sld);
        setHostsUrl.searchParams.append('TLD', tld);

        // Add each host as parameters
        existingHosts.forEach((host, index) => {
            const num = index + 1;
            setHostsUrl.searchParams.append(`HostName${num}`, host.HostName);
            setHostsUrl.searchParams.append(`RecordType${num}`, host.RecordType);
            setHostsUrl.searchParams.append(`Address${num}`, host.Address);
            setHostsUrl.searchParams.append(`TTL${num}`, host.TTL);
        });

        const setResponse = await fetch(setHostsUrl.toString());
        const setXml = await setResponse.text();

        if (!setXml.includes('Status="OK"')) {
            throw new Error(`Namecheap API error: ${setXml}`);
        }

        this.logger.info(`Created TXT record ${recordName} = ${value}`);
    }

    async deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        const { apiUser, apiKey, clientIp } = credentials;
        const { sld, tld } = this.parseDomain(domain);
        const hostname = recordName.replace(`.${domain}`, '') || '@';

        // Get existing records
        const getHostsUrl = new URL('https://api.namecheap.com/xml.response');
        getHostsUrl.searchParams.append('ApiUser', apiUser);
        getHostsUrl.searchParams.append('ApiKey', apiKey);
        getHostsUrl.searchParams.append('UserName', apiUser);
        getHostsUrl.searchParams.append('Command', 'namecheap.domains.dns.getHosts');
        getHostsUrl.searchParams.append('ClientIp', clientIp);
        getHostsUrl.searchParams.append('SLD', sld);
        getHostsUrl.searchParams.append('TLD', tld);

        const getResponse = await fetch(getHostsUrl.toString());
        const getXml = await getResponse.text();

        // Parse and filter out the TXT record to delete
        const existingHosts = this.parseNamecheapHosts(getXml);
        const filteredHosts = existingHosts.filter(
            host => !(host.HostName === hostname && host.RecordType === 'TXT')
        );

        // Set remaining hosts
        const setHostsUrl = new URL('https://api.namecheap.com/xml.response');
        setHostsUrl.searchParams.append('ApiUser', apiUser);
        setHostsUrl.searchParams.append('ApiKey', apiKey);
        setHostsUrl.searchParams.append('UserName', apiUser);
        setHostsUrl.searchParams.append('Command', 'namecheap.domains.dns.setHosts');
        setHostsUrl.searchParams.append('ClientIp', clientIp);
        setHostsUrl.searchParams.append('SLD', sld);
        setHostsUrl.searchParams.append('TLD', tld);

        filteredHosts.forEach((host, index) => {
            const num = index + 1;
            setHostsUrl.searchParams.append(`HostName${num}`, host.HostName);
            setHostsUrl.searchParams.append(`RecordType${num}`, host.RecordType);
            setHostsUrl.searchParams.append(`Address${num}`, host.Address);
            setHostsUrl.searchParams.append(`TTL${num}`, host.TTL);
        });

        await fetch(setHostsUrl.toString());

        this.logger.info(`Deleted TXT record ${recordName}`);
    }

    async validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; messageKey: string }> {
        try {
            this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

            const { apiUser, apiKey, clientIp } = credentials;

            // Test credentials by pinging API
            const url = new URL('https://api.namecheap.com/xml.response');
            url.searchParams.append('ApiUser', apiUser);
            url.searchParams.append('ApiKey', apiKey);
            url.searchParams.append('UserName', apiUser);
            url.searchParams.append('Command', 'namecheap.domains.getList');
            url.searchParams.append('ClientIp', clientIp);

            const response = await fetch(url.toString());
            const xml = await response.text();

            if (xml.includes('Status="OK"')) {
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

    private parseDomain(domain: string): { sld: string; tld: string } {
        const parts = domain.split('.');
        return {
            tld: parts[parts.length - 1],
            sld: parts[parts.length - 2]
        };
    }

    private parseNamecheapHosts(xml: string): Array<{
        HostName: string;
        RecordType: string;
        Address: string;
        TTL: string;
    }> {
        // Simplified XML parsing - in production, use a proper XML parser like xml2js
        const hosts: Array<{ HostName: string; RecordType: string; Address: string; TTL: string }> = [];

        const hostRegex = /<host[^>]*HostName="([^"]*)"[^>]*RecordType="([^"]*)"[^>]*Address="([^"]*)"[^>]*TTL="([^"]*)"/g;
        let match;

        while ((match = hostRegex.exec(xml)) !== null) {
            hosts.push({
                HostName: match[1],
                RecordType: match[2],
                Address: match[3],
                TTL: match[4]
            });
        }

        return hosts;
    }
}
