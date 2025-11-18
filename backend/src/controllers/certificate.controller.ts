import archiver from 'archiver';
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { Certificate } from '../models/certificate.model';
import { PostIssueScript } from '../models/postIssueScript.model';
import { ActivityLogService } from '../services/activityLog.service';
import { AgendaService } from '../services/agenda.service';
import { CertificateService } from '../services/certificate.service';
import { Logger } from '../services/logger.service';
import { getCertificateExpiryDate } from '../utils/certificateParser';
import { decrypt, encrypt } from '../utils/encryption';

export class CertificateController {
    private logger: Logger;

    constructor(
        private certificateService: CertificateService,
        private schedulerService: AgendaService
    ) {
        this.logger = new Logger('CertificateController');
    }

    /**
     * Encrypt sensitive script variables based on script definition
     */
    private async encryptSensitiveVars(scriptId: string | null, vars: Record<string, string>): Promise<Record<string, string>> {
        if (!scriptId || !vars || Object.keys(vars).length === 0) {
            return vars || {};
        }

        const script: any = await PostIssueScript.findById(scriptId);
        if (!script || !script.envVars) {
            return vars;
        }

        const encrypted: Record<string, string> = {};
        for (const [key, value] of Object.entries(vars)) {
            const varDef = script.envVars.find((v: any) => v.key === key);
            if (varDef && varDef.sensitive) {
                // Skip encryption if value is the unchanged placeholder
                if (value === '__ENCRYPTED__') {
                    // This should never happen on create, only on update
                    // We'll handle this in updateCertificate
                    encrypted[key] = value;
                } else {
                    encrypted[key] = encrypt(value);
                }
            } else {
                encrypted[key] = value;
            }
        }

        return encrypted;
    }

    /**
     * Mask sensitive script variables for frontend display
     */
    private async maskSensitiveVars(scriptId: string | null, vars: Record<string, string>): Promise<Record<string, string>> {
        if (!scriptId || !vars || Object.keys(vars).length === 0) {
            return vars || {};
        }

        const script: any = await PostIssueScript.findById(scriptId);
        if (!script || !script.envVars) {
            return vars;
        }

        const masked: Record<string, string> = {};
        for (const [key, value] of Object.entries(vars)) {
            const varDef = script.envVars.find((v: any) => v.key === key);
            if (varDef && varDef.sensitive && value) {
                // Replace encrypted value with placeholder
                masked[key] = '__ENCRYPTED__';
            } else {
                masked[key] = value;
            }
        }

        return masked;
    }

