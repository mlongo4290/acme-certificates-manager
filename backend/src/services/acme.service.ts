import * as acme from "@peculiar/acme-client";
import * as x509 from "@peculiar/x509";
import crypto, { webcrypto } from 'crypto';
import { DnsProviderFactory } from './dns-providers';
import { Logger } from './logger.service';

export interface AcmeAccountInfo {
    accountUrl: string;
    status: string;
    contact: string[];
}

export interface AcmeTestResult {
    success: boolean;
    message: string;
}


export interface AcmeRegistrationResult {
    success: boolean;
    message: string;
    accountUrl?: string;
    accountKeyJwk?: any; // Account private key in JWK format
}

export interface CertificateResult {
    success: boolean;
    message: string;
    certificate?: string;
    privateKey?: string;
    fullChain?: string;
    expiryDate?: Date;
}

export type ProgressCallback = (message: string) => void;

export class AcmeService {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('ACME');
    }

    /**
     * Test connection to an ACME server
     */
    async testConnection(directoryUrl: string): Promise<AcmeTestResult> {
        try {
            // Use ECDSA P-256 for test (fast and compatible)
            const tempKeys = await webcrypto.subtle.generateKey(
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256',
                },
                false,
                ['sign', 'verify']
            );

            const client = await acme.ApiClient.create(
                tempKeys,
                directoryUrl,
                {
                    crypto: webcrypto
                }
            );

            // Fetch directory to verify server is reachable
            const directory = await client.getDirectory();

            return {
                success: true,
                message: `Successfully connected to ACME server. Available endpoints: ${Object.keys(directory).join(', ')}`
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Failed to connect to ACME server: ${error.message}`
            };
        }
    }

    /**
     * Register a new account with an ACME server
     */
    async registerAccount(
        directoryUrl: string,
        email: string,
        eabKeyId?: string,
        eabHmacKey?: string
    ): Promise<AcmeRegistrationResult> {
        try {
            // Get account key configuration from environment
            const accountKeyType = process.env.ACME_ACCOUNT_KEY_TYPE || 'RSA';
            const accountKeySize = parseInt(process.env.ACME_ACCOUNT_KEY_SIZE || '4096');

            // Generate account key pair based on configuration
            let accountKeyPair;

            if (accountKeyType === 'ECDSA') {
                // ECDSA P-256 (modern, fast, smaller keys)
                accountKeyPair = await webcrypto.subtle.generateKey(
                    {
                        name: 'ECDSA',
                        namedCurve: accountKeySize === 384 ? 'P-384' : accountKeySize === 521 ? 'P-521' : 'P-256',
                    },
                    true,
                    ['sign', 'verify']
                );
            } else {
                // RSA (traditional, widely compatible)
                accountKeyPair = await webcrypto.subtle.generateKey(
                    {
                        name: 'RSASSA-PKCS1-v1_5',
                        modulusLength: accountKeySize,
                        publicExponent: new Uint8Array([1, 0, 1]),
                        hash: 'SHA-256',
                    },
                    true,
                    ['sign', 'verify']
                );
            }

            const client = await acme.ApiClient.create(
                accountKeyPair,
                directoryUrl,
                {
                    crypto: webcrypto
                }
            );

            // Prepare account creation payload
            const accountPayload: any = {
                termsOfServiceAgreed: true,
                contact: [`mailto:${email}`]
            };

            // Add EAB if provided (required for some CAs like ZeroSSL, Actalis)
            if (eabKeyId && eabHmacKey) {
                // Normalize to base64url (library rejects standard base64 with +/=//)
                const hmacKeyBase64Url = eabHmacKey
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
                accountPayload.externalAccountBinding = {
                    kid: eabKeyId,
                    challenge: hmacKeyBase64Url
                };
            }

            // Create account
            const account = await client.newAccount(accountPayload);

            // Export the account key to JWK format for storage
            const accountKeyJwk = await webcrypto.subtle.exportKey('jwk', accountKeyPair.privateKey);

            // Get account URL from Location header
            const accountUrl = account.headers.location || '';

            return {
                success: true,
                message: `Account registered successfully. Status: ${account.content.status}`,
                accountUrl: accountUrl,
                accountKeyJwk
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Failed to register account: ${error.message}`
            };
        }
    }

    /**
     * Deactivate an ACME account at the CA
     */
    async deactivateAccount(
        directoryUrl: string,
        accountKeyJwk: any
    ): Promise<{ success: boolean; message: string }> {
        try {
            const alg = accountKeyJwk.kty === 'EC'
                ? { name: 'ECDSA', namedCurve: accountKeyJwk.crv || 'P-256' }
                : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

            const privateKey = await webcrypto.subtle.importKey('jwk', accountKeyJwk, alg, true, ['sign']);
            const pubJwk = { ...accountKeyJwk };
            delete pubJwk.d; delete pubJwk.p; delete pubJwk.q; delete pubJwk.dp; delete pubJwk.dq; delete pubJwk.qi;
            delete pubJwk.key_ops;
            const publicKey = await webcrypto.subtle.importKey('jwk', pubJwk, alg, true, ['verify']);

            const client = await acme.ApiClient.create(
                { privateKey, publicKey },
                directoryUrl,
                { crypto: webcrypto }
            );

            await client.deactivateAccount();

            return { success: true, message: 'Account deactivated at CA successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Get account information
     */
    async getAccountInfo(
        directoryUrl: string,
        accountKey: any
    ): Promise<AcmeAccountInfo | null> {
        try {
            const client = await acme.ApiClient.create(
                accountKey,
                directoryUrl,
                {
                    crypto: webcrypto
                }
            );

            const account = await client.newAccount({
                onlyReturnExisting: true
            });

            const accountUrl = account.headers.location || '';

            return {
                accountUrl: accountUrl,
                status: account.content.status,
                contact: account.content.contact || []
            };
        } catch (error: any) {
            this.logger.error('Failed to get account info:', error as Error);
            return null;
        }
    }

    /**
     * Issue a new certificate with DNS-01 challenge
     */
    async issueCertificateWithDns01(
        directoryUrl: string,
        accountKey: any,
        domains: string[],
        dnsProvider: any,
        dryRun = false
    ): Promise<CertificateResult> {
        // Get DNS provider instance once for reuse
        const providerType = dnsProvider.type || 'manual';
        const dnsProviderInstance = DnsProviderFactory.getProvider(providerType);

        try {
            // Get certificate key configuration from environment
            const certKeyType = process.env.ACME_CERT_KEY_TYPE || 'RSA';
            const certKeySize = parseInt(process.env.ACME_CERT_KEY_SIZE || '4096');

            this.logger.info(`Generating certificate key pair (${certKeyType} ${certKeySize})...`);

            // Generate certificate key pair based on configuration
            let certKeyPair;
            let signingAlgorithm: any;

            if (certKeyType === 'ECDSA') {
                // ECDSA (modern, efficient)
                const namedCurve = certKeySize === 384 ? 'P-384' : certKeySize === 521 ? 'P-521' : 'P-256';
                certKeyPair = await webcrypto.subtle.generateKey(
                    {
                        name: 'ECDSA',
                        namedCurve,
                    },
                    true,
                    ['sign', 'verify']
                );
                signingAlgorithm = {
                    name: 'ECDSA',
                    hash: 'SHA-256'
                };
            } else {
                // RSA (industry standard for SSL/TLS)
                certKeyPair = await webcrypto.subtle.generateKey(
                    {
                        name: 'RSASSA-PKCS1-v1_5',
                        modulusLength: certKeySize,
                        publicExponent: new Uint8Array([1, 0, 1]),
                        hash: 'SHA-256',
                    },
                    true,
                    ['sign', 'verify']
                );
                signingAlgorithm = {
                    name: 'RSASSA-PKCS1-v1_5',
                    hash: 'SHA-256'
                };
            }

            this.logger.info('Creating Certificate Signing Request (CSR)...');
            // Build subject with CN and SAN
            const subjectName = `CN=${domains[0]}`;
            const altNames = domains.map(domain => ({ type: 'dns', value: domain }));

            const csr = await x509.Pkcs10CertificateRequestGenerator.create({
                keys: certKeyPair,
                name: subjectName,
                signingAlgorithm,
                extensions: [
                    new x509.SubjectAlternativeNameExtension(altNames)
                ]
            }, webcrypto);

            this.logger.info('Connecting to ACME server...');
            const client = await acme.ApiClient.create(
                accountKey,
                directoryUrl,
                {
                    crypto: webcrypto
                }
            );

            // Retrieve existing account
            this.logger.info('Retrieving ACME account...');
            await client.newAccount({
                onlyReturnExisting: true
            });

            this.logger.info(`Creating order for domains: ${domains.join(', ')}`);
            const order = await client.newOrder({
                identifiers: domains.map(domain => ({
                    type: 'dns',
                    value: domain
                }))
            });

            this.logger.info('Retrieving authorizations...');
            const authorizations = await Promise.all(
                order.content.authorizations.map((url: string) => client.getAuthorization(url))
            );

            this.logger.info('Extracting DNS-01 challenges...');
            const challenges: any[] = [];
            for (const auth of authorizations) {
                const dnsChallenge = auth.content.challenges.find((c: any) => c.type === 'dns-01');
                if (!dnsChallenge) {
                    throw new Error(`DNS-01 challenge not available for domain ${auth.content.identifier.value}`);
                }
                challenges.push({
                    domain: auth.content.identifier.value,
                    challenge: dnsChallenge,
                    authUrl: auth.headers.location || ''
                });
            }

            this.logger.info('Creating DNS TXT records for challenge validation...');
            await this.createDnsChallengeRecords(challenges, dnsProvider, accountKey);

            const propagationTime = dnsProvider.dnsPropagationTime || 60;
            this.logger.info(`Waiting for DNS propagation (${propagationTime} seconds)...`);
            await this.sleep(propagationTime * 1000);

            this.logger.info('Verifying DNS records are propagated...');
            // Verify DNS records using the provider's API
            for (const challengeInfo of challenges) {
                try {
                    const verified = await dnsProviderInstance.verifyTxtRecord(
                        challengeInfo.domain,
                        challengeInfo.dnsRecordName,
                        challengeInfo.dnsValue,
                        dnsProvider.credentials
                    );

                    if (verified) {
                        this.logger.info(`  ✓ DNS record verified for ${challengeInfo.domain}`);
                    } else {
                        this.logger.warn(`  ⚠ DNS record not found for ${challengeInfo.domain}, but proceeding...`);
                    }
                } catch (error: any) {
                    this.logger.warn(`  ⚠ Could not verify DNS record for ${challengeInfo.domain}: ${error.message}`);
                }
            }

            this.logger.info('Requesting ACME server to validate challenges...');
            for (const challengeInfo of challenges) {
                this.logger.info(`  Validating challenge for ${challengeInfo.domain}...`);
                await client.getChallenge(challengeInfo.challenge.url, {});
            }

            this.logger.info('Waiting for ACME server to complete validation...');
            await this.sleep(5000);

            // Check authorization status before finalizing
            this.logger.info('Checking authorization status...');
            const authChecks = await Promise.all(
                order.content.authorizations.map((url: string) => client.getAuthorization(url))
            );

            const invalidAuths = authChecks.filter(auth => auth.content.status !== 'valid');
            if (invalidAuths.length > 0) {
                const details = invalidAuths.map(auth => {
                    const challenge = auth.content.challenges.find((c: any) => c.type === 'dns-01');
                    return `Domain: ${auth.content.identifier.value}, Status: ${auth.content.status}, Challenge status: ${challenge?.status}, Error: ${challenge?.error?.detail || 'N/A'}`;
                }).join('\n  ');
                throw new Error(`Authorization validation failed:\n  ${details}`);
            }

            this.logger.info('All authorizations valid.');

            if (dryRun) {
                this.logger.info('Dry-run: skipping order finalization. Cleaning up DNS records...');
                for (const challengeInfo of challenges) {
                    try {
                        await dnsProviderInstance.deleteTxtRecord(
                            challengeInfo.domain,
                            challengeInfo.dnsRecordName,
                            dnsProvider.credentials
                        );
                        this.logger.info(`  ✓ Deleted DNS record for ${challengeInfo.domain}`);
                    } catch (error: any) {
                        this.logger.warn(`  ⚠ Failed to delete DNS record for ${challengeInfo.domain}: ${error.message}`);
                    }
                }
                this.logger.info('Dry-run completed successfully. DNS challenge validated, certificate not issued.');
                return {
                    success: true,
                    message: 'Dry-run completed: DNS challenge validated successfully. Certificate not issued.'
                };
            }

            this.logger.info('Finalizing order...');
            let finalizedOrder = await client.finalize(order.content.finalize, {
                csr: csr.toString("base64url")
            });

            // Poll order status until it's ready
            this.logger.info('Waiting for certificate to be issued...');
            let attempts = 0;
            const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max
            while (finalizedOrder.content.status === 'processing' && attempts < maxAttempts) {
                await this.sleep(2000);
                finalizedOrder = await client.getOrder(order.headers.location!);
                attempts++;
                this.logger.info(`Order status: ${finalizedOrder.content.status} (attempt ${attempts}/${maxAttempts})`);
            }

            if (finalizedOrder.content.status !== 'valid') {
                throw new Error(`Order finalization failed. Status: ${finalizedOrder.content.status}`);
            }

            if (!finalizedOrder.content.certificate) {
                throw new Error('Certificate URL not found in finalized order');
            }

            this.logger.info('Downloading certificate...');
            const certificateResponse = await client.getCertificate(finalizedOrder.content.certificate);

            this.logger.info('Cleaning up DNS challenge records...');
            // Remove DNS TXT records that were created for challenges
            for (const challengeInfo of challenges) {
                try {
                    await dnsProviderInstance.deleteTxtRecord(
                        challengeInfo.domain,
                        challengeInfo.dnsRecordName,
                        dnsProvider.credentials
                    );
                    this.logger.info(`  ✓ Deleted DNS record for ${challengeInfo.domain}`);
                } catch (error: any) {
                    this.logger.warn(`  ⚠ Failed to delete DNS record for ${challengeInfo.domain}: ${error.message}`);
                }
            }

            this.logger.info('Certificate issued successfully!');

            // Convert ArrayBuffer[] to PEM strings
            const certBuffers = certificateResponse.content;
            const certificates = certBuffers.map(buffer => {
                const base64 = Buffer.from(buffer).toString('base64');
                return `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
            });

            const mainCert = certificates[0];
            const fullChain = certificates.join('\n');

            // Extract private key as PEM
            const privateKeyJwk = await webcrypto.subtle.exportKey('jwk', certKeyPair.privateKey);
            const privateKeyPem = await this.jwkToPem(privateKeyJwk);

            // Calculate expiry date (ACME certificates are typically 90 days)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 90);

            return {
                success: true,
                message: 'Certificate issued successfully',
                certificate: mainCert,
                privateKey: privateKeyPem,
                fullChain: fullChain,
                expiryDate
            };
        } catch (error: any) {
            this.logger.error(`Error: ${error.message}`);
            return {
                success: false,
                message: `Failed to issue certificate: ${error.message}`
            };
        }
    }

    /**
     * Create DNS TXT records for ACME challenge
     */
    private async createDnsChallengeRecords(
        challenges: any[],
        dnsProvider: any,
        accountKey: any
    ): Promise<void> {
        this.logger.info(`Setting DNS records via provider: ${dnsProvider.name}`);

        for (const challengeInfo of challenges) {
            const domain = challengeInfo.domain;
            const challenge = challengeInfo.challenge;

            // Calculate JWK thumbprint for the account key
            // Export the public key to JWK format
            const publicKeyJwk = await webcrypto.subtle.exportKey('jwk', accountKey.publicKey);

            // Create the JWK for thumbprint (only specific fields in lexicographic order)
            const thumbprintJwk = {
                e: publicKeyJwk.e,
                kty: publicKeyJwk.kty,
                n: publicKeyJwk.n
            };

            // Calculate SHA-256 of the JWK JSON
            const jwkJson = JSON.stringify(thumbprintJwk);
            const jwkHash = crypto.createHash('sha256');
            jwkHash.update(jwkJson);
            const jwkDigest = jwkHash.digest();

            // Convert to base64url
            const thumbprint = jwkDigest.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');

            // Build keyAuthorization according to RFC 8555: token + "." + thumbprint
            const keyAuthorization = `${challenge.token}.${thumbprint}`;

            // Calculate SHA-256 hash of keyAuthorization for DNS value
            const hash = crypto.createHash('sha256');
            hash.update(keyAuthorization);
            const digest = hash.digest();

            // Convert to base64url (RFC 4648 Section 5)
            const dnsValue = digest.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');

            this.logger.info(`  Creating _acme-challenge.${domain} TXT record with value: ${dnsValue.substring(0, 20)}...`);

            // Get the appropriate DNS provider implementation
            const providerType = dnsProvider.type || 'manual';
            const provider = DnsProviderFactory.getProvider(providerType);

            // Create the DNS record using the provider
            const recordName = `_acme-challenge.${domain}`;
            await provider.createTxtRecord(domain, recordName, dnsValue, dnsProvider.credentials);

            // Store recordName and dnsValue in challengeInfo for verification and cleanup
            challengeInfo.dnsRecordName = recordName;
            challengeInfo.dnsValue = dnsValue;

            this.logger.success(`DNS record created for ${domain}`);
        }
    }

    /**
     * Convert JWK to PEM format
     */
    private async jwkToPem(jwk: any): Promise<string> {
        // Determine algorithm from JWK
        const algorithm = jwk.kty === 'EC'
            ? { name: 'ECDSA', namedCurve: jwk.crv || 'P-256' }
            : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

        // Import JWK as CryptoKey
        const key = await webcrypto.subtle.importKey(
            'jwk',
            jwk,
            algorithm,
            true,
            ['sign']
        );

        // Export as PKCS#8 format (standard PEM private key format)
        const exported = await webcrypto.subtle.exportKey('pkcs8', key);

        // Convert ArrayBuffer to base64
        const exportedAsBase64 = Buffer.from(exported).toString('base64');

        // Format as PEM with proper line breaks (64 chars per line)
        const pemBody = exportedAsBase64.match(/.{1,64}/g)?.join('\n') || exportedAsBase64;

        return `-----BEGIN PRIVATE KEY-----\n${pemBody}\n-----END PRIVATE KEY-----`;
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate ACME directory URL format
     */
    isValidDirectoryUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' && parsed.pathname.includes('directory');
        } catch {
            return false;
        }
    }

    /**
     * Renew a certificate (placeholder for future implementation)
     */
    async renewCertificate(_domain: string): Promise<void> {
        // This will be implemented when we add full certificate management
        throw new Error('Certificate renewal not yet implemented');
    }

    /**
     * Revoke a certificate via ACME
     */
    async revokeCertificate(
        directoryUrl: string,
        accountKeyJwk: any,
        certificatePem: string,
        reason: number = 0
    ): Promise<{ success: boolean; message: string }> {
        try {
            const alg = accountKeyJwk.kty === 'EC'
                ? { name: 'ECDSA', namedCurve: accountKeyJwk.crv || 'P-256' }
                : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

            const privateKey = await webcrypto.subtle.importKey('jwk', accountKeyJwk, alg, true, ['sign']);
            const pubJwk = { ...accountKeyJwk };
            delete pubJwk.d; delete pubJwk.p; delete pubJwk.q;
            delete pubJwk.dp; delete pubJwk.dq; delete pubJwk.qi; delete pubJwk.key_ops;
            const publicKey = await webcrypto.subtle.importKey('jwk', pubJwk, alg, true, ['verify']);

            const client = await acme.ApiClient.create(
                { privateKey, publicKey },
                directoryUrl,
                { crypto: webcrypto }
            );

            // Retrieve existing account (required before any ACME operation)
            await client.newAccount({ onlyReturnExisting: true });

            // Parse PEM to DER buffer
            const pemBody = certificatePem
                .replace(/-----BEGIN CERTIFICATE-----/, '')
                .replace(/-----END CERTIFICATE-----/, '')
                .replace(/\s+/g, '');
            const derBuffer = Buffer.from(pemBody, 'base64');

            await client.revoke(derBuffer, reason);

            return { success: true, message: 'Certificate revoked successfully at CA' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }
}




