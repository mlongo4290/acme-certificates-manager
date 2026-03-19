import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { jobManagerService } from '../services/jobManager.service';

export class JobController {
    getJobs = asyncHandler(async (_req: Request, res: Response) => {
        const jobs = await jobManagerService.getRecentJobs();
        res.json(jobs);
    });

    streamJob = async (req: Request, res: Response) => {
        await jobManagerService.subscribe(req.params.id, res);
    };

    dismissJob = asyncHandler(async (req: Request, res: Response) => {
        await jobManagerService.dismissJob(req.params.id);
        res.json({ ok: true });
    });
}
