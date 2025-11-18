import { Certificate, CertificateService } from '@/services/certificate.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective, TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';

interface ExpiringCertificate {
    id: string;
    domain: string;
    expiryDate: Date;
    daysRemaining: number;
}

@Component({
    standalone: true,
    selector: 'app-expiring-certificates-widget',
    imports: [CommonModule, TranslateDirective, TranslateModule, TableModule, ButtonModule, CardModule],
    templateUrl: './expiring-certificates-widget.html'
})
export class ExpiringCertificatesWidget implements OnInit {
    private certificateService = inject(CertificateService);
    public translateService = inject(TranslateService);

    expiringCertificates: ExpiringCertificate[] = [];
    loading: boolean = true;

    ngOnInit() {
        this.loadExpiringCertificates();
    }

    private loadExpiringCertificates() {
        this.loading = true;
        this.certificateService.getAllCertificates().subscribe((response) => {
            const certificates = response.data;
            const now = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(now.getDate() + 30);

            this.expiringCertificates = certificates
                .filter((cert: Certificate) => {
                    const expiryDate = new Date(cert.expiryDate!);
                    return expiryDate > now && expiryDate <= thirtyDaysFromNow;
                })
                .map((cert: Certificate) => {
                    const expiryDate = new Date(cert.expiryDate!);
                    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        id: cert._id!,
                        domain: cert.domain,
                        expiryDate: expiryDate,
                        daysRemaining: daysRemaining
                    };
                })
                .sort((a: ExpiringCertificate, b: ExpiringCertificate) => a.daysRemaining - b.daysRemaining)
                .slice(0, 5);

            this.loading = false;
        });
    }
}
