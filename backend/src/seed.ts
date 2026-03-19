import dotenv from 'dotenv';
import { connect, disconnect } from 'mongoose';
import { AcmeCa } from './models/AcmeCa';
import { AuthProvider } from './models/AuthProvider';
import { DnsProvider } from './models/dnsProvider.model';
import { User } from './models/User';

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

export const seedInitialData = async () => {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ username: 'admin' });

        if (!existingAdmin) {
            // Create admin user
            const adminUser = new User({
                username: 'admin',
                password: 'admin',
                authProvider: 'local', // Will be hashed automatically by the pre-save hook
                role: 'ADMIN'
            });

            await adminUser.save();
            console.log('✓ Admin user created successfully');
            console.log('  Username: admin');
            console.log('  Password: admin');
            console.log('  Please change the password after first login');
        } else {
            console.log('✓ Admin user already exists');
        }

        // Check if local auth provider exists
        const existingLocalProvider = await AuthProvider.findOne({ type: 'local' });

        if (!existingLocalProvider) {
            // Create local auth provider
            const localProvider = new AuthProvider({
                name: 'Local',
                type: 'local',
                enabled: true,
                priority: 0
            });

            await localProvider.save();
            console.log('✓ Local authentication provider enabled');
        } else {
            console.log('✓ Local authentication provider already configured');
        }

        // Seed ACME CAs
        const officialCAs = [
            {
                name: 'ZeroSSL.com CA',
                server: 'https://acme.zerossl.com/v2/DV90',
                enabled: false,
                isDefault: true
            },
            {
                name: 'Letsencrypt.org CA',
                server: 'https://acme-v02.api.letsencrypt.org/directory',
                enabled: false,
                isDefault: false
            },
            {
                name: 'Letsencrypt.org CA (Staging)',
                server: 'https://acme-staging-v02.api.letsencrypt.org/directory',
                enabled: false,
                isDefault: false
            },
            {
                name: 'SSL.com CA',
                server: 'https://acme.ssl.com/sslcom-dv-rsa',
                enabled: false,
                isDefault: false
            },
            {
                name: 'Google.com Public CA',
                server: 'https://dv.acme-v02.api.pki.goog/directory',
                enabled: false,
                isDefault: false
            },
            {
                name: 'Actalis.com CA',
                server: 'https://acme.actalis.it/v02/acme/directory',
                enabled: false,
                isDefault: false
            },
            {
                name: 'Pebble Strict Mode',
                server: 'https://localhost:14000/dir',
                enabled: false,
                isDefault: false
            }
        ];

        let casCreated = 0;
        let casExisting = 0;

        for (const caData of officialCAs) {
            const existingCA = await AcmeCa.findOne({ name: caData.name });
            if (!existingCA) {
                const ca = new AcmeCa(caData);
                await ca.save();
                casCreated++;
                console.log(`  ✓ Created CA: ${caData.name}`);
            } else {
                casExisting++;
            }
        }

        if (casCreated > 0) {
            console.log(`✓ ${casCreated} ACME Certificate Authorities created`);
        }
        if (casExisting > 0) {
            console.log(`✓ ${casExisting} ACME Certificate Authorities already exist`);
        }

        // Seed DNS Providers
        const predefinedProviders = [
            {
                name: 'Cloudflare',
                type: 'cloudflare',
                description: 'Cloudflare DNS provider - requires API Token',
                enabled: false,
                credentials: new Map([
                    ['apiToken', ''],
                    ['zoneId', '']
                ])
            },
            {
                name: 'AWS Route53',
                type: 'route53',
                description: 'Amazon Route53 DNS provider - requires AWS credentials',
                enabled: false,
                credentials: new Map([
                    ['accessKeyId', ''],
                    ['secretAccessKey', ''],
                    ['hostedZoneId', ''],
                    ['region', 'us-east-1']
                ])
            },
            {
                name: 'Google Cloud DNS',
                type: 'google',
                description: 'Google Cloud DNS provider - requires service account',
                enabled: false,
                credentials: new Map([
                    ['projectId', ''],
                    ['keyFile', ''],
                    ['managedZone', '']
                ])
            },
            {
                name: 'DigitalOcean',
                type: 'digitalocean',
                description: 'DigitalOcean DNS provider - requires API token',
                enabled: false,
                credentials: new Map([
                    ['apiToken', '']
                ])
            },
            {
                name: 'Azure DNS',
                type: 'azure',
                description: 'Microsoft Azure DNS provider - requires application credentials',
                enabled: false,
                credentials: new Map([
                    ['subscriptionId', ''],
                    ['resourceGroupName', ''],
                    ['zoneName', ''],
                    ['tenantId', ''],
                    ['clientId', ''],
                    ['clientSecret', '']
                ])
            },
            {
                name: 'OVH',
                type: 'ovh',
                description: 'OVH DNS provider - requires API credentials',
                enabled: false,
                credentials: new Map([
                    ['endpoint', 'ovh-eu'],
                    ['applicationKey', ''],
                    ['applicationSecret', ''],
                    ['consumerKey', ''],
                    ['zoneName', '']
                ])
            },
            {
                name: 'GoDaddy',
                type: 'godaddy',
                description: 'GoDaddy DNS provider - requires API key and secret',
                enabled: false,
                credentials: new Map([
                    ['apiKey', ''],
                    ['apiSecret', '']
                ])
            },
            {
                name: 'Namecheap',
                type: 'namecheap',
                description: 'Namecheap DNS provider - requires API key and username',
                enabled: false,
                credentials: new Map([
                    ['apiUser', ''],
                    ['apiKey', ''],
                    ['clientIp', '']
                ])
            }
        ];

        let dnsProvidersCreated = 0;
        let dnsProvidersExisting = 0;

        for (const providerData of predefinedProviders) {
            const existingProvider = await DnsProvider.findOne({ name: providerData.name });
            if (!existingProvider) {
                const provider = new DnsProvider(providerData);
                await provider.save();
                dnsProvidersCreated++;
                console.log(`  ✓ Created DNS Provider: ${providerData.name}`);
            } else {
                dnsProvidersExisting++;
            }
        }

        if (dnsProvidersCreated > 0) {
            console.log(`✓ ${dnsProvidersCreated} DNS Providers created (disabled by default - configure credentials to enable)`);
        }
        if (dnsProvidersExisting > 0) {
            console.log(`✓ ${dnsProvidersExisting} DNS Providers already exist`);
        }
};

const seedData = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/acme-certificates-manager';
        await connect(mongoUri);
        console.log('Connected to MongoDB');

        await seedInitialData();

        await disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

// Only run directly (not when imported as a module)
if (require.main === module) {
    seedData();
}
