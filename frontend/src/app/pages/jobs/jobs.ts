import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { Job, JobService } from '../../services/job.service';

interface ActiveJob {
    data: Job;
    messages: string[];
    collapsed: boolean;
    streaming: boolean;
    eventSource?: EventSource;
}

@Component({
    selector: 'app-jobs',
    standalone: true,
    imports: [CommonModule, TranslateModule, ButtonModule, TagModule, ToastModule, TooltipModule, DatePipe],
    providers: [MessageService],
    templateUrl: './jobs.html'
})
export class JobsComponent implements OnInit, OnDestroy {
    private jobService = inject(JobService);
    private authService = inject(AuthService);
    private messageService = inject(MessageService);
    private cdr = inject(ChangeDetectorRef);
    translate = inject(TranslateService);

    jobs: ActiveJob[] = [];
    loading = true;

    ngOnInit() {
        this.loadJobs();
    }

    ngOnDestroy() {
        this.jobs.forEach(j => j.eventSource?.close());
    }

    loadJobs() {
        this.loading = true;
        this.jobService.getJobs().subscribe({
            next: (jobs) => {
                this.jobs = jobs.map(j => ({
                    data: j,
                    messages: j.messages.map(m => (m.level === 'error' ? '✗ ' : m.level === 'warn' ? '⚠ ' : '') + m.text),
                    collapsed: j.status !== 'running',
                    streaming: false
                }));
                // Connect SSE for running jobs
                for (const job of this.jobs) {
                    if (job.data.status === 'running') this.connectStream(job);
                }
                this.loading = false;
            },
            error: () => { this.loading = false; }
        });
    }

    private connectStream(job: ActiveJob) {
        job.streaming = true;
        const token = this.authService.getToken();
        const es = new EventSource(`${environment.apiUrl}/jobs/${job.data._id}/stream?token=${token}`);
        job.eventSource = es;

        es.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                const icon = data.level === 'error' ? '✗ ' : data.level === 'warn' ? '⚠ ' : '';
                job.messages.push(icon + data.text);
                this.cdr.detectChanges();
            } else if (data.type === 'done') {
                job.data.status = 'success';
                job.streaming = false;
                es.close();
                this.cdr.detectChanges();
            } else if (data.type === 'error') {
                job.data.status = 'error';
                job.streaming = false;
                es.close();
                this.cdr.detectChanges();
            }
        };
        es.onerror = () => {
            es.close();
            job.streaming = false;
            this.cdr.detectChanges();
        };
    }

    dismiss(job: ActiveJob) {
        this.jobService.dismissJob(job.data._id).subscribe({
            next: () => {
                job.eventSource?.close();
                this.jobs = this.jobs.filter(j => j !== job);
            }
        });
    }

    dismissAll() {
        const completed = this.jobs.filter(j => j.data.status !== 'running');
        completed.forEach(j => this.jobService.dismissJob(j.data._id).subscribe());
        this.jobs = this.jobs.filter(j => j.data.status === 'running');
    }

    getStatusSeverity(status: string): 'success' | 'danger' | 'info' | 'secondary' {
        switch (status) {
            case 'success': return 'success';
            case 'error': return 'danger';
            case 'running': return 'info';
            default: return 'secondary';
        }
    }

    getTypeIcon(type: string): string {
        switch (type) {
            case 'issue': return 'pi pi-play';
            case 'renew': return 'pi pi-refresh';
            case 'reissue': return 'pi pi-file-edit';
            default: return 'pi pi-cog';
        }
    }

    get completedCount() { return this.jobs.filter(j => j.data.status !== 'running').length; }
    get runningCount() { return this.jobs.filter(j => j.data.status === 'running').length; }
}
