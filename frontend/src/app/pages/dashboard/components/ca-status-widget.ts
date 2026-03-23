import { AcmeAccountService } from '@/services/acme-account.service';
import { AcmeCaService } from '@/services/acme-ca.service';
import { AuthService } from '@/services/auth.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { forkJoin, of } from 'rxjs';

@Component({
    standalone: true,
    selector: 'app-ca-status-widget',
    imports: [CommonModule, TranslateDirective, TranslateModule, CardModule, ButtonModule],
    templateUrl: './ca-status-widget.html'
})
export class CaStatusWidget implements OnInit {
    private acmeCaService = inject(AcmeCaService);
    private acmeAccountService = inject(AcmeAccountService);
    public authService = inject(AuthService);

    totalCAs: number = 0;
    defaultCA: string = '';
    acmeAccountsCount: number = 0;
    loading: boolean = true;

    ngOnInit() {
        this.loadCaStats();
    }

    private loadCaStats() {
        this.loading = true;
        const canReadCa = this.authService.hasPermission('acmeCa', 'read');
        const canReadAccounts = this.authService.hasPermission('acmeAccounts', 'read');

        forkJoin({
            cas: canReadCa ? this.acmeCaService.getAllCAs() : of({ data: [] as any[] }),
            accounts: canReadAccounts ? this.acmeAccountService.getAllAccounts() : of({ data: [] as any[] })
        }).subscribe(({ cas, accounts }) => {
            this.totalCAs = cas.data.length;
            const defaultCa = cas.data.find((ca: any) => ca.isDefault);
            this.defaultCA = defaultCa ? defaultCa.name : '';
            this.acmeAccountsCount = accounts.data.length;
            this.loading = false;
        });
    }
}
