import { exec } from 'child_process';
import * as crypto from 'crypto';
import { webcrypto } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { AcmeAccount } from '../models/AcmeAccount';
import { AcmeCa } from '../models/AcmeCa';
import { Certificate } from '../models/certificate.model';
import { DnsProvider } from '../models/dnsProvider.model';
import { getCertificateExpiryDate } from '../utils/certificateParser';
import { decrypt, encrypt } from '../utils/encryption';
import { applyBlackoutWindows, getBlackoutWindows } from '../utils/renewalSchedule';
import { AcmeService } from './acme.service';
import { ActivityLogService } from './activityLog.service';
import { Logger } from './logger.service';
import { notificationService, ScriptResult } from './notification.service';
import { IScheduler } from './scheduler.interface';

const execAsync = promisify(exec);

export class CertificateService {
    private logger: Logger;

    constructor(
        private acmeService: AcmeService,
        private schedulerService?: IScheduler
    ) {
        this.logger = new Logger('CertificateService');
    }

    async createCertificate(certificateData: any) {
        // Create certificate record with pending status
        // User will manually trigger issuance via "Issue Certificate" button
        const certificate = await Certificate.create({
            ...certificateData,
            status: 'pending'
        });

        return certificate;
    }

    /**
     * Issue or renew a certificate
     */
    async issueCertificate(certificateId: string, options: { dryRun?: boolean; suppressNotification?: boolean } = {}) {
        const { dryRun = false, suppressNotification = false } = options;
        const certificate = await Certificate.findById(certificateId);
        if (!certificate) {
            throw new Error('Certificate not found');
        }

        // Create child logger with certificate context
        const certLogger = this.logger.child(`Certificate ${certificate.domain}`);

        try {
            if (!dryRun) {
                certificate.status = 'pending';
                await certificate.save();
            }

            certLogger.info('Starting certificate issuance...');

            // Get DNS provider if DNS-01 challenge
            let dnsProvider = null;
            if (certificate.challengeType === 'dns-01') {
                if (!certificate.dnsProvider) {
                    throw new Error('DNS provider is required for DNS-01 challenge');
                }

                certLogger.info('Loading DNS provider configuration...');
                const dnsProviderDoc: any = await DnsProvider.findById(certificate.dnsProvider);
                if (!dnsProviderDoc || !dnsProviderDoc.enabled) {
                    throw new Error('DNS provider not found or not enabled');
                }
                certLogger.info(`DNS provider: ${dnsProviderDoc.name}`);

                // Convert Mongoose Map to plain object for credentials
                const credentialsObj: Record<string, string> = {};
                if (dnsProviderDoc.credentials) {
                    dnsProviderDoc.credentials.forEach((value: string, key: string) => {
                        credentialsObj[key] = value;
                    });
                }

                // Create a plain object with provider data
                dnsProvider = {
                    name: dnsProviderDoc.name,
                    type: dnsProviderDoc.type,
                    credentials: credentialsObj,
                    dnsPropagationTime: dnsProviderDoc.dnsPropagationTime || 60
                };
            }

            // Build domain list: primary domain + additional domains
            const domains = [certificate.domain, ...(certificate.additionalDomains || [])];
            certLogger.info(`Domains: ${domains.join(', ')}`);

            // Load Certificate Authority
            certLogger.info('Loading Certificate Authority configuration...');
            const ca = await AcmeCa.findById(certificate.certificateAuthority);
            if (!ca || !ca.enabled) {
                throw new Error('Certificate Authority not found or not enabled');
            }
            certLogger.info(`Certificate Authority: ${ca.name}`);
            const directoryUrl = ca.server;

            // Load ACME account specified in the certificate
            certLogger.info('Loading ACME account...');
            if (!certificate.acmeAccount) {
                throw new Error('No ACME account specified for this certificate');
            }

            const acmeAccount = await AcmeAccount.findById(certificate.acmeAccount)
                .select('+accountKeyJwk'); // Explicitly select the private key field

            if (!acmeAccount) {
                throw new Error(`ACME account not found. Please select a valid account.`);
            }

            // Verify the account belongs to the same CA
            if (acmeAccount.caId.toString() !== ca.id) {
                throw new Error(`ACME account ${acmeAccount.email} does not belong to CA ${ca.name}`);
            }

            if (!acmeAccount.accountKeyJwk) {
                throw new Error(`ACME account ${acmeAccount.email} has no private key stored. Please re-register the account.`);
            }

            certLogger.info(`Using ACME account: ${acmeAccount.email}`);

            // Decrypt and parse the account key from JWK
            const decryptedKeyJson = decrypt(acmeAccount.accountKeyJwk);
            const accountKeyJwk = JSON.parse(decryptedKeyJson);

            // Import both private and public keys to create a CryptoKeyPair
            const privateKey = await crypto.subtle.importKey(
                'jwk',
                accountKeyJwk,
                {
                    name: 'RSASSA-PKCS1-v1_5',
                    hash: 'SHA-256',
                },
                true,
                ['sign']
            );

            // Create public key JWK from private key JWK (remove private components)
            const publicKeyJwk = {
                kty: accountKeyJwk.kty,
                n: accountKeyJwk.n,
                e: accountKeyJwk.e,
                alg: accountKeyJwk.alg,
                key_ops: ['verify']
            };

            const publicKey = await crypto.subtle.importKey(
                'jwk',
                publicKeyJwk,
                {
                    name: 'RSASSA-PKCS1-v1_5',
                    hash: 'SHA-256',
                },
                true,
                ['verify']
            );

            const accountKey: webcrypto.CryptoKeyPair = {
                privateKey,
                publicKey
            };

            if (certificate.challengeType === 'dns-01') {
                certLogger.info('Using DNS-01 challenge validation');

                // Use AcmeService for the actual certificate issuance
                const result = await this.acmeService.issueCertificateWithDns01(
                    directoryUrl,
                    accountKey,
                    domains,
                    dnsProvider!,
                    dryRun
                );

                if (!result.success) {
                    throw new Error(result.message);
                }

                if (!dryRun) {
                    // Encrypt and store certificate data in MongoDB
                    certificate.certificate = result.certificate!;
                    certificate.privateKey = encrypt(result.privateKey!); // Encrypt private key
                    certificate.fullChain = result.fullChain!;
                    certificate.status = 'valid';
                    certificate.issueDate = new Date();
                    certificate.lastRenewalAttempt = new Date();
                    certificate.lastRenewalStatus = 'success';

                    await certificate.save();

                    certLogger.success('Certificate stored in database!');
                }
            } else {
                throw new Error(`Challenge type ${certificate.challengeType} not yet implemented`);
            }

            let scriptResults: ScriptResult[] = [];
            if (!dryRun) {
                // Run post-issuance scripts and collect results
                scriptResults = await this.runPostIssueScript(certificate);

                // Send grouped notification (cert + scripts) unless caller handles it
                if (!suppressNotification) {
                    const expiryDate = getCertificateExpiryDate(certificate.certificate!);
                    await notificationService.sendNotification('certificate_issued_success', {
                        certificateId: certificateId,
                        domain: certificate.domain,
                        expiryDate: expiryDate?.toISOString(),
                        scriptResults,
                    }).catch(err => certLogger.error(`Failed to send notification: ${err.message}`));
                }
            }

            return {
                success: true,
                message: 'Certificate issued successfully',
                scriptResults,
            };
        } catch (error: any) {
            certLogger.error(`Error: ${error.message}`);
            if (!dryRun) {
                certificate.status = 'error';
                certificate.lastRenewalAttempt = new Date();
                certificate.lastRenewalStatus = 'failed';
                await certificate.save();

                // Send failure notification
                await notificationService.sendNotification('certificate_issued_failed', {
                    certificateId: certificateId,
                    domain: certificate.domain,
                    error: error.message,
                }).catch(err => certLogger.error(`Failed to send notification: ${err.message}`));
            }

            throw error;
        }
    }

