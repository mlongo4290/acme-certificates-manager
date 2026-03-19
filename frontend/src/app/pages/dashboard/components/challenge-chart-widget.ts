import { Component, inject, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { DashboardDataService } from '../dashboard-data.service';

@Component({
    standalone: true,
    selector: 'app-challenge-chart-widget',
    imports: [ChartModule, TranslateModule, CardModule],
    templateUrl: './challenge-chart-widget.html'
})
export class ChallengeChartWidget implements OnInit {
    private data = inject(DashboardDataService);
    private translate = inject(TranslateService);

    chartData: any;
    chartOptions: any;
    loading = true;

    ngOnInit() {
        this.initChartOptions();
        this.data.certs$.subscribe(result => {
            this.processData(result.data);
            this.loading = false;
        });
        this.translate.onLangChange.subscribe(() => this.initChartOptions());
    }

    private processData(certificates: any[]) {
        const counts: Record<string, number> = { 'http-01': 0, 'dns-01': 0, 'tls-alpn-01': 0 };
        certificates.forEach(cert => {
            if (cert.challengeType in counts) counts[cert.challengeType]++;
        });
        this.chartData = {
            labels: ['HTTP-01', 'DNS-01', 'TLS-ALPN-01'],
            datasets: [{
                data: [counts['http-01'], counts['dns-01'], counts['tls-alpn-01']],
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'],
                hoverBackgroundColor: ['#2563eb', '#16a34a', '#d97706']
            }]
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