    /**
     * Calculate the renewal date based on certificate expiry and renewal schedule
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

        // Apply time shift (random offset in minutes)
        if (renewalSchedule.timeShiftMinutes > 0) {
            const shift = Math.floor(Math.random() * (renewalSchedule.timeShiftMinutes * 2 + 1)) - renewalSchedule.timeShiftMinutes;
            renewalDate.setMinutes(renewalDate.getMinutes() + shift);
        }

        return renewalDate;
    }

    getAllCertificates = asyncHandler(async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 0;
        const sortField = (req.query.sortField as string) || 'createdAt';
        const sortOrder = parseInt(req.query.sortOrder as string) || -1;

        // Build filter query - exactly like activity-log
        const filterQuery: any = {};

        // Process filters - they come as filters[fieldName]=JSON object with operator and constraints
        Object.keys(req.query).forEach(key => {
            if (key.startsWith('filters[') && key.endsWith(']')) {
                const field = key.substring(8, key.length - 1);
                const fieldFilterStr = req.query[key] as string;

                try {
                    const fieldFilter = JSON.parse(fieldFilterStr);

                    if (!fieldFilter.constraints || fieldFilter.constraints.length === 0) {
                        return;
                    }

                    const constraints = fieldFilter.constraints;
                    const operator = fieldFilter.operator || 'and';

                    if (constraints.length === 1) {
                        // Single constraint
                        filterQuery[field] = this.buildFilterQuery(field, constraints[0].value, constraints[0].matchMode);
                    } else {
                        // Multiple constraints - use operator (and/or)
                        const logicOp = operator === 'or' ? '$or' : '$and';
                        filterQuery[logicOp] = filterQuery[logicOp] || [];
                        constraints.forEach((constraint: any) => {
                            const condition: any = {};
                            condition[field] = this.buildFilterQuery(field, constraint.value, constraint.matchMode);
                            filterQuery[logicOp].push(condition);
                        });
                    }
                } catch (error) {
                    // Silent fail
                }
            }
        });

        // Get total count
        const totalRecords = await Certificate.countDocuments(filterQuery);

        // Build sort object
        const sortObj: any = {};
        sortObj[sortField] = sortOrder;

        // Get paginated data
        const certificates = await Certificate.find(filterQuery)
            .sort(sortObj)
            .skip(page * limit)
            .limit(limit);

        // Get next renewal dates from Agenda for all certificates
        const certificateIds = certificates.map(cert => cert._id.toString());
        const renewalDates = await this.schedulerService.getNextRenewalDates(certificateIds);

        // Add nextRenewalDate to each certificate and mask sensitive vars
        const certificatesWithRenewal = await Promise.all(certificates.map(async cert => {
            const certObj: any = cert.toObject();
            certObj.nextRenewalDate = renewalDates.get(cert._id.toString()) || null;
            // Calculate expiryDate from certificate PEM
            if (certObj.certificate) {
                certObj.expiryDate = getCertificateExpiryDate(certObj.certificate);
            }
            // Mask sensitive script variables in postIssueScripts array
            if (certObj.postIssueScripts && certObj.postIssueScripts.length > 0) {
                certObj.postIssueScripts = await Promise.all(certObj.postIssueScripts.map(async (scriptEntry: any) => {
                    return {
                        script: scriptEntry.script,
                        vars: await this.maskSensitiveVars(scriptEntry.script, scriptEntry.vars),
                        sshKey: scriptEntry.sshKey
                    };
                }));
            }
            return certObj;
        }));

        res.json({
            data: certificatesWithRenewal,
            totalRecords
        });
    });

    private buildFilterQuery(field: string, value: any, matchMode: string): any {
        // Handle date fields
        if (field === 'issueDate' || field === 'expiryDate' || field === 'createdAt' || field === 'updatedAt') {
            const inputDate = new Date(value);
            // Normalize to start of day in UTC to avoid timezone issues
            const date = new Date(Date.UTC(
                inputDate.getUTCFullYear(),
                inputDate.getUTCMonth(),
                inputDate.getUTCDate()
            ));

            switch (matchMode) {
                case 'dateIs':
                    // Same day (entire day in UTC)
                    const endOfDay = new Date(date);
                    endOfDay.setUTCHours(23, 59, 59, 999);
                    return { $gte: date, $lte: endOfDay };
                case 'dateAfter':
                    // After means from start of next day
                    const nextDay = new Date(date);
                    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                    return { $gte: nextDay };
                case 'dateBefore':
                    // Before means before start of this day
                    return { $lt: date };
                default:
                    return { $gte: date };
            }
        }

        // Handle text fields
        switch (matchMode) {
            case 'contains':
                return { $regex: value, $options: 'i' };
            case 'startsWith':
                return { $regex: `^${value}`, $options: 'i' };
            case 'equals':
                return value;
            default:
                return { $regex: value, $options: 'i' };
        }
    }

    getCertificatesStats = asyncHandler(async (req: Request, res: Response) => {
        const now = new Date();
        const certificates = await Certificate.find();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Calculate expiry dates for all certificates
        let expiringSoonCount = 0;
        certificates.forEach(cert => {
            if (cert.status === 'valid' && cert.certificate) {
                const expiryDate = getCertificateExpiryDate(cert.certificate);
                if (expiryDate && expiryDate < sevenDaysFromNow) {
                    expiringSoonCount++;
                }
            }
        });

        const stats = {
            total: certificates.length,
            valid: certificates.filter(cert => cert.status === 'valid').length,
            expiringSoon: expiringSoonCount,
            expired: certificates.filter(cert => cert.status === 'expired').length
        };

        res.json(stats);
    });

    getCertificateById = asyncHandler(async (req: Request, res: Response) => {
        const certificate = await Certificate.findById(req.params.id);
        if (!certificate) {
            res.status(404);
            throw new Error('Certificate not found');
        }

        const certObj: any = certificate.toObject();
        // Calculate expiryDate from certificate PEM
        if (certObj.certificate) {
            certObj.expiryDate = getCertificateExpiryDate(certObj.certificate);
        }

        // Mask sensitive script variables in postIssueScripts array
        if (certObj.postIssueScripts && certObj.postIssueScripts.length > 0) {
            certObj.postIssueScripts = await Promise.all(certObj.postIssueScripts.map(async (scriptEntry: any) => {
                return {
                    script: scriptEntry.script,
                    vars: await this.maskSensitiveVars(scriptEntry.script, scriptEntry.vars),
                    sshKey: scriptEntry.sshKey
                };
            }));
        }

        res.json(certObj);
    });

    createCertificate = asyncHandler(async (req: Request, res: Response) => {
        // Encrypt sensitive script variables in postIssueScripts array
        if (req.body.postIssueScripts && req.body.postIssueScripts.length > 0) {
            req.body.postIssueScripts = await Promise.all(req.body.postIssueScripts.map(async (scriptEntry: any) => {
                return {
                    script: scriptEntry.script,
                    vars: await this.encryptSensitiveVars(scriptEntry.script, scriptEntry.vars),
                    sshKey: scriptEntry.sshKey || undefined
                };
            }));
        }

        const certificate = await this.certificateService.createCertificate(req.body);

        // Log activity
        await ActivityLogService.logCertificateCreated(certificate.domain, certificate._id.toString(), req);

        // Calculate expiryDate from certificate if available
        const expiryDate = certificate.certificate ? getCertificateExpiryDate(certificate.certificate) : null;

        // Schedule renewal if auto-renewal is enabled
        if (certificate.autoRenewal && certificate.renewalSchedule && expiryDate) {
            const renewalDate = this.calculateRenewalDate(expiryDate, certificate.renewalSchedule);
            await this.schedulerService.scheduleRenewal(certificate._id.toString(), renewalDate);
        }

        const certObj: any = certificate.toObject();
        certObj.expiryDate = expiryDate;

        res.status(201).json(certObj);
    });

    updateCertificate = asyncHandler(async (req: Request, res: Response) => {
        const certificate = await Certificate.findById(req.params.id);
        if (!certificate) {
            res.status(404);
            throw new Error('Certificate not found');
        }

        // Validate acmeAccount if provided
        if (req.body.acmeAccount === '' || req.body.acmeAccount === null) {
            res.status(400);
            throw new Error('ACME Account is required');
        }

        // Handle sensitive script variables in postIssueScripts array
        if (req.body.postIssueScripts && req.body.postIssueScripts.length > 0) {
            req.body.postIssueScripts = await Promise.all(req.body.postIssueScripts.map(async (scriptEntry: any, index: number) => {
                const script: any = await PostIssueScript.findById(scriptEntry.script);

                if (script && script.envVars) {
                    const updatedVars: Record<string, string> = {};

                    for (const [key, value] of Object.entries(scriptEntry.vars)) {
                        const varDef = script.envVars.find((v: any) => v.key === key);

                        if (varDef && varDef.sensitive) {
                            // If value is the placeholder, keep the original encrypted value
                            if (value === '__ENCRYPTED__') {
                                const originalScript = certificate.postIssueScripts?.[index];
                                updatedVars[key] = (originalScript as any)?.vars?.[key] || '';
                            } else {
                                // New value - encrypt it
                                updatedVars[key] = encrypt(value as string);
                            }
                        } else {
                            updatedVars[key] = value as string;
                        }
                    }

                    return {
                        script: scriptEntry.script,
                        vars: updatedVars,
                        sshKey: scriptEntry.sshKey || undefined
                    };
                } else {
                    return {
                        script: scriptEntry.script,
                        vars: scriptEntry.vars,
                        sshKey: scriptEntry.sshKey || undefined
                    };
                }
            }));
        }

        // Check if domains are being modified on an issued certificate
        const domainsChanged =
            certificate.status === 'valid' && (
                req.body.domain !== certificate.domain ||
                JSON.stringify(req.body.additionalDomains?.sort()) !== JSON.stringify(certificate.additionalDomains?.sort())
            );

        // Update certificate
        Object.assign(certificate, req.body);

        // Set modified flag if domains changed on valid certificate
        if (domainsChanged) {
            certificate.modified = true;
        }

        await certificate.save();

        // Log activity
        await ActivityLogService.logCertificateUpdated(certificate.domain, certificate._id.toString());

        // Update schedule if auto-renewal settings changed
        const expiryDate = certificate.certificate ? getCertificateExpiryDate(certificate.certificate) : null;
        if (certificate.autoRenewal && certificate.renewalSchedule && expiryDate) {
            const renewalDate = this.calculateRenewalDate(expiryDate, certificate.renewalSchedule);
            await this.schedulerService.scheduleRenewal(certificate._id.toString(), renewalDate);
        } else {
            // Cancel schedule if auto-renewal is disabled
            await this.schedulerService.cancelRenewal(certificate._id.toString());
        }

        res.json(certificate);
    });

    deleteCertificate = asyncHandler(async (req: Request, res: Response) => {
        const certificate = await Certificate.findByIdAndDelete(req.params.id);
        if (!certificate) {
            res.status(404);
            throw new Error('Certificate not found');
        }

        // Cancel scheduled renewal
        await this.schedulerService.cancelRenewal(req.params.id);

        // Log activity
        await ActivityLogService.logCertificateDeleted(certificate.domain, req.params.id, req);

        res.json({ message: 'Certificate deleted' });
    });

    renewCertificate = asyncHandler(async (req: Request, res: Response) => {
        const certificateId = req.params.id;

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Attach SSE response to logger
        Logger.setSSEResponse(res);

        try {
            await this.certificateService.issueCertificate(certificateId);

            // Schedule renewal if auto-renewal is enabled
            const certificate = await Certificate.findById(certificateId);
            if (certificate) {
                const expiryDate = certificate.certificate ? getCertificateExpiryDate(certificate.certificate) : null;
                if (certificate.autoRenewal && certificate.renewalSchedule && expiryDate) {
                    const renewalDate = this.calculateRenewalDate(expiryDate, certificate.renewalSchedule);
                    await this.schedulerService.scheduleRenewal(certificateId, renewalDate);
                    this.logger.info(`Rescheduled renewal for renewed certificate ${certificateId} at ${renewalDate.toISOString()}`);
                }
            }

            res.write(`data: ${JSON.stringify({ type: 'success', message: 'Certificate renewed successfully' })}\n\n`);
            res.end();
        } catch (error: any) {
            this.logger.error('Certificate renewal failed', error);
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        } finally {
            // Clear SSE response from logger
            Logger.clearSSEResponse();
        }
    });

    /**
     * Issue certificate with real-time progress updates using Server-Sent Events
     */
    issueCertificate = asyncHandler(async (req: Request, res: Response) => {
        const certificateId = req.params.id;

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders();

        // Attach SSE response to logger
        Logger.setSSEResponse(res);

        try {
            await this.certificateService.issueCertificate(certificateId);

            // Reset modified flag and schedule renewal if auto-renewal is enabled
            const certificate = await Certificate.findById(certificateId);
            if (certificate) {
                certificate.modified = false;
                await certificate.save();

                // Log successful issuance
                await ActivityLogService.logCertificateIssued(certificate.domain, certificateId, req);

                // Calculate expiryDate from certificate
                const expiryDate = certificate.certificate ? getCertificateExpiryDate(certificate.certificate) : null;

                if (certificate.autoRenewal && certificate.renewalSchedule && expiryDate) {
                    const renewalDate = this.calculateRenewalDate(expiryDate, certificate.renewalSchedule);
                    await this.schedulerService.scheduleRenewal(certificateId, renewalDate);
                    this.logger.info(`Scheduled renewal for certificate ${certificateId} at ${renewalDate.toISOString()}`);
                }
            }

            res.write(`data: ${JSON.stringify({ type: 'success', message: 'Certificate issued successfully' })}\n\n`);
            res.end();
        } catch (error: any) {
            this.logger.error('Certificate issuance failed', error);

            // Log error
            const certificate = await Certificate.findById(certificateId);
            if (certificate) {
                await ActivityLogService.logCertificateError(certificate.domain, certificateId, error.message, req);
            }

            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        } finally {
            // Clear SSE response from logger
            Logger.clearSSEResponse();
        }
    });

