import { DnsProviderService } from '@/services/dns-provider.service';
import { AuthService } from '@/services/auth.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
    standalone: true,
    selector: 'app-dns-providers-status-widget',
    imports: [CommonModule, TranslateDirective, TranslateModule, CardModule, ButtonModule],
    templateUrl: './dns-providers-status-widget.html'
})
export class DnsProvidersStatusWidget implements OnInit {
    private dnsProviderService = inject(DnsProviderService);
    public authService = inject(AuthService);

    totalProviders: number = 0;
    activeProviders: number = 0;
    disabledProviders: number = 0;
    loading: boolean = true;

    ngOnInit() {
        this.loadDnsProvidersStats();
    }

    private loadDnsProvidersStats() {
        this.loading = true;
        if (!this.authService.hasPermission('dnsProviders', 'read')) {
            this.loading = false;
            return;
        }
        this.dnsProviderService.getAllProviders().subscribe((response) => {
            this.totalProviders = response.data.length;
            this.activeProviders = response.data.filter(p => p.enabled).length;
            this.disabledProviders = response.data.filter(p => !p.enabled).length;
            this.loading = false;
        });
    }
}
