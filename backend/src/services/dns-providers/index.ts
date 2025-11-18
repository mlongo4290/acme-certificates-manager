export * from './azure-dns-provider';
export * from './base-dns-provider';
export * from './cloudflare-dns-provider';
export * from './digitalocean-dns-provider';
export * from './dns-provider-factory';
export * from './godaddy-dns-provider';
export * from './google-dns-provider';
export * from './manual-dns-provider';
export * from './namecheap-dns-provider';
export * from './ovh-dns-provider';
export * from './route53-dns-provider';

// Import provider classes for registration
import { AzureDnsProvider } from './azure-dns-provider';
import { CloudflareDnsProvider } from './cloudflare-dns-provider';
import { DigitalOceanDnsProvider } from './digitalocean-dns-provider';
import { DnsProviderFactory } from './dns-provider-factory';
import { GoDaddyDnsProvider } from './godaddy-dns-provider';
import { GoogleCloudDnsProvider } from './google-dns-provider';
import { ManualDnsProvider } from './manual-dns-provider';
import { NamecheapDnsProvider } from './namecheap-dns-provider';
import { OvhDnsProvider } from './ovh-dns-provider';
import { Route53DnsProvider } from './route53-dns-provider';

// Register all available providers
DnsProviderFactory.registerProvider('manual', ManualDnsProvider);
DnsProviderFactory.registerProvider('cloudflare', CloudflareDnsProvider);
DnsProviderFactory.registerProvider('route53', Route53DnsProvider);
DnsProviderFactory.registerProvider('google', GoogleCloudDnsProvider);
DnsProviderFactory.registerProvider('digitalocean', DigitalOceanDnsProvider);
DnsProviderFactory.registerProvider('azure', AzureDnsProvider);
DnsProviderFactory.registerProvider('ovh', OvhDnsProvider);
DnsProviderFactory.registerProvider('godaddy', GoDaddyDnsProvider);
DnsProviderFactory.registerProvider('namecheap', NamecheapDnsProvider);