    async renewCertificate(certificateId: string) {
        const certificate = await Certificate.findById(certificateId);
        if (!certificate) {
            throw new Error('Certificate not found');
        }

        // Skip renewal if certificate is disabled
        if (certificate.enabled === false) {
            this.logger.info(`Skipping renewal for disabled certificate ${certificate.domain}`);
            return { success: false, message: 'Certificate is disabled' };
        }

        try {
            // Reuse the issueCertificate method for renewal, suppress its own notification
            const issueResult = await this.issueCertificate(certificateId, { suppressNotification: true });

            // Log successful renewal (automatic renewal from scheduler)
            await ActivityLogService.logCertificateRenewed(certificate.domain, certificateId);

            // Reset retry counter on success
            await Certificate.updateOne({ _id: certificateId }, { renewalRetryCount: 0 });

            // CRITICAL: Re-schedule the next renewal if auto-renewal is still enabled
            if (certificate.autoRenewal && certificate.renewalSchedule && this.schedulerService) {
                // Fetch updated certificate to get the new expiry date
                const updatedCert = await Certificate.findById(certificateId);
                if (updatedCert?.certificate) {
                    const expiryDate = getCertificateExpiryDate(updatedCert.certificate);
                    if (expiryDate) {
                        const nextRenewalDate = this.calculateRenewalDate(expiryDate, updatedCert.renewalSchedule);
                        await this.schedulerService.scheduleRenewal(certificateId, nextRenewalDate);

                        this.logger.info(`Re-scheduled next renewal for ${certificate.domain} at ${nextRenewalDate.toISOString()}`);
                    }

                    // Send single grouped notification (cert + scripts)
                    await notificationService.sendNotification('certificate_renewed_success', {
                        certificateId: certificateId,
                        domain: certificate.domain,
                        expiryDate: expiryDate?.toISOString(),
                        scriptResults: issueResult.scriptResults,
                    }).catch(err => this.logger.error(`Failed to send notification: ${err.message}`));
                }
            }

            return { success: true, message: 'Certificate renewed successfully' };
        } catch (error: any) {
            // Log renewal error
            await ActivityLogService.logCertificateError(certificate.domain, certificateId, error.message);

            // Retry logic: schedule a retry with exponential backoff
            const maxRetries = parseInt(process.env.RENEWAL_MAX_RETRIES || '3');
            const baseDelayMinutes = parseInt(process.env.RENEWAL_RETRY_BASE_DELAY_MINUTES || '30');
            const currentRetryCount = certificate.renewalRetryCount || 0;

            if (currentRetryCount < maxRetries && this.schedulerService) {
                const delayMinutes = baseDelayMinutes * Math.pow(2, currentRetryCount);
                const retryDate = new Date(Date.now() + delayMinutes * 60 * 1000);

                await Certificate.updateOne({ _id: certificateId }, { $inc: { renewalRetryCount: 1 } });
                await this.schedulerService.scheduleRenewal(certificateId, retryDate);

                this.logger.warn(`Renewal failed for ${certificate.domain} (attempt ${currentRetryCount + 1}/${maxRetries}), retrying in ${delayMinutes} minutes`);

                await notificationService.sendNotification('certificate_renewed_failed', {
                    certificateId: certificateId,
                    domain: certificate.domain,
                    error: error.message,
                    retryCount: currentRetryCount + 1,
                    maxRetries,
                    nextRetryIn: delayMinutes,
                }).catch(err => this.logger.error(`Failed to send notification: ${err.message}`));
            } else {
                // Max retries reached or no scheduler: reset counter, no further retries
                await Certificate.updateOne({ _id: certificateId }, { renewalRetryCount: 0 });

                this.logger.error(`Renewal failed for ${certificate.domain} after ${currentRetryCount} retries, giving up`);

                await notificationService.sendNotification('certificate_renewed_failed', {
                    certificateId: certificateId,
                    domain: certificate.domain,
                    error: error.message,
                    retryCount: currentRetryCount,
                    maxRetries,
                    finalFailure: true,
                }).catch(err => this.logger.error(`Failed to send notification: ${err.message}`));
            }

            return { success: false, message: error.message };
        }
    }

