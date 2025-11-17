import { AcmeAccountService } from '@/services/acme-account.service';
import { CertificateService } from '@/services/certificate.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateDirective, TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { forkJoin } from 'rxjs';

interface Alert {
    type: 'certsWithoutRenewal' | 'failedDnsProviders' | 'unregisteredAccounts';
    severity: 'warn' | 'error' | 'info';
    count: number;
    message: string;
    action: () => void;
}

@Component({
    standalone: true,
    selector: 'app-alerts-widget',
    imports: [CommonModule, TranslateDirective, TranslateModule, CardModule, ButtonModule, MessageModule],
    templateUrl: './alerts-widget.html'
})
export class AlertsWidget implements OnInit {
    private certificateService = inject(CertificateService);
    private acmeAccountService = inject(AcmeAccountService);
    private router = inject(Router);
    private translateService = inject(TranslateService);

    alerts: Alert[] = [];
    loading: boolean = true;

    ngOnInit() {
        this.loadAlerts();
    }

    private loadAlerts() {
        this.loading = true;
        forkJoin({
            certificates: this.certificateService.getAllCertificates(),
            accounts: this.acmeAccountService.getAllAccounts()
        }).subscribe(({ certificates, accounts }) => {

            this.alerts = [];

            // Check certificates without auto-renewal
            const certsWithoutRenewal = certificates.data.filter(cert => !cert.autoRenewal && cert.status === 'valid').length;
            if (certsWithoutRenewal > 0) {
                this.alerts.push({
                    type: 'certsWithoutRenewal',
                    severity: 'warn',
                    count: certsWithoutRenewal,
                    message: this.translateService.instant('dashboard.alerts.certsWithoutRenewal'),
                    action: () => this.router.navigate(['/certificates'])
                });
            }

            // Check unregistered ACME accounts
            const unregisteredAccounts = accounts.data.filter((acc: any) => !acc.registeredAt).length;
            if (unregisteredAccounts > 0) {
                this.alerts.push({
                    type: 'unregisteredAccounts',
                    severity: 'error',
                    count: unregisteredAccounts,
                    message: this.translateService.instant('dashboard.alerts.unregisteredAccounts'),
                    action: () => this.router.navigate(['/acme-accounts'])
                });
            }

            this.loading = false;
        });
    }

    getCountLabel(alert: Alert): string {
        switch (alert.type) {
            case 'certsWithoutRenewal':
                return this.translateService.instant('certificates.title').toLowerCase();
            case 'unregisteredAccounts':
                return this.translateService.instant('acmeAccounts.title').toLowerCase();
            default:
                return '';
        }
    }
}
