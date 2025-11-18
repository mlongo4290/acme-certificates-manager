import { Certificate, CertificateService, CertificatesStats } from '@/services/certificate.service';
import { DnsProvider, DnsProviderService } from '@/services/dns-provider.service';
import { Component, inject, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { forkJoin } from 'rxjs';

@Component({
    standalone: true,
    selector: 'app-certificate-chart-widget',
    imports: [ChartModule, TranslateModule, CardModule],
    templateUrl: './certificatechartwidget.html'
})
export class CertificateChartWidget implements OnInit {
    private certificateService = inject(CertificateService);
    private dnsProviderService = inject(DnsProviderService);
    private translate = inject(TranslateService);

    statsData: any;
    statsOptions: any;

    challengeTypeData: any;
    challengeTypeOptions: any;

    providerDistributionData: any;
    providerDistributionOptions: any;

    loading: boolean = true;

    ngOnInit() {
        this.loadDistributionData();

        this.translate.onLangChange.subscribe(() => {
            this.initCharts();
        });
    }

    private loadDistributionData() {
        this.loading = true;
        forkJoin({
            stats: this.certificateService.getCertificatesStats(),
            certificates: this.certificateService.getAllCertificates(),
            providers: this.dnsProviderService.getAllProviders()
        }).subscribe(({ stats, certificates, providers }) => {
            this.processStatsData(stats);
            this.processChallengeTypeData(certificates.data);
            this.processProviderDistribution(certificates.data, providers.data);
            this.initCharts();
            this.loading = false;
        });
    }

    private processStatsData(stats: CertificatesStats) {
        const validCertificatesCount = stats.valid;
        const expiringSoonCertificatesCount = stats.expiringSoon;
        const expiredCertificatesCount = stats.expired;

        this.statsData = {
            labels: [
                this.translate.instant('certificates.status.valid'),
                this.translate.instant('certificates.status.expiring'),
                this.translate.instant('certificates.status.expired')
            ],
            datasets: [
                {
                    data: [validCertificatesCount, expiringSoonCertificatesCount, expiredCertificatesCount],
                    backgroundColor: ['#22c55e', '#fbbf24', '#ef4444'],
                    hoverBackgroundColor: ['#16a34a', '#d97706', '#b91c1c']
                }
            ]
        };
    }

    private processChallengeTypeData(certificates: Certificate[]) {
        const challengeCounts = {
            'http-01': 0,
            'dns-01': 0,
            'tls-alpn-01': 0
        };

        certificates.forEach(cert => {
            if (challengeCounts.hasOwnProperty(cert.challengeType)) {
                challengeCounts[cert.challengeType]++;
            }
        });

        this.challengeTypeData = {
            labels: [
                "HTTP-01",
                "DNS-01",
                "TLS-ALPN-01"
            ],
            datasets: [{
                data: [challengeCounts['http-01'], challengeCounts['dns-01'], challengeCounts['tls-alpn-01']],
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'],
                hoverBackgroundColor: ['#2563eb', '#16a34a', '#d97706']
            }]
        };
    }

    private processProviderDistribution(certificates: Certificate[], providers: DnsProvider[]) {
        const providerCounts = new Map<string, number>();
        const providerNames = new Map<string, string>();

        // Initialize counts for all providers
        providers.forEach(provider => {
            providerCounts.set(provider._id!, 0);
            providerNames.set(provider._id!, provider.name);
        });

        // Count certificates per provider
        certificates.forEach(cert => {
            if (cert.dnsProvider && cert.challengeType === 'dns-01') {
                const count = providerCounts.get(cert.dnsProvider) || 0;
                providerCounts.set(cert.dnsProvider, count + 1);
            }
        });

        // Convert to arrays for chart
        const labels: string[] = [];
        const data: number[] = [];

        providerCounts.forEach((count, providerId) => {
            if (count > 0) {
                labels.push(providerNames.get(providerId) || 'Unknown');
                data.push(count);
            }
        });

        this.providerDistributionData = {
            labels: labels,
            datasets: [{
                label: this.translate.instant('dashboard.charts.dnsDistribution'),
                data: data,
                backgroundColor: '#3b82f6',
                hoverBackgroundColor: '#2563eb'
            }]
        };
    }

    private initCharts() {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color') || '#495057';

        this.challengeTypeOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    },
                    position: 'bottom'
                }
            }
        };

        this.providerDistributionOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    },
                    position: 'bottom'
                }
            }
        };

        this.providerDistributionOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    },
                    position: 'bottom'
                }
            }
        };

        this.statsOptions = {
            plugins: {
                legend: {
                    labels: {
                        usePointStyle: true,
                        color: textColor
                    },
                    position: 'bottom'
                }
            }
        };
    }
}