import { AsyncLocalStorage } from 'async_hooks';
import { Response } from 'express';
import { Job } from '../models/job.model';

type MessageCallback = (level: string, text: string) => void;

// Per-async-context job callback — isolates parallel jobs from each other
export const jobStorage = new AsyncLocalStorage<MessageCallback>();

class JobManagerService {
    private subscribers = new Map<string, Set<Response>>();

    async createJob(certId: string, certDomain: string, type: string) {
        return await Job.create({ certId, certDomain, type });
    }

    /**
     * Run fn() in a job context: messages from the Logger are persisted and broadcast.
     * Does NOT throw — errors are captured into the job record.
     */
    async runJob(jobId: string, fn: () => Promise<void>): Promise<void> {
        const callback: MessageCallback = (level, text) => {
            // Persist asynchronously — fire-and-forget is fine here
            Job.findByIdAndUpdate(jobId, { $push: { messages: { level, text, ts: new Date() } } })
                .catch(() => {});
            this.broadcast(jobId, { type: 'message', level, text });
        };

        try {
            await jobStorage.run(callback, fn);
            await Job.findByIdAndUpdate(jobId, { status: 'success', completedAt: new Date() });
            this.broadcast(jobId, { type: 'done' });
        } catch (err: any) {
            const errorText = err?.message ?? String(err);
            await Job.findByIdAndUpdate(jobId, {
                $push: { messages: { level: 'error', text: errorText, ts: new Date() } },
                status: 'error',
                completedAt: new Date()
            });
            this.broadcast(jobId, { type: 'message', level: 'error', text: errorText });
            this.broadcast(jobId, { type: 'error' });
        } finally {
            // Give subscribers a moment to receive the final event, then close streams
            setTimeout(() => {
                const subs = this.subscribers.get(jobId);
                if (subs) {
                    subs.forEach(res => { try { res.end(); } catch {} });
                    this.subscribers.delete(jobId);
                }
            }, 500);
        }
    }

    async subscribe(jobId: string, res: Response): Promise<void> {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const job = await Job.findById(jobId).lean();
        if (!job) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Job not found' })}\n\n`);
            res.end();
            return;
        }

        // Replay all buffered messages to the new subscriber
        for (const msg of job.messages) {
            res.write(`data: ${JSON.stringify({ type: 'message', level: msg.level, text: msg.text })}\n\n`);
        }

        // If job is already finished, send final event and close
        if (job.status !== 'running') {
            res.write(`data: ${JSON.stringify({ type: job.status === 'success' ? 'done' : 'error' })}\n\n`);
            res.end();
            return;
        }

        // Subscribe to live updates
        if (!this.subscribers.has(jobId)) {
            this.subscribers.set(jobId, new Set());
        }
        this.subscribers.get(jobId)!.add(res);
        res.on('close', () => this.subscribers.get(jobId)?.delete(res));
    }

    async getRecentJobs() {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return Job.find({
            $or: [
                { status: 'running' },
                { completedAt: { $gte: since } }
            ]
        }).sort({ startedAt: -1 }).limit(100).lean();
    }

    async dismissJob(jobId: string) {
        return Job.findByIdAndDelete(jobId);
    }

    private broadcast(jobId: string, data: any) {
        const subs = this.subscribers.get(jobId);
        if (!subs) return;
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        subs.forEach(res => {
            try {
                if (!res.destroyed && !res.writableEnded) res.write(payload);
            } catch {}
        });
    }
}

export const jobManagerService = new JobManagerService();
