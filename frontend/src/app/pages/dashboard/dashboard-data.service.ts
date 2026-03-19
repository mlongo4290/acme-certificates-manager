import { Injectable, inject } from '@angular/core';
import { CertificateService } from '@/services/certificate.service';
import { DnsProviderService } from '@/services/dns-provider.service';
import { shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
    private certService = inject(CertificateService);
    private providerService = inject(DnsProviderService);

    readonly certs$ = this.certService.getAllCertificates().pipe(shareReplay(1));
    readonly providers$ = this.providerService.getAllProviders().pipe(shareReplay(1));
}