    /**
     * Calculate the renewal date based on certificate expiry and renewal schedule.
     * Applies the blackout window if configured via RENEWAL_BLACKOUT_START / RENEWAL_BLACKOUT_END.
     */
    private calculateRenewalDate(expiryDate: Date, renewalSchedule: any): Date {
        const renewalDate = new Date(expiryDate);

        // Random day offset: 1 to daysBeforeExpiry (excluding expiry day itself)
        const daysBeforeExpiry = renewalSchedule.daysBeforeExpiry || 30;
        const randomDays = Math.floor(Math.random() * daysBeforeExpiry) + 1;

        // Subtract random days before expiry
        renewalDate.setDate(renewalDate.getDate() - randomDays);

        // Set the time (format: "HH:mm")
        const [hours, minutes] = renewalSchedule.time.split(':').map(Number);
        renewalDate.setHours(hours, minutes, 0, 0);

        // Apply time shift (random offset)
        if (renewalSchedule.timeShiftMinutes > 0) {
            const shift = Math.floor(Math.random() * (renewalSchedule.timeShiftMinutes * 2 + 1)) - renewalSchedule.timeShiftMinutes;
            renewalDate.setMinutes(renewalDate.getMinutes() + shift);
        }

        // Ensure the final time does not fall within any configured blackout window
        return applyBlackoutWindows(renewalDate, getBlackoutWindows());
    }