    reissueCertificate = asyncHandler(async (req: Request, res: Response) => {
        const certificateId = req.params.id;
        const domain = req.query.domain as string;
        const additionalDomainsStr = req.query.additionalDomains as string;
        const additionalDomains = additionalDomainsStr ? JSON.parse(additionalDomainsStr) : [];

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Attach SSE response to logger
        Logger.setSSEResponse(res);

        try {
            await this.certificateService.reissueCertificate(certificateId, { domain, additionalDomains });

            // Reset modified flag and schedule renewal if auto-renewal is enabled
            const certificate = await Certificate.findById(certificateId);
            if (certificate) {
                certificate.modified = false;
                await certificate.save();

                // Log successful reissuance (using issued log type)
                await ActivityLogService.logCertificateIssued(certificate.domain, certificateId, req);

                // Calculate expiryDate from certificate
                const expiryDate = certificate.certificate ? getCertificateExpiryDate(certificate.certificate) : null;

                if (certificate.autoRenewal && certificate.renewalSchedule && expiryDate) {
                    const renewalDate = this.calculateRenewalDate(expiryDate, certificate.renewalSchedule);
                    await this.schedulerService.scheduleRenewal(certificateId, renewalDate);
                    this.logger.info(`Rescheduled renewal for reissued certificate ${certificateId} at ${renewalDate.toISOString()}`);
                }
            }

            res.write(`data: ${JSON.stringify({ type: 'success', message: 'Certificate reissued successfully' })}\n\n`);
            res.end();
        } catch (error: any) {
            this.logger.error('Certificate reissue failed', error);

            // Log error
            const certificate = await Certificate.findById(certificateId);
            if (certificate) {
                await ActivityLogService.logCertificateError(certificate.domain, certificateId, error.message, req);
            }

            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        } finally {
            // Clear SSE response from logger
            Logger.clearSSEResponse();
        }
    });

