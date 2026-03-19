import { Certificate, CertificateService } from '@/services/certificate.service';
import { DnsProvider, DnsProviderService } from '@/services/dns-provider.service';
import { Component, inject, Input, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { forkJoin } from 'rxjs';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

@Component({
    standalone: true,
    selector: 'app-certificate-chart-widget',
    imports: [ChartModule, TranslateModule, CardModule],
    templateUrl: './certificatechartwidget.html'
})
export class CertificateChartWidget implements OnInit {
    @Input() showCaDistribution = true;
    @Input() showChallenge = true;
    @Input() showDns = true;

    private certificateService = inject(CertificateService);
    private dnsProviderService = inject(DnsProviderService);
    private translate = inject(TranslateService);

    caDistributionData: any;
    caDistributionOptions: any;

    challengeTypeData: any;
    challengeTypeOptions: any;

    providerDistributionData: any;
    providerDistributionOptions: any;

    loading = true;

    ngOnInit() {
        this.loadData();
        this.translate.onLangChange.subscribe(() => this.initChartOptions());
    }

    private loadData() {
        this.loading = true;
        forkJoin({
            certificates: this.certificateService.getAllCertificates(),
            providers: this.dnsProviderService.getAllProviders()
        }).subscribe(({ certificates, providers }) => {
            this.processChallengeTypeData(certificates.data);
            this.processProviderDistribution(certificates.data, providers.data);
            this.processCaDistribution(certificates.data);
            this.initChartOptions();
            this.loading = false;
        });
    }

    private processChallengeTypeData(certificates: Certificate[]) {
        const counts: Record<string, number> = { 'http-01': 0, 'dns-01': 0, 'tls-alpn-01': 0 };
        certificates.forEach(cert => {
            if (cert.challengeType in counts) counts[cert.challengeType]++;
        });
        this.challengeTypeData = {
            labels: ['HTTP-01', 'DNS-01', 'TLS-ALPN-01'],
            datasets: [{
                data: [counts['http-01'], counts['dns-01'], counts['tls-alpn-01']],
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'],
                hoverBackgroundColor: ['#2563eb', '#16a34a', '#d97706']
            }]
        };
    }

    private processProviderDistribution(certificates: Certificate[], providers: DnsProvider[]) {
        const counts = new Map<string, number>();
        const names = new Map<string, string>();
        providers.forEach(p => { counts.set(p._id!, 0); names.set(p._id!, p.name); });
        certificates.forEach(cert => {
            if (cert.dnsProvider && cert.challengeType === 'dns-01') {
                counts.set(cert.dnsProvider, (counts.get(cert.dnsProvider) || 0) + 1);
            }
        });
        const labels: string[] = [], data: number[] = [];
        counts.forEach((count, id) => { if (count > 0) { labels.push(names.get(id) || id); data.push(count); } });
        this.providerDistributionData = {
            labels,
            datasets: [{ data, backgroundColor: PIE_COLORS, hoverBackgroundColor: PIE_COLORS }]
        };
    }

    private processCaDistribution(certificates: Certificate[]) {
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
        const labels: string[] = [], data: number[] = [];
        counts.forEach((count, id) => { labels.push(names.get(id) || id); data.push(count); });
        this.caDistributionData = {
            labels,
            datasets: [{ data, backgroundColor: PIE_COLORS, hoverBackgroundColor: PIE_COLORS }]
        };
    }

    private initChartOptions() {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color') || '#495057';
        const pieOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: textColor }, position: 'bottom' } }
        };
        this.challengeTypeOptions = pieOptions;
        this.providerDistributionOptions = pieOptions;
        this.caDistributionOptions = pieOptions;
    }
}
