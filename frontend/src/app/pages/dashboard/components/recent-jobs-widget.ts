import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { Job, JobService } from '@/services/job.service';

@Component({
    standalone: true,
    selector: 'app-recent-jobs-widget',
    imports: [CommonModule, RouterModule, TranslateModule, CardModule],
    templateUrl: './recent-jobs-widget.html'
})
export class RecentJobsWidget implements OnInit {
    private jobService = inject(JobService);
    private translate = inject(TranslateService);

    jobs: Job[] = [];
    loading = true;

    ngOnInit() {
        this.jobService.getJobs().subscribe({
            next: (jobs) => {
                this.jobs = jobs.slice(0, 5);
                this.loading = false;
            },
            error: () => { this.loading = false; }
        });
    }

    getStatusIcon(status: string): string {
        if (status === 'success') return 'pi pi-check-circle text-green-500';
        if (status === 'error') return 'pi pi-times-circle text-red-500';
        return 'pi pi-spin pi-spinner text-blue-500';
    }

    timeAgo(date: string): string {
        const diff = (new Date(date).getTime() - Date.now()) / 1000;
        const abs = Math.abs(diff);
        const lang = this.translate.currentLang || 'en';
        const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
        if (abs < 60) return rtf.format(Math.round(diff), 'second');
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
        return rtf.format(Math.round(diff / 86400), 'day');
    }
}
