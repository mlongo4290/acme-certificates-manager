import { CertificateService } from '@/services/certificate.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';

@Component({
    standalone: true,
    selector: 'app-auto-renewal-stats-widget',
    imports: [CommonModule, TranslateDirective, TranslateModule, CardModule],
    templateUrl: './auto-renewal-stats-widget.html'
})
export class AutoRenewalStatsWidget implements OnInit {
    private certificateService = inject(CertificateService);

    certsWithAutoRenewal: number = 0;
    nextScheduledRenewals: number = 0;
    successRate: number = 0;
    totalCertificates: number = 0;
    loading: boolean = true;

    ngOnInit() {
        this.loadAutoRenewalStats();
    }

    private loadAutoRenewalStats() {
        this.loading = true;
        this.certificateService.getAllCertificates().subscribe((response) => {
            const certificates = response.data;
            this.totalCertificates = certificates.length;
            this.certsWithAutoRenewal = certificates.filter(cert => cert.autoRenewal).length;

            // Calculate next scheduled renewals (certificates expiring within configured days before expiry)
            const now = new Date();
            this.nextScheduledRenewals = certificates.filter(cert => {
                if (!cert.autoRenewal || !cert.expiryDate) return false;
                const expiryDate = new Date(cert.expiryDate);
                const daysBeforeExpiry = cert.renewalSchedule?.daysBeforeExpiry || 30;
                const renewalDate = new Date(expiryDate);
                renewalDate.setDate(renewalDate.getDate() - daysBeforeExpiry);
                return renewalDate <= now && expiryDate > now;
            }).length;

            // Calculate success rate from last renewal attempts (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentAttempts = certificates.filter(cert =>
                cert.lastRenewalAttempt && new Date(cert.lastRenewalAttempt) >= thirtyDaysAgo
            );
            if (recentAttempts.length > 0) {
                const successfulAttempts = recentAttempts.filter(cert => cert.lastRenewalStatus === 'success').length;
                this.successRate = Math.round((successfulAttempts / recentAttempts.length) * 100);
            } else {
                this.successRate = 0;
            }

            this.loading = false;
        });
    }
}