    /**
     * Reissue certificate with modified domains (SAN)
     */
    async reissueCertificate(certificateId: string, newDomains: { domain: string; additionalDomains?: string[] }) {
        const certificate = await Certificate.findById(certificateId);
        if (!certificate) {
            throw new Error('Certificate not found');
        }

        const certLogger = this.logger.child(`Certificate ${certificate.domain}`);

        try {
            // Log domain changes
            certLogger.info(`Reissuing certificate with domain changes:`);
            certLogger.info(`  Old domain: ${certificate.domain}`);
            certLogger.info(`  New domain: ${newDomains.domain}`);
            certLogger.info(`  Old SAN: ${certificate.additionalDomains?.join(', ') || 'none'}`);
            certLogger.info(`  New SAN: ${newDomains.additionalDomains?.join(', ') || 'none'}`);

            // Update domains
            certificate.domain = newDomains.domain;
            certificate.additionalDomains = newDomains.additionalDomains || [];
            await certificate.save();

            // Issue certificate with new domains
            await this.issueCertificate(certificateId);
            return { success: true, message: 'Certificate reissued successfully' };
        } catch (error: any) {
            certLogger.error(`Reissue failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }


    async testPostIssueScript(certificateId: string) {
        const certificate = await Certificate.findById(certificateId).populate('postIssueScripts.script');
        if (!certificate || !certificate.postIssueScripts || certificate.postIssueScripts.length === 0) {
            throw new Error('Certificate or scripts not found');
        }
        if (!certificate.certificate || !certificate.privateKey) {
            throw new Error('Certificate data not found in database');
        }
        try {
            await this.runPostIssueScript(certificate);
            return { success: true, output: 'All scripts executed successfully' };
        } catch (error: any) {
            let errorMessage = error.message || 'Unknown error';
            this.logger.error(`Script test failed: ${errorMessage}`);
            return { success: false, output: error.stdout || '', error: errorMessage };
        }
    }


    /**
     * Run the post-issue scripts for a certificate.
     * Returns the per-script results; notifications are handled by the caller.
     */
    private async runPostIssueScript(cert: any): Promise<ScriptResult[]> {
        if (!cert.postIssueScripts || cert.postIssueScripts.length === 0) return [];

        await cert.populate('postIssueScripts.script');
        await cert.populate({
            path: 'postIssueScripts.sshKey',
            select: '+privateKey'
        });

        const results: ScriptResult[] = [];

        for (let i = 0; i < cert.postIssueScripts.length; i++) {
            const scriptEntry = cert.postIssueScripts[i];
            const script = scriptEntry.script;

            if (!script || !script.path) {
                this.logger.error(`Script ${i + 1} not found or has no path after population`);
                results.push({ name: `Script ${i + 1}`, success: false, error: 'Script not found or missing path' });
                continue;
            }

            try {
                await this.executeScript(cert, script, scriptEntry.vars, scriptEntry.sshKey, i + 1, cert.postIssueScripts.length);
                results.push({ name: script.name, success: true });
            } catch (error: any) {
                results.push({ name: script.name, success: false, error: error.message });
            }
        }

        // Update script execution status
        const allSuccess = results.every(r => r.success);
        cert.lastScriptExecution = new Date();
        cert.lastScriptStatus = allSuccess ? 'success' : 'failed';
        await cert.save();

        return results;
    }

    /**
     * Execute a single script
     */
    private async executeScript(cert: any, script: any, scriptVars: any = {}, sshKey: any = null, index?: number, total?: number): Promise<void> {
        const scriptFolder = process.env.SCRIPTS_FOLDER || '.';
        const scriptFolderPath = join(scriptFolder, script.path);
        const scriptPath = join(scriptFolderPath, script.entrypoint || 'script.sh');

        const scriptLabel = index ? `Script ${index}/${total} (${script.name})` : script.name;

        const envVars: Record<string, string> = {};
        for (const v of script.envVars) {
            let value = (scriptVars && scriptVars[v.key]) || v.defaultValue || '';

            // Decrypt if sensitive
            if (v.sensitive && value) {
                try {
                    value = decrypt(value);
                } catch (error) {
                    this.logger.warn(`Failed to decrypt sensitive variable ${v.key}, using value as-is`);
                }
            }

            envVars[v.key] = value;
        }

        // Run script
        try {
            this.logger.info(`Executing post-issue script: ${scriptLabel} - ${scriptPath}`);
            const output = await this.runPostIssuanceScript(scriptPath, cert, envVars, sshKey);
            this.logger.info(`Script output: ${output}`);
            await ActivityLogService.logPostScriptExecuted(
                scriptPath,
                cert.domain,
                cert._id.toString(),
                output
            );
        } catch (scriptError: any) {
            this.logger.error(`Script failed:`, scriptError);
            const errorMessage = scriptError instanceof Error ? scriptError.message : String(scriptError);
            await ActivityLogService.logPostScriptFailed(
                scriptPath,
                cert.domain,
                cert._id.toString(),
                errorMessage
            );
            // Re-throw to mark script execution as failed
            throw scriptError;
        }
    }

    private async runPostIssuanceScript(
        scriptPath: string,
        cert: any,
        customEnvVars: any = {},
        sshKey: any = null
    ): Promise<string> {
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Script file not found: ${scriptPath}`);
        }

        // Ensure script is executable
        try {
            fs.chmodSync(scriptPath, '755');
        } catch (error) {
            // Ignore on Windows
        }

        // Decrypt private key for script execution
        const privateKey = cert.privateKey ? decrypt(cert.privateKey) : '';

        this.logger.debug(`Running script: ${scriptPath} for domain ${cert.domain}`);

        // Convert Map to plain object if needed
        const envVarsObject = customEnvVars instanceof Map ?
            Object.fromEntries(customEnvVars) : customEnvVars;

        // Create secure temporary directory in RAM (tmpfs) on Linux, fallback to temp on Windows
        // /dev/shm is tmpfs (RAM-based filesystem) - never written to disk, better security
        let tempDir: string;
        const isWindows = os.platform() === 'win32';

        if (isWindows) {
            // Windows: use system temp directory
            tempDir = fs.mkdtempSync(join(os.tmpdir(), 'acme-cert-'));
        } else {
            // Linux/Unix: try /dev/shm first (tmpfs in RAM), fallback to /tmp
            try {
                if (fs.existsSync('/dev/shm')) {
                    tempDir = fs.mkdtempSync('/dev/shm/acme-cert-');
                } else {
                    tempDir = fs.mkdtempSync('/tmp/acme-cert-');
                }
            } catch (error) {
                // Fallback to /tmp if /dev/shm fails
                tempDir = fs.mkdtempSync('/tmp/acme-cert-');
            }
        }

        try {
            // Set directory permissions to 700 (only owner can read/write/execute)
            fs.chmodSync(tempDir, 0o700);

            // Write certificates to temporary files with secure permissions
            const certFile = `${tempDir}/cert.pem`;
            const keyFile = `${tempDir}/key.pem`;
            const fullChainFile = `${tempDir}/fullchain.pem`;

            fs.writeFileSync(certFile, cert.certificate || '', { mode: 0o600 });
            fs.writeFileSync(keyFile, privateKey, { mode: 0o600 });
            fs.writeFileSync(fullChainFile, cert.fullChain || '', { mode: 0o600 });
            
            // Handle SSH key if provided
            let sshKeyFile: string | undefined;
            if (sshKey && sshKey.privateKey) {
                try {
                    const decryptedSshKey = decrypt(sshKey.privateKey);
                    sshKeyFile = `${tempDir}/ssh_key`;
                    fs.writeFileSync(sshKeyFile, decryptedSshKey, { mode: 0o600 });
                    this.logger.info(`SSH key prepared: ${sshKey.name}`);
                } catch (error) {
                    this.logger.error(`Failed to decrypt SSH key: ${error}`);
                    throw new Error(`Failed to prepare SSH key: ${sshKey.name}`);
                }
            }

            // Build environment variables
            const scriptEnv: Record<string, string> = {
                ...envVarsObject, // Add custom environment variables from configuration
                CERT_DOMAIN: cert.domain,
                CERT_ADDITIONAL_DOMAINS: (cert.additionalDomains || []).join(','),
                CERT_ALL_DOMAINS: [cert.domain, ...(cert.additionalDomains || [])].join(','),
                CERT_ISSUE_DATE: cert.issueDate?.toISOString() || '',
                CERT_EXPIRY_DATE: cert.expiryDate?.toISOString() || '',
                CERT_CERTIFICATE_FILE: certFile,
                CERT_PRIVATE_KEY_FILE: keyFile,
                CERT_FULL_CHAIN_FILE: fullChainFile
            };

            // Add SSH-related env vars if SSH key is present
            if (sshKeyFile && sshKey) {
                scriptEnv.SSH_PRIVATE_KEY_FILE = sshKeyFile;
                scriptEnv.SSH_USERNAME = sshKey.username || 'root';
                scriptEnv.SSH_PORT = (sshKey.port || 22).toString();
            }

            // Execute script with file paths as env vars
            const { stdout, stderr } = await execAsync(scriptPath, {
                env: scriptEnv,
                timeout: 60000,
                maxBuffer: 1024 * 1024 * 10
            });

            if (stderr) {
                this.logger.warn(`Script stderr: ${stderr}`);
            }

            return stdout || 'Script executed successfully';

        } catch (error: any) {
            // Extract detailed error information from execAsync
            let errorMessage = error.message || 'Unknown error';
            let errorDetails = '';

            // execAsync errors contain stdout, stderr, and code
            if (error.stdout) {
                errorDetails += `\nStdout: ${error.stdout}`;
            }
            if (error.stderr) {
                errorDetails += `\nStderr: ${error.stderr}`;
            }
            if (error.code !== undefined) {
                errorDetails += `\nExit code: ${error.code}`;
            }

            const fullError = errorMessage + errorDetails;

            // Throw error with full details (will be logged by executeScript)
            throw new Error(fullError);
        }
        finally {
            // Always cleanup temporary files with secure deletion
            try {
                // Securely overwrite private key files with zeros before deletion (paranoid mode)
                const keyFile = `${tempDir}/key.pem`;
                const sshKeyFile = `${tempDir}/ssh_key`;

                // Overwrite certificate private key
                if (fs.existsSync(keyFile)) {
                    try {
                        const size = fs.statSync(keyFile).size;
                        fs.writeFileSync(keyFile, Buffer.alloc(size, 0), { mode: 0o600 });
                    } catch (overwriteError) {
                        // Continue with deletion even if overwrite fails
                        this.logger.warn(`Failed to overwrite key file: ${overwriteError}`);
                    }
                }

                // Overwrite SSH private key
                if (fs.existsSync(sshKeyFile)) {
                    try {
                        const size = fs.statSync(sshKeyFile).size;
                        fs.writeFileSync(sshKeyFile, Buffer.alloc(size, 0), { mode: 0o600 });
                    } catch (overwriteError) {
                        // Continue with deletion even if overwrite fails
                        this.logger.warn(`Failed to overwrite SSH key file: ${overwriteError}`);
                    }
                }

                // Remove entire temporary directory
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                this.logger.error(`Failed to cleanup temp directory ${tempDir}: ${cleanupError}`);
            }
        }
    }

