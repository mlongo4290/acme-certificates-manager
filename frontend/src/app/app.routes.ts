import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { permissionGuard } from './guards/permission.guard';
import { AppLayout } from './layout/component/app.layout';
import { AcmeAccountsComponent } from './pages/acme-accounts/acme-accounts';
import { AcmeCaComponent } from './pages/acme-ca/acme-ca';
import { ActivityLogComponent } from './pages/activity-log/activity-log';
import { AuthProvidersComponent } from './pages/admin/auth-providers/auth-providers';
import { RolesComponent } from './pages/admin/roles/roles';
import { UsersComponent } from './pages/admin/users/users';
import { CertificatesComponent } from './pages/certificates/certificates';
import { Dashboard } from './pages/dashboard/dashboard';
import { DnsProvidersComponent } from './pages/dns-providers/dns-providers';
import { Notfound } from './pages/notfound/notfound';
import { PostIssueScriptsComponent } from './pages/post-issue-scripts/post-issue-scripts.module';
import { ProfileComponent } from './pages/profile/profile';
import { RenewalCalendarComponent } from './pages/renewal-calendar/renewal-calendar';
import { SshKeysComponent } from './pages/ssh-keys/ssh-keys';
import { WebhooksComponent } from './pages/webhooks/webhooks';
import { ConfigExportComponent } from './pages/config-export/config-export';
import { JobsComponent } from './pages/jobs/jobs';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            { path: '', component: Dashboard },
            { path: 'profile', component: ProfileComponent },
            { path: 'activity-logs', component: ActivityLogComponent, canActivate: [permissionGuard], data: { resource: 'activityLogs', level: 'read' } },
            { path: 'acme-ca', component: AcmeCaComponent, canActivate: [permissionGuard], data: { resource: 'acmeCa', level: 'read' } },
            { path: 'acme-accounts', component: AcmeAccountsComponent, canActivate: [permissionGuard], data: { resource: 'acmeAccounts', level: 'read' } },
            { path: 'dns-providers', component: DnsProvidersComponent, canActivate: [permissionGuard], data: { resource: 'dnsProviders', level: 'read' } },
            { path: 'certificates', component: CertificatesComponent, canActivate: [permissionGuard], data: { resource: 'certificates', level: 'read' } },
            { path: 'post-issue-scripts', component: PostIssueScriptsComponent, canActivate: [permissionGuard], data: { resource: 'scripts', level: 'read' } },
            { path: 'ssh-keys', component: SshKeysComponent, canActivate: [permissionGuard], data: { resource: 'sshKeys', level: 'read' } },
            { path: 'renewal-calendar', component: RenewalCalendarComponent, canActivate: [permissionGuard], data: { resource: 'renewalCalendar', level: 'read' } },
            { path: 'webhooks', component: WebhooksComponent, canActivate: [permissionGuard], data: { resource: 'webhooks', level: 'read' } },
            { path: 'jobs', component: JobsComponent, canActivate: [permissionGuard], data: { resource: 'jobs', level: 'read' } },
            { path: 'admin/auth-providers', component: AuthProvidersComponent, canActivate: [adminGuard] },
            { path: 'admin/users', component: UsersComponent, canActivate: [adminGuard] },
            { path: 'admin/roles', component: RolesComponent, canActivate: [adminGuard] },
            { path: 'admin/config-export', component: ConfigExportComponent, canActivate: [adminGuard] },
            { path: 'pages', loadChildren: () => import('./pages/pages.routes') }
        ]
    },
    { path: 'notfound', component: Notfound },
    { path: 'auth', loadChildren: () => import('./pages/auth/auth.routes') },
    { path: '**', redirectTo: '/notfound' }
];