    testPostIssueScript = asyncHandler(async (req: Request, res: Response) => {
        const result = await this.certificateService.testPostIssueScript(req.params.id);
        res.json(result);
    });

    downloadCertificate = asyncHandler(async (req: Request, res: Response) => {
        const certificate = await Certificate.findById(req.params.id);
        if (!certificate) {
            res.status(404);
            throw new Error('Certificate not found');
        }

        const type = req.params.type; // 'cert', 'key', or 'fullchain'
        let content = '';
        let filename = '';

        switch (type) {
            case 'cert':
                content = certificate.certificate || '';
                filename = `${certificate.domain}.crt`;
                break;
            case 'key':
                // Decrypt private key before sending
                content = certificate.privateKey ? decrypt(certificate.privateKey) : '';
                filename = `${certificate.domain}.key`;
                break;
            case 'fullchain':
                content = certificate.fullChain || '';
                filename = `${certificate.domain}-fullchain.crt`;
                break;
            case 'zip':
                res.setHeader('Content-Type', 'application/zip');
                res.setHeader('Content-Disposition', `attachment; filename="${certificate.domain}-certificate.zip"`);
                const zip = archiver('zip', { zlib: { level: 9 } });
                zip.pipe(res);
                zip.append(certificate.certificate || '', { name: `${certificate.domain}.crt` });
                zip.append(certificate.privateKey ? decrypt(certificate.privateKey) : '', { name: `${certificate.domain}.key` });
                zip.append(certificate.fullChain || '', { name: `${certificate.domain}-fullchain.crt` });
                await zip.finalize();
                return;
            default:
                res.status(400);
                throw new Error('Invalid download type. Use: cert, key, or fullchain');
        }

        if (!content) {
            res.status(404);
            throw new Error(`${type} not available for this certificate`);
        }

        res.setHeader('Content-Type', 'application/x-pem-file');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(content);
    });

