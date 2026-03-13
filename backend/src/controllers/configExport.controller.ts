import { Request, Response } from 'express';
import * as archiver from 'archiver';
import AdmZip from 'adm-zip';
import { AcmeCa } from '../models/AcmeCa';
import { AcmeAccount } from '../models/AcmeAccount';
import { Certificate } from '../models/certificate.model';
import { DnsProvider } from '../models/dnsProvider.model';
import { PostIssueScript } from '../models/postIssueScript.model';
import { Webhook } from '../models/webhook.model';
import { passwordEncrypt, passwordDecrypt } from '../utils/encryption';

const EXPORT_VERSION = '1.1';

export const configExportController = {

    async exportConfig(req: Request, res: Response) {
        try {
            const { includeSecrets = false, includeCertificates = false, password } = req.body || {};

            if ((includeSecrets || includeCertificates) && !password) {
                return res.status(400).json({ message: 'Password required when exporting secrets or certificate material' });
            }

            const [cas, dnsProviders, acmeAccounts, scripts, webhooks, certificates] = await Promise.all([
                AcmeCa.find({}),
                DnsProvider.find({}),
                AcmeAccount.find({}).select(includeSecrets ? '' : '-accountKeyJwk'),
                PostIssueScript.find({}),
                Webhook.find({}).select(includeSecrets ? '' : '-secret'),
                Certificate.find({}).select(includeCertificates ? '' : '-certificate -privateKey -fullChain')
            ]);

            const meta = {
                version: EXPORT_VERSION,
                exportedAt: new Date().toISOString(),
                hasSecrets: includeSecrets,
                hasCertMaterial: includeCertificates,
                encrypted: (includeSecrets || includeCertificates) && !!password
            };

            const configData = {
                certificateAuthorities: cas.map(ca => ca.toObject()),
                dnsProviders: dnsProviders.map(p => p.toObject()),
                acmeAccounts: acmeAccounts.map(a => {
                    const obj = a.toObject();
                    if (includeSecrets) return obj; // keep accountKeyJwk
                    return obj; // already excluded by select
                }),
                postIssueScripts: scripts.map(s => s.toObject()),
                webhooks: webhooks.map(w => w.toObject()),
                certificates: certificates.map(cert => {
                    const obj = cert.toObject();
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

            // If secrets/certmaterial are included and we need encryption,
            // extract them from configData and store separately encrypted
            let secretsEnc: string | null = null;
            let certMaterialEnc: string | null = null;

            if (includeSecrets && password) {
                const secretsData = {
                    acmeAccountKeys: acmeAccounts.map(a => {
                        const obj = a.toObject() as any;
                        return { _id: obj._id?.toString(), accountKeyJwk: obj.accountKeyJwk };
                    }),
                    webhookSecrets: webhooks.map(w => {
                        const obj = w.toObject() as any;
                        return { _id: obj._id?.toString(), secret: obj.secret };
                    })
                };
                secretsEnc = passwordEncrypt(JSON.stringify(secretsData), password);
                // Remove sensitive fields from configData
                configData.acmeAccounts = configData.acmeAccounts.map((a: any) => {
                    const { accountKeyJwk, ...rest } = a;
                    return rest;
                });
                configData.webhooks = configData.webhooks.map((w: any) => {
                    const { secret, ...rest } = w;
                    return rest;
                });
            }

            if (includeCertificates && password) {
                const certMaterialData = certificates.map(cert => {
                    const obj = cert.toObject() as any;
                    return {
                        _id: obj._id?.toString(),
                        domain: obj.domain,
                        certificate: obj.certificate,
                        privateKey: obj.privateKey,
                        fullChain: obj.fullChain
                    };
                });
                certMaterialEnc = passwordEncrypt(JSON.stringify(certMaterialData), password);
                // Remove PEM fields from configData
                configData.certificates = configData.certificates.map((c: any) => {
                    const { certificate, privateKey, fullChain, ...rest } = c;
                    return rest;
                });
            }

            // Build ZIP in memory
            const filename = `acme-config-${new Date().toISOString().split('T')[0]}.zip`;

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/zip');

            const archive = archiver.default('zip', { zlib: { level: 6 } });
            archive.pipe(res);

            archive.append(JSON.stringify(meta, null, 2), { name: 'meta.json' });
            archive.append(JSON.stringify(configData, null, 2), { name: 'config.json' });

            if (secretsEnc) {
                archive.append(secretsEnc, { name: 'secrets.enc' });
            }
            if (certMaterialEnc) {
                archive.append(certMaterialEnc, { name: 'certmaterial.enc' });
            }

            await archive.finalize();
        } catch (error: any) {
            if (!res.headersSent) {
                res.status(500).json({ message: 'Export failed', error: error.message });
            }
        }
    },

    async importConfig(req: Request, res: Response) {
        try {
            const { zipData, password } = req.body;

            if (!zipData) {
                return res.status(400).json({ message: 'No ZIP data provided' });
            }

            const zipBuffer = Buffer.from(zipData, 'base64');
            const zip = new AdmZip(zipBuffer);

            const metaEntry = zip.getEntry('meta.json');
            const configEntry = zip.getEntry('config.json');

            if (!metaEntry || !configEntry) {
                return res.status(400).json({ message: 'Invalid export archive: missing required files' });
            }

            const meta = JSON.parse(metaEntry.getData().toString('utf8'));
            const data = JSON.parse(configEntry.getData().toString('utf8'));

            if (!meta.version || !meta.version.startsWith('1.')) {
                return res.status(400).json({ message: 'Invalid or unsupported export file format' });
            }

            if (meta.encrypted && !password) {
                return res.status(400).json({ message: 'Password required to import this archive' });
            }

            // Decrypt secrets if present
            const secretsEntry = zip.getEntry('secrets.enc');
            if (secretsEntry && password) {
                try {
                    const secretsData = JSON.parse(passwordDecrypt(secretsEntry.getData().toString('utf8'), password));
                    // Merge accountKeyJwk back
                    const keyMap = new Map<string, string>();
                    for (const item of (secretsData.acmeAccountKeys || [])) {
                        if (item._id && item.accountKeyJwk) keyMap.set(item._id, item.accountKeyJwk);
                    }
                    const secretMap = new Map<string, string>();
                    for (const item of (secretsData.webhookSecrets || [])) {
                        if (item._id && item.secret) secretMap.set(item._id, item.secret);
                    }
                    data.acmeAccounts = (data.acmeAccounts || []).map((a: any) => ({
                        ...a,
                        accountKeyJwk: keyMap.get(a._id?.toString()) || undefined
                    }));
                    data.webhooks = (data.webhooks || []).map((w: any) => ({
                        ...w,
                        secret: secretMap.get(w._id?.toString()) || undefined
                    }));
                } catch {
                    return res.status(400).json({ message: 'Failed to decrypt secrets: wrong password?' });
                }
            }

            // Decrypt cert material if present
            const certMaterialEntry = zip.getEntry('certmaterial.enc');
            if (certMaterialEntry && password) {
                try {
                    const certMaterialData: any[] = JSON.parse(passwordDecrypt(certMaterialEntry.getData().toString('utf8'), password));
                    const certMap = new Map<string, any>();
                    for (const item of certMaterialData) {
                        if (item._id) certMap.set(item._id, item);
                    }
                    data.certificates = (data.certificates || []).map((c: any) => {
                        const material = certMap.get(c._id?.toString());
                        if (!material) return c;
                        return {
                            ...c,
                            certificate: material.certificate,
                            privateKey: material.privateKey,
                            fullChain: material.fullChain
                        };
                    });
                } catch {
                    return res.status(400).json({ message: 'Failed to decrypt certificate material: wrong password?' });
                }
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
                        const { _id, __v, createdAt, updatedAt, accountUrl, registeredAt, ...accountData } = account;
                        const newCaId = caIdMap.get(account.caId?.toString() || '');
                        const created = await AcmeAccount.create({
                            ...accountData,
                            caId: newCaId || account.caId,
                        });
                        accountIdMap.set(account._id.toString(), created._id.toString());
                        summary.acmeAccounts.created++;
                    }
                } catch (err: any) {
                    summary.errors.push(`ACME Account "${account.name}": ${err.message}`);
                }
            }

            // 6. Import Certificates
            for (const cert of (data.certificates || [])) {
                try {
                    const existing = await Certificate.findOne({ domain: cert.domain });
                    if (existing) {
                        summary.certificates.skipped++;
                    } else {
                        const {
                            _id, __v, createdAt, updatedAt,
                            issueDate, lastRenewalAttempt, lastRenewalStatus,
                            lastScriptExecution, lastScriptStatus,
                            ...certData
                        } = cert;

                        const newCaId = caIdMap.get(cert.certificateAuthority?.toString() || '');
                        const newAccountId = accountIdMap.get(cert.acmeAccount?.toString() || '');
                        const newDnsId = cert.dnsProvider ? dnsIdMap.get(cert.dnsProvider.toString()) : undefined;

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
