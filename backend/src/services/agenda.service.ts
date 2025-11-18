import Agenda from 'agenda';
import { ActivityLog } from '../models/ActivityLog';
import { Logger } from './logger.service';
import { IScheduler } from './scheduler.interface';

export class AgendaService implements IScheduler {
    private agenda: Agenda;
    private logger = new Logger('Agenda');

    constructor(
        mongoConnectionString: string,
        private renewalCallback: (certificateId: string) => Promise<void>
    ) {
        this.agenda = new Agenda({
            db: { address: mongoConnectionString, collection: 'jobs' }
        });

        // Define renewal job
        this.agenda.define('renew certificate', async (job: any) => {
            const certificateId = job.attrs.data.certificateId;
            try {
                await this.renewalCallback(certificateId);
            } catch (error: any) {
                this.logger.error(`Failed to renew certificate ${certificateId}: ${error.message}`, error);
            }
        });

        // Define housekeeping job for activity logs
        this.agenda.define('cleanup activity logs', async () => {
            try {
                const enabled = process.env.ACTIVITY_LOG_ENABLED !== 'false';
                const retentionDays = Number(process.env.ACTIVITY_LOG_RETENTION_DAYS) || 90;

                if (!enabled) {
                    this.logger.info('Activity logging is disabled, skipping cleanup');
                    return;
                }

                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

                const result = await ActivityLog.deleteMany({
                    timestamp: { $lt: cutoffDate },
                });

                this.logger.info(`Activity logs cleanup completed: ${result.deletedCount} logs removed (retention: ${retentionDays} days)`);
            } catch (error: any) {
                this.logger.error(`Failed to cleanup activity logs: ${error.message}`, error);
            }
        });
    }

    async start(): Promise<void> {
        await this.agenda.start();

        // Schedule recurring housekeeping job
        const schedule = process.env.ACTIVITY_LOG_HOUSEKEEPING_SCHEDULE || '0 2 * * *';

        await this.agenda.every(schedule, 'cleanup activity logs');
        this.logger.info(`Activity logs housekeeping scheduled: ${schedule}`);
    }

    async stop(): Promise<void> {
        await this.agenda.stop();
    }

    async scheduleRenewal(certificateId: string, date: Date): Promise<void> {
        // First cancel any existing jobs for this certificate to avoid duplicates
        await this.cancelRenewal(certificateId);

        // Then schedule the new job
        await this.agenda.schedule(date, 'renew certificate', { certificateId });

        this.logger.debug(`Scheduled renewal for certificate ${certificateId} at ${date.toISOString()}`);
    }

    async cancelRenewal(certificateId: string): Promise<void> {
        const result = await this.agenda.cancel({
            name: 'renew certificate',
            'data.certificateId': certificateId
        });

        if (result != null && result > 0) {
            this.logger.debug(`Cancelled ${result} existing job(s) for certificate ${certificateId}`);
        }
    }

    /**
     * Get the next scheduled renewal date for a certificate from Agenda
     */
    async getNextRenewalDate(certificateId: string): Promise<Date | null> {
        const jobs = await this.agenda.jobs({
            name: 'renew certificate',
            'data.certificateId': certificateId,
        });

        if (jobs.length === 0) {
            return null;
        }

        // Return the nextRunAt from the first matching job
        const nextRunAt = jobs[0].attrs.nextRunAt;
        return nextRunAt ? new Date(nextRunAt) : null;
    }

    /**
     * Get next renewal dates for multiple certificates
     */
    async getNextRenewalDates(certificateIds: string[]): Promise<Map<string, Date | null>> {
        const jobs = await this.agenda.jobs({
            name: 'renew certificate',
            'data.certificateId': { $in: certificateIds },
        });

        const dateMap = new Map<string, Date | null>();

        // Initialize all certificate IDs with null
        certificateIds.forEach(id => dateMap.set(id, null));

        // Fill in the dates from jobs
        jobs.forEach(job => {
            const certId = job.attrs.data?.certificateId;
            const nextRunAt = job.attrs.nextRunAt;
            if (certId && nextRunAt) {
                dateMap.set(certId, new Date(nextRunAt));
            }
        });

        return dateMap;
    }

    /**
     * Get scheduled renewal jobs within a date range for the calendar view
     */
    async getRenewalJobsInRange(startDate: Date, endDate: Date): Promise<Array<{ certificateId: string; scheduledAt: Date }>> {
        const jobs = await this.agenda.jobs({
            name: 'renew certificate',
            nextRunAt: {
                $gte: startDate,
                $lte: endDate
            }
        });

        return jobs.map(job => ({
            certificateId: job.attrs.data?.certificateId,
            scheduledAt: job.attrs.nextRunAt ? new Date(job.attrs.nextRunAt) : new Date()
        })).filter(job => job.certificateId); // Filter out jobs without certificateId
    }
}