    downloadCACertificate = asyncHandler(async (req: Request, res: Response) => {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            res.status(400);
            throw new Error('URL parameter is required');
        }
        if (!url.match(/^https?:\/\/.+/)) {
            res.status(400);
            throw new Error('Invalid URL format');
        }
        this.logger.info(`Proxying CA certificate download from: ${url}`);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'User-Agent': 'ACME-Certificate-Manager/1.0' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            res.setHeader('Content-Type', 'application/x-x509-ca-cert');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(Buffer.from(arrayBuffer));
        } catch (error: any) {
            this.logger.error(`Failed to download CA certificate from ${url}:`, error.message);
            res.status(502);
            throw new Error(`Failed to download CA certificate: ${error.message}`);
        }
    });

    /**
     * Check for scheduling conflicts
     * Returns the number of certificates scheduled in the same time window
     */
    checkSchedulingConflicts = asyncHandler(async (req: Request, res: Response) => {
        const { time, timeShiftMinutes, excludeCertificateId } = req.query;

        if (!time || typeof time !== 'string') {
            res.status(400);
            throw new Error('time parameter is required (format: HH:mm)');
        }

        const shift = parseInt(timeShiftMinutes as string) || 0;

        // Parse the time
        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            res.status(400);
            throw new Error('Invalid time format. Use HH:mm (24-hour format)');
        }

        // Find all certificates with autoRenewal enabled
        const query: any = {
            autoRenewal: true,
            status: { $in: ['valid', 'pending'] }
        };

        if (excludeCertificateId) {
            query._id = { $ne: excludeCertificateId };
        }

        const certificates = await Certificate.find(query);

        // Count certificates in the same time window
        let conflictCount = 0;
        const conflictingCertificates: any[] = [];

        for (const cert of certificates) {
            // Skip if renewalSchedule is not set
            if (!cert.renewalSchedule || !cert.renewalSchedule.time) {
                continue;
            }

            const certTime = cert.renewalSchedule.time;
            const [certHours, certMinutes] = certTime.split(':').map(Number);
            const certShift = cert.renewalSchedule.timeShiftMinutes || 0;

            // Calculate the time windows (in minutes from midnight)
            const targetStart = hours * 60 + minutes - shift;
            const targetEnd = hours * 60 + minutes + shift;
            const certStart = certHours * 60 + certMinutes - certShift;
            const certEnd = certHours * 60 + certMinutes + certShift;

            // Check if time windows overlap
            if (!(targetEnd < certStart || targetStart > certEnd)) {
                conflictCount++;
                conflictingCertificates.push({
                    _id: cert._id,
                    domain: cert.domain,
                    time: cert.renewalSchedule.time,
                    timeShiftMinutes: cert.renewalSchedule.timeShiftMinutes
                });
            }
        }

        res.json({
            conflictCount,
            conflictingCertificates,
            warning: conflictCount > 5 ? 'high' : conflictCount > 2 ? 'medium' : 'none'
        });
    });
}
