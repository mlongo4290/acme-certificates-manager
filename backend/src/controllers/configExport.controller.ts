import { Request, Response } from 'express';
import { AcmeCa } from '../models/AcmeCa';
import { AcmeAccount } from '../models/AcmeAccount';
import { Certificate } from '../models/certificate.model';
import { DnsProvider } from '../models/dnsProvider.model';
import { PostIssueScript } from '../models/postIssueScript.model';
import { Webhook } from '../models/webhook.model';

const EXPORT_VERSION = '1.0';

export const configExportController = {

    async exportConfig(req: Request, res: Response) {
        try {
            const [cas, dnsProviders, acmeAccounts, scripts, webhooks, certificates] = await Promise.all([
                AcmeCa.find({}),
                DnsProvider.find({}),
                AcmeAccount.find({}).select('-accountKeyJwk'),
                PostIssueScript.find({}),
                Webhook.find({}).select('-secret'),
                Certificate.find({}).select('-certificate -privateKey -fullChain')
            ]);

            const exportData = {
                version: EXPORT_VERSION,
                exportedAt: new Date().toISOString(),
                certificateAuthorities: cas.map(ca => ca.toObject()),
                dnsProviders: dnsProviders.map(p => p.toObject()),
                acmeAccounts: acmeAccounts.map(a => a.toObject()),
                postIssueScripts: scripts.map(s => s.toObject()),
                webhooks: webhooks.map(w => w.toObject()),
                certificates: certificates.map(cert => {
                    const obj = cert.toObject();
                    // Reset runtime state — will need re-issuance on new instance
                    return {
                        ...obj,
                        status: 'pending',
                        issueDate: undefined,
                        lastRenewalAttempt: undefined,
                        lastRenewalStatus: undefined,
                        lastScriptExecution: undefined,
                        lastScriptStatus: undefined,
                        renewalRetryCount: 0,
                        modified: false
                    };
                })
            };

            const filename = `acme-config-${new Date().toISOString().split('T')[0]}.json`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/json');
            res.json(exportData);
        } catch (error: any) {
            res.status(500).json({ message: 'Export failed', error: error.message });
        }
    },

    async importConfig(req: Request, res: Response) {
        try {
            const data = req.body;

            if (!data || data.version !== EXPORT_VERSION) {
                return res.status(400).json({ message: 'Invalid or unsupported export file format' });
            }

            const summary = {
                certificateAuthorities: { created: 0, skipped: 0 },
                dnsProviders: { created: 0, skipped: 0 },
                acmeAccounts: { created: 0, skipped: 0 },
                postIssueScripts: { created: 0, skipped: 0 },
                webhooks: { created: 0, skipped: 0 },
                certificates: { created: 0, skipped: 0 },
                errors: [] as string[]
            };

            // Maps from original IDs to new IDs
            const caIdMap = new Map<string, string>();
            const dnsIdMap = new Map<string, string>();
            const accountIdMap = new Map<string, string>();
            const scriptIdMap = new Map<string, string>();

            // 1. Import Certificate Authorities
            for (const ca of (data.certificateAuthorities || [])) {
                try {
                    const existing = await AcmeCa.findOne({ name: ca.name });
                    if (existing) {
                        caIdMap.set(ca._id.toString(), existing._id.toString());
                        summary.certificateAuthorities.skipped++;
                    } else {
                        const { _id, __v, createdAt, updatedAt, ...caData } = ca;
                        const created = await AcmeCa.create({ ...caData, isDefault: false });
                        caIdMap.set(ca._id.toString(), created._id.toString());
                        summary.certificateAuthorities.created++;
                    }
                } catch (err: any) {
                    summary.errors.push(`CA "${ca.name}": ${err.message}`);
                }
            }

            // 2. Import DNS Providers
            for (const provider of (data.dnsProviders || [])) {
                try {
                    const existing = await DnsProvider.findOne({ name: provider.name });
                    if (existing) {
                        dnsIdMap.set(provider._id.toString(), existing._id.toString());
                        summary.dnsProviders.skipped++;
                    } else {
                        const { _id, __v, createdAt, updatedAt, ...providerData } = provider;
                        const created = await DnsProvider.create(providerData);
                        dnsIdMap.set(provider._id.toString(), created._id.toString());
                        summary.dnsProviders.created++;
                    }
                } catch (err: any) {
                    summary.errors.push(`DNS Provider "${provider.name}": ${err.message}`);
                }
            }

            // 3. Import Post-Issue Scripts
            for (const script of (data.postIssueScripts || [])) {
                try {
                    const existing = await PostIssueScript.findOne({ name: script.name });
                    if (existing) {
                        scriptIdMap.set(script._id.toString(), existing._id.toString());
                        summary.postIssueScripts.skipped++;
                    } else {
                        const { _id, __v, createdAt, updatedAt, ...scriptData } = script;
                        const created = await PostIssueScript.create(scriptData);
                        scriptIdMap.set(script._id.toString(), created._id.toString());
                        summary.postIssueScripts.created++;
                    }
                } catch (err: any) {
                    summary.errors.push(`Script "${script.name}": ${err.message}`);
                }
            }

            // 4. Import Webhooks
            for (const webhook of (data.webhooks || [])) {
                try {
                    const existing = await Webhook.findOne({ name: webhook.name });
                    if (existing) {
                        summary.webhooks.skipped++;
                    } else {
                        const { _id, __v, createdAt, updatedAt, hasSecret, ...webhookData } = webhook;
                        await Webhook.create(webhookData);
                        summary.webhooks.created++;
                    }
                } catch (err: any) {
                    summary.errors.push(`Webhook "${webhook.name}": ${err.message}`);
                }
            }

            // 5. Import ACME Accounts (after CAs are mapped)
            for (const account of (data.acmeAccounts || [])) {
                try {
                    const existing = await AcmeAccount.findOne({ name: account.name });
                    if (existing) {
                        accountIdMap.set(account._id.toString(), existing._id.toString());
                        summary.acmeAccounts.skipped++;
                    } else {
                        const { _id, __v, createdAt, updatedAt, accountKeyJwk, accountUrl, registeredAt, ...accountData } = account;
                        const newCaId = caIdMap.get(account.caId?.toString() || '');
                        const created = await AcmeAccount.create({
                            ...accountData,
                            caId: newCaId || account.caId,
                            // accountKeyJwk intentionally omitted — will need re-registration
                        });
                        accountIdMap.set(account._id.toString(), created._id.toString());
                        summary.acmeAccounts.created++;
                    }
                } catch (err: any) {
                    summary.errors.push(`ACME Account "${account.name}": ${err.message}`);
                }
            }

            // 6. Import Certificates (after all dependencies mapped)
            for (const cert of (data.certificates || [])) {
                try {
                    const existing = await Certificate.findOne({ domain: cert.domain });
                    if (existing) {
                        summary.certificates.skipped++;
                    } else {
                        const {
                            _id, __v, createdAt, updatedAt,
                            certificate, privateKey, fullChain,
                            issueDate, lastRenewalAttempt, lastRenewalStatus,
                            lastScriptExecution, lastScriptStatus,
                            ...certData
                        } = cert;

                        // Resolve references
                        const newCaId = caIdMap.get(cert.certificateAuthority?.toString() || '');
                        const newAccountId = accountIdMap.get(cert.acmeAccount?.toString() || '');
                        const newDnsId = cert.dnsProvider ? dnsIdMap.get(cert.dnsProvider.toString()) : undefined;

                        // Map post-issue script references
                        const mappedScripts = (cert.postIssueScripts || []).map((ps: any) => ({
                            ...ps,
                            script: scriptIdMap.get(ps.script?.toString() || '') || ps.script
                        })).filter((ps: any) => ps.script);

                        await Certificate.create({
                            ...certData,
                            status: 'pending',
                            renewalRetryCount: 0,
                            modified: false,
                            certificateAuthority: newCaId || cert.certificateAuthority,
                            acmeAccount: newAccountId || cert.acmeAccount,
                            dnsProvider: newDnsId || cert.dnsProvider || undefined,
                            postIssueScripts: mappedScripts
                        });
                        summary.certificates.created++;
                    }
                } catch (err: any) {
                    summary.errors.push(`Certificate "${cert.domain}": ${err.message}`);
                }
            }

            res.json({ success: true, summary });
        } catch (error: any) {
            res.status(500).json({ message: 'Import failed', error: error.message });
        }
    }
};
