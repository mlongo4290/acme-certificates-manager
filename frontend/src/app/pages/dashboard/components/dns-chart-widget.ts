import { Component, inject, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { forkJoin } from 'rxjs';
import { DashboardDataService } from '../dashboard-data.service';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

@Component({
    standalone: true,
    selector: 'app-dns-chart-widget',
    imports: [ChartModule, TranslateModule, CardModule],
    templateUrl: './dns-chart-widget.html'
})
export class DnsChartWidget implements OnInit {
    private data = inject(DashboardDataService);
    private translate = inject(TranslateService);

    chartData: any;
    chartOptions: any;
    loading = true;

    ngOnInit() {
        this.initChartOptions();
        forkJoin({ certs: this.data.certs$, providers: this.data.providers$ }).subscribe(({ certs, providers }) => {
            this.processData(certs.data, providers.data);
            this.loading = false;
        });
        this.translate.onLangChange.subscribe(() => this.initChartOptions());
    }

    private processData(certificates: any[], providers: any[]) {
        const counts = new Map<string, number>();
        const names = new Map<string, string>();
        providers.forEach((p: any) => {
            counts.set(p._id!, 0);
            names.set(p._id!, p.name);
        });
        certificates.forEach(cert => {
            if (cert.dnsProvider && cert.challengeType === 'dns-01') {
                counts.set(cert.dnsProvider, (counts.get(cert.dnsProvider) || 0) + 1);
            }
        });
        const labels: string[] = [];
        const data: number[] = [];
        counts.forEach((count, id) => {
            if (count > 0) {
                labels.push(names.get(id) || id);
                data.push(count);
            }
        });
        this.chartData = {
            labels,
            datasets: [{ data, backgroundColor: PIE_COLORS, hoverBackgroundColor: PIE_COLORS }]
        };
    }

    private initChartOptions() {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color') || '#495057';
        this.chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: textColor }, position: 'bottom' } }
        };
    }
}
