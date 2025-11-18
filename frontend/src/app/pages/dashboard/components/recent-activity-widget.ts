import { ActivityLog, ActivityLogService } from '@/services/activity-log.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { TranslateDirective, TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TimelineModule } from 'primeng/timeline';

interface ActivityEvent {
    type: string;
    message: string;
    timestamp: Date;
}

@Component({
    standalone: true,
    selector: 'app-recent-activity-widget',
    imports: [CommonModule, TranslateDirective, TranslateModule, CardModule, ButtonModule, TimelineModule],
    templateUrl: './recent-activity-widget.html'
})
export class RecentActivityWidget implements OnInit {
    private activityLogService = inject(ActivityLogService);
    public translateService = inject(TranslateService);

    activities: ActivityEvent[] = [];
    loading: boolean = true;

    ngOnInit() {
        this.loadRecentActivity();
    }

    private loadRecentActivity() {
        this.loading = true;

        this.activityLogService.getRecentActivityLogs(10).subscribe({
            next: (logs: ActivityLog[]) => {
                this.activities = logs.map(log => ({
                    type: log.type,
                    message: "",
                    timestamp: new Date(log.timestamp)
                }));
                this.loading = false;
            },
            error: (error) => {
                this.activities = [];
                this.loading = false;
            }
        });
    }
}
