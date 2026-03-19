import { Component, inject, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { DashboardDataService } from '../dashboard-data.service';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

@Component({
    standalone: true,
    selector: 'app-ca-chart-widget',
    imports: [ChartModule, TranslateModule, CardModule],
    templateUrl: './ca-chart-widget.html'
})
export class CaChartWidget implements OnInit {
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
        const counts = new Map<string, number>();
        const names = new Map<string, string>();
        certificates.forEach(cert => {
            const ca = cert.certificateAuthority as any;
            if (!ca) return;
            const id: string = typeof ca === 'object' ? ca._id : ca;
            const name: string = typeof ca === 'object' ? ca.name : ca;
            counts.set(id, (counts.get(id) || 0) + 1);
            if (!names.has(id)) names.set(id, name);
        });
        const labels: string[] = [];
        const data: number[] = [];
        counts.forEach((count, id) => {
            labels.push(names.get(id) || id);
            data.push(count);
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
            plugins: { legend: { labels: { color: textColor, usePointStyle: true }, position: 'bottom',  title: { display: true } } }
        };
    }
}
