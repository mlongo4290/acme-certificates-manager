import { Component } from '@angular/core';
import { AlertsWidget } from './components/alerts-widget';
import { AutoRenewalStatsWidget } from './components/auto-renewal-stats-widget';
import { CaStatusWidget } from './components/ca-status-widget';
import { CertificateChartWidget } from './components/certificatechartwidget';
import { DnsProvidersStatusWidget } from './components/dns-providers-status-widget';
import { ExpiringCertificatesWidget } from './components/expiring-certificates-widget';
import { RecentActivityWidget } from './components/recent-activity-widget';
import { StatsWidget } from './components/statswidget';

@Component({
    selector: 'app-dashboard',
    imports: [
        StatsWidget,
        CertificateChartWidget,
        ExpiringCertificatesWidget,
        RecentActivityWidget,
        DnsProvidersStatusWidget,
        CaStatusWidget,
        AutoRenewalStatsWidget,
        AlertsWidget
    ],
    templateUrl: './dashboard.html'
})
export class Dashboard { }

