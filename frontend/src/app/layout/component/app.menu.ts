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
        const menuItems: MenuItem[] = [
            {
                label: this.translate.instant('home'),
                items: [
                    { label: this.translate.instant('dashboard.title'), icon: 'pi pi-fw pi-home', routerLink: ['/'] },
                    { label: this.translate.instant('menu.activityLog'), icon: 'pi pi-fw pi-history', routerLink: ['/activity-logs'] },
                    { label: this.translate.instant('jobs.title'), icon: 'pi pi-fw pi-list-check', routerLink: ['/jobs'] }
                ]
            },
            {
                label: "ACME",
                items: [
                    {
                        label: this.translate.instant('acmeCa.title'),
                        routerLink: ['/acme-ca'],
                        icon: 'pi pi-fw pi-globe'
                    },
                    {
                        label: this.translate.instant('acmeAccounts.title'),
                        routerLink: ['/acme-accounts'],
                        icon: 'pi pi-fw pi-user-edit'
                    },
                    {
                        label: this.translate.instant('dnsProviders.title'),
                        routerLink: ['/dns-providers'],
                        icon: 'pi pi-fw pi-cloud'
                    },
                    {
                        label: this.translate.instant('sshKeys.title'),
                        routerLink: ['/ssh-keys'],
                        icon: 'pi pi-fw pi-key'
                    },
                    {
                        label: this.translate.instant('scripts.title'),
                        routerLink: ['/post-issue-scripts'],
                        icon: 'pi pi-fw pi-code'
                    },
                    {
                        label: this.translate.instant('certificates.title'),
                        routerLink: ['/certificates'],
                        icon: 'pi pi-fw pi-verified'
                    },
                    {
                        label: this.translate.instant('renewalCalendar.title'),
                        routerLink: ['/renewal-calendar'],
                        icon: 'pi pi-fw pi-calendar'
                    },
                    {
                        label: this.translate.instant('webhooks.title'),
                        routerLink: ['/webhooks'],
                        icon: 'pi pi-fw pi-bolt'
                    }
                ]
            }
        ];

        const securityItems: MenuItem[] = [];

        // Add Security menu only for ADMIN users
        if (this.authService.hasRole('ADMIN')) {
            securityItems.push({
                label: this.translate.instant('menu.authProviders'),
                icon: 'pi pi-fw pi-cloud',
                routerLink: ['/admin/auth-providers']
            });
            securityItems.push({
                label: this.translate.instant('menu.users'),
                icon: 'pi pi-fw pi-users',
                routerLink: ['/admin/users']
            });
            securityItems.push({
                label: this.translate.instant('menu.configExport'),
                icon: 'pi pi-fw pi-file-export',
                routerLink: ['/admin/config-export']
            });
        }

        securityItems.push({
            label: this.translate.instant('menu.swaggerDocs'),
            icon: 'pi pi-fw pi-book',
            url: '/api/v1/docs',
            target: '_blank'
        });

        menuItems.push({
            label: this.translate.instant('menu.security'),
            icon: 'pi pi-fw pi-shield',
            items: securityItems
        });

        this.model = menuItems;
    }
}
