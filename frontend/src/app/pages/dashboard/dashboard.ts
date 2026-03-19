import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { KtdGridLayout, KtdGridModule, ktdTrackById } from '@katoid/angular-grid-layout';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { DrawerModule } from 'primeng/drawer';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { AlertsWidget } from './components/alerts-widget';
import { AutoRenewalStatsWidget } from './components/auto-renewal-stats-widget';
import { CaStatusWidget } from './components/ca-status-widget';
import { DnsProvidersStatusWidget } from './components/dns-providers-status-widget';
import { ExpiringCertificatesWidget } from './components/expiring-certificates-widget';
import { RecentActivityWidget } from './components/recent-activity-widget';
import { RecentJobsWidget } from './components/recent-jobs-widget';
import { StatsWidget } from './components/statswidget';
import { CaChartWidget } from './components/ca-chart-widget';
import { ChallengeChartWidget } from './components/challenge-chart-widget';
import { DnsChartWidget } from './components/dns-chart-widget';

interface WidgetVisibility {
    [id: string]: boolean;
}

const DEFAULT_LAYOUT: KtdGridLayout = [
    { id: 'stats',           x: 0, y: 0,  w: 12, h: 3 },
    { id: 'alerts',          x: 0, y: 3,  w: 3,  h: 4 },
    { id: 'dns-providers',   x: 3, y: 3,  w: 3,  h: 4 },
    { id: 'expiring-certs',  x: 6, y: 3,  w: 6,  h: 4 },
    { id: 'ca-status',       x: 0, y: 7,  w: 4,  h: 4 },
    { id: 'auto-renewal',    x: 4, y: 7,  w: 4,  h: 4 },
    { id: 'recent-jobs',     x: 8, y: 7,  w: 4,  h: 4 },
    { id: 'chart-ca',        x: 0, y: 11, w: 4,  h: 5 },
    { id: 'chart-challenge', x: 4, y: 11, w: 4,  h: 5 },
    { id: 'chart-dns',       x: 8, y: 11, w: 4,  h: 5 },
    { id: 'recent-activity', x: 0, y: 16, w: 6,  h: 5 },
];

const DEFAULT_VISIBILITY: WidgetVisibility = {
    'stats': true,
    'alerts': true,
    'dns-providers': true,
    'expiring-certs': false,
    'ca-status': true,
    'auto-renewal': true,
    'recent-jobs': true,
    'chart-ca': true,
    'chart-challenge': true,
    'chart-dns': true,
    'recent-activity': true,
};

const CONFIG_KEY = 'acm-dashboard-grid-config';

@Component({
    selector: 'app-dashboard',
    imports: [
        StatsWidget,
        ExpiringCertificatesWidget,
        RecentActivityWidget,
        DnsProvidersStatusWidget,
        CaStatusWidget,
        AutoRenewalStatsWidget,
        AlertsWidget,
        RecentJobsWidget,
        CaChartWidget,
        ChallengeChartWidget,
        DnsChartWidget,
        KtdGridModule,
        FormsModule,
        TranslateModule,
        ButtonModule,
        DrawerModule,
        DividerModule,
        ToggleSwitchModule,
    ],
    templateUrl: './dashboard.html'
})
export class Dashboard implements OnInit {
    layout: KtdGridLayout = DEFAULT_LAYOUT.map(item => ({ ...item }));
    visibility: WidgetVisibility = { ...DEFAULT_VISIBILITY };
    editMode = false;
    showCustomize = false;
    trackById = ktdTrackById;
    cols = 12;
    rowHeight = 60;

    get visibleLayout(): KtdGridLayout {
        return this.layout.filter(item => this.visibility[item.id] !== false);
    }

    ngOnInit() {
        const saved = localStorage.getItem(CONFIG_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.layout && Array.isArray(parsed.layout)) {
                    const defaultMap = new Map(DEFAULT_LAYOUT.map(item => [item.id, item]));
                    const savedMap = new Map((parsed.layout as KtdGridLayout).map((item: any) => [item.id, item]));
                    this.layout = DEFAULT_LAYOUT.map(item => ({ ...(defaultMap.get(item.id) || item), ...(savedMap.get(item.id) || {}) }));
                }
                if (parsed.visibility) {
                    this.visibility = { ...DEFAULT_VISIBILITY, ...parsed.visibility };
                }
            } catch { /* ignore corrupt storage */ }
        }
    }

    onLayoutUpdated(newLayout: KtdGridLayout) {
        const layoutMap = new Map(newLayout.map(item => [item.id, item]));
        this.layout = this.layout.map(item => layoutMap.get(item.id) ?? item);
        this.saveConfig();
    }

    toggleWidget(id: string) {
        this.visibility = { ...this.visibility, [id]: !this.visibility[id] };
        if (this.visibility[id] && !this.layout.find(item => item.id === id)) {
            const defaultItem = DEFAULT_LAYOUT.find(item => item.id === id);
            if (defaultItem) {
                this.layout = [...this.layout, { ...defaultItem }];
            }
        }
        this.saveConfig();
    }

    saveConfig() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ layout: this.layout, visibility: this.visibility }));
    }

    resetConfig() {
        this.layout = DEFAULT_LAYOUT.map(item => ({ ...item }));
        this.visibility = { ...DEFAULT_VISIBILITY };
        localStorage.removeItem(CONFIG_KEY);
    }
}
