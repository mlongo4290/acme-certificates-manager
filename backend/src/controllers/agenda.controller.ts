import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { Certificate } from '../models/certificate.model';
import { AgendaService } from '../services/agenda.service';

export class AgendaController {
    constructor(private schedulerService: AgendaService) { }

    /**
     * Get scheduled renewal jobs for calendar view
     * Query params: startDate, endDate (ISO date strings)
     */
    getRenewalCalendar = asyncHandler(async (req: Request, res: Response) => {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            res.status(400).json({ error: 'startDate and endDate are required' });
            return;
        }

        const start = new Date(startDate as string);
        const end = new Date(endDate as string);

        // Get jobs from Agenda
        const jobs = await this.schedulerService.getRenewalJobsInRange(start, end);

        // Get certificate details for the jobs
        const certificateIds = jobs.map(job => job.certificateId);
        const certificates = await Certificate.find(
            { _id: { $in: certificateIds } },
            { domain: 1 } // Only fetch the domain field
        );

        // Create a map for quick lookup
        const certMap = new Map(
            certificates.map(cert => [cert._id.toString(), cert.domain])
        );

        // Combine job and certificate data
        const calendarEvents = jobs.map(job => ({
            certificateId: job.certificateId,
            domain: certMap.get(job.certificateId) || 'Unknown',
            scheduledAt: job.scheduledAt
        }));

        res.json(calendarEvents);
    });
}
