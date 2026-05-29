import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface JobMessage {
    level: string;
    text: string;
    ts: string;
}

export interface Job {
    _id: string;
    certId: string;
    certDomain: string;
    type: 'issue' | 'renew' | 'reissue' | 'dry-run';
    status: 'running' | 'success' | 'error';
    messages: JobMessage[];
    startedAt: string;
    completedAt?: string;
}

export interface RunningJob {
    certId: string;
    domain: string;
    type: string;
}

@Injectable({ providedIn: 'root' })
export class JobService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private apiUrl = `${environment.apiUrl}/jobs`;

    private _runningJobs = new BehaviorSubject<RunningJob[]>([]);
    runningJobs$ = this._runningJobs.asObservable();

    /** Emits certId whenever a job stream completes (success or error). */
    jobCompleted$ = new Subject<string>();

    /** Open EventSources keyed by certId — prevents duplicate streams. */
    private _openStreams = new Map<string, EventSource>();

    get runningCount() { return this._runningJobs.value.length; }

    /** Add a job to the running list (idempotent). */
    addRunning(job: RunningJob) {
        if (this._runningJobs.value.some(j => j.certId === job.certId)) return;
        this._runningJobs.next([...this._runningJobs.value, job]);
    }

    removeRunning(certId: string) {
        this._runningJobs.next(this._runningJobs.value.filter(j => j.certId !== certId));
    }

    /**
     * Open an SSE stream for a job (idempotent — no-op if already streaming).
     * Automatically removes the job from runningJobs and emits jobCompleted$ on finish.
     */
    openStream(certId: string, jobId: string) {
        if (this._openStreams.has(certId)) return;
        const token = this.authService.getToken();
        const es = new EventSource(`${this.apiUrl}/${jobId}/stream?token=${token}`);
        this._openStreams.set(certId, es);

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            es.close();
            this._openStreams.delete(certId);
            this.removeRunning(certId);
            this.jobCompleted$.next(certId);
        };

        es.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'done' || data.type === 'error') finish();
        };
        es.onerror = () => finish();
    }

    /**
     * Fetch running jobs from the backend, populate runningJobs$ and open streams.
     * Safe to call multiple times (idempotent).
     */
    syncFromBackend() {
        this.getJobs().subscribe(jobs => {
            for (const j of jobs.filter(j => j.status === 'running')) {
                this.addRunning({ certId: j.certId, domain: j.certDomain, type: j.type });
                this.openStream(j.certId, j._id);
            }
        });
    }

    getJobs(): Observable<Job[]> {
        return this.http.get<Job[]>(this.apiUrl);
    }

    dismissJob(id: string): Observable<{ ok: boolean }> {
        return this.http.delete<{ ok: boolean }>(`${this.apiUrl}/${id}`);
    }
}
