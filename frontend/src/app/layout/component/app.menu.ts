import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { AppMenuitem } from './app.menuitem';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule, TranslateModule],
    templateUrl: './app.menu.html'
})
export class AppMenu implements OnInit {
    model: MenuItem[] = [];
    private authService = inject(AuthService);
    private translate = inject(TranslateService);

    ngOnInit() {
        this.loadMenu();
        this.translate.onLangChange.subscribe(() => {
            this.loadMenu();
        });
    }

    loadMenu() {
        const isAdmin = this.authService.isAdmin();

        // Home section — always visible when authenticated
        const homeItems: MenuItem[] = [
            { label: this.translate.instant('dashboard.title'), icon: 'pi pi-fw pi-home', routerLink: ['/'] },
        ];

        if (this.authService.hasPermission('activityLogs', 'read')) {
            homeItems.push({ label: this.translate.instant('menu.activityLog'), icon: 'pi pi-fw pi-history', routerLink: ['/activity-logs'] });
        }

        if (this.authService.hasPermission('jobs', 'read')) {
            homeItems.push({ label: this.translate.instant('jobs.title'), icon: 'pi pi-fw pi-list-check', routerLink: ['/jobs'] });
        }

        const menuItems: MenuItem[] = [{ label: this.translate.instant('home'), items: homeItems }];

        // ACME section — build based on per-resource permissions
        const acmeItems: MenuItem[] = [];

        if (this.authService.hasPermission('acmeCa', 'read')) {
            acmeItems.push({ label: this.translate.instant('acmeCa.title'), routerLink: ['/acme-ca'], icon: 'pi pi-fw pi-globe' });
        }
        if (this.authService.hasPermission('acmeAccounts', 'read')) {
            acmeItems.push({ label: this.translate.instant('acmeAccounts.title'), routerLink: ['/acme-accounts'], icon: 'pi pi-fw pi-user-edit' });
        }
        if (this.authService.hasPermission('dnsProviders', 'read')) {
            acmeItems.push({ label: this.translate.instant('dnsProviders.title'), routerLink: ['/dns-providers'], icon: 'pi pi-fw pi-cloud' });
        }
        if (this.authService.hasPermission('sshKeys', 'read')) {
            acmeItems.push({ label: this.translate.instant('sshKeys.title'), routerLink: ['/ssh-keys'], icon: 'pi pi-fw pi-key' });
        }
        if (this.authService.hasPermission('scripts', 'read')) {
            acmeItems.push({ label: this.translate.instant('scripts.title'), routerLink: ['/post-issue-scripts'], icon: 'pi pi-fw pi-code' });
        }
        if (this.authService.hasPermission('certificates', 'read')) {
            acmeItems.push({ label: this.translate.instant('certificates.title'), routerLink: ['/certificates'], icon: 'pi pi-fw pi-verified' });
        }
        if (this.authService.hasPermission('renewalCalendar', 'read')) {
            acmeItems.push({ label: this.translate.instant('renewalCalendar.title'), routerLink: ['/renewal-calendar'], icon: 'pi pi-fw pi-calendar' });
        }
        if (this.authService.hasPermission('webhooks', 'read')) {
            acmeItems.push({ label: this.translate.instant('webhooks.title'), routerLink: ['/webhooks'], icon: 'pi pi-fw pi-bolt' });
        }

        if (acmeItems.length > 0) {
            menuItems.push({ label: 'ACME', items: acmeItems });
        }

        // Security section
        const securityItems: MenuItem[] = [];
        if (isAdmin) {
            securityItems.push({ label: this.translate.instant('menu.authProviders'), icon: 'pi pi-fw pi-cloud', routerLink: ['/admin/auth-providers'] });
            securityItems.push({ label: this.translate.instant('menu.users'), icon: 'pi pi-fw pi-users', routerLink: ['/admin/users'] });
            securityItems.push({ label: this.translate.instant('menu.roles'), icon: 'pi pi-fw pi-sitemap', routerLink: ['/admin/roles'] });
            securityItems.push({ label: this.translate.instant('menu.configExport'), icon: 'pi pi-fw pi-file-export', routerLink: ['/admin/config-export'] });
        }
        securityItems.push({ label: this.translate.instant('menu.swaggerDocs'), icon: 'pi pi-fw pi-book', url: '/api/v1/docs', target: '_blank' });

        menuItems.push({ label: this.translate.instant('menu.security'), icon: 'pi pi-fw pi-shield', items: securityItems });

        this.model = menuItems;
    }
}