    async revokeCertificate(certificateId: string, reason: number = 0): Promise<void> {
        const certificate = await Certificate.findById(certificateId)
            .populate('certificateAuthority')
            .populate('acmeAccount');

        if (!certificate) throw new Error('Certificate not found');
        if (!certificate.certificate) throw new Error('No certificate data stored — cannot revoke');

        const ca = await AcmeCa.findById(certificate.certificateAuthority);
        if (!ca) throw new Error('Certificate Authority not found');

        const acmeAccount = await AcmeAccount.findById(certificate.acmeAccount).select('+accountKeyJwk');
        if (!acmeAccount) throw new Error('ACME account not found');
        if (!acmeAccount.accountKeyJwk) throw new Error('ACME account has no private key stored');

        const decryptedKeyJson = decrypt(acmeAccount.accountKeyJwk);
        const accountKeyJwk = JSON.parse(decryptedKeyJson);

        this.logger.info(`Revoking certificate for ${certificate.domain} (reason: ${reason})`);

        const result = await this.acmeService.revokeCertificate(
            ca.server,
            accountKeyJwk,
            certificate.certificate,
            reason
        );

        if (!result.success) throw new Error(result.message);

        await Certificate.findByIdAndUpdate(certificateId, {
            status: 'revoked',
            autoRenewal: false,
        });

        this.logger.info(`Certificate ${certificate.domain} revoked successfully`);
    }

}