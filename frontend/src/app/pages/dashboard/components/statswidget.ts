import { CertificateService } from '@/services/certificate.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';

@Component({
    standalone: true,
    selector: 'app-stats-widget',
    imports: [CommonModule, TranslateDirective, CardModule],
    templateUrl: './statswidget.html'
})
export class StatsWidget implements OnInit {
    private certificateService = inject(CertificateService);

    certificatesCount: number = 0;
    validCertificatesCount: number = 0;
    expiringSoonCertificatesCount: number = 0;
    expiredCertificatesCount: number = 0;

    ngOnInit() {
        this.loadCertificatesStats();
    }

    private loadCertificatesStats() {
        this.certificateService.getCertificatesStats().subscribe(stats => {
            this.certificatesCount = stats.total;
            this.validCertificatesCount = stats.valid;
            this.expiringSoonCertificatesCount = stats.expiringSoon;
            this.expiredCertificatesCount = stats.expired;
        });
    }
}
