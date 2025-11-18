import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { certManagerGuard } from './guards/cert-manager.guard';
import { AppLayout } from './layout/component/app.layout';
import { AcmeAccountsComponent } from './pages/acme-accounts/acme-accounts';
import { AcmeCaComponent } from './pages/acme-ca/acme-ca';
import { ActivityLogComponent } from './pages/activity-log/activity-log';
import { AuthProvidersComponent } from './pages/admin/auth-providers/auth-providers';
import { UsersComponent } from './pages/admin/users/users';
import { CertificatesComponent } from './pages/certificates/certificates';
import { Dashboard } from './pages/dashboard/dashboard';
import { DnsProvidersComponent } from './pages/dns-providers/dns-providers';
import { Notfound } from './pages/notfound/notfound';
import { PostIssueScriptsComponent } from './pages/post-issue-scripts/post-issue-scripts.module';
import { ProfileComponent } from './pages/profile/profile';
import { RenewalCalendarComponent } from './pages/renewal-calendar/renewal-calendar';
import { SshKeysComponent } from './pages/ssh-keys/ssh-keys';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            { path: '', component: Dashboard },
            { path: 'profile', component: ProfileComponent },
            { path: 'activity-logs', component: ActivityLogComponent },
            { path: 'acme-ca', component: AcmeCaComponent, canActivate: [certManagerGuard] },
            { path: 'acme-accounts', component: AcmeAccountsComponent, canActivate: [certManagerGuard] },
            { path: 'dns-providers', component: DnsProvidersComponent, canActivate: [certManagerGuard] },
            { path: 'certificates', component: CertificatesComponent, canActivate: [certManagerGuard] },
            { path: 'post-issue-scripts', component: PostIssueScriptsComponent, canActivate: [certManagerGuard] },
            { path: 'ssh-keys', component: SshKeysComponent, canActivate: [certManagerGuard] },
            { path: 'renewal-calendar', component: RenewalCalendarComponent, canActivate: [certManagerGuard] },
            { path: 'admin/auth-providers', component: AuthProvidersComponent, canActivate: [adminGuard] },
            { path: 'admin/users', component: UsersComponent, canActivate: [adminGuard] },
            { path: 'pages', loadChildren: () => import('./pages/pages.routes') }
        ]
    },
    { path: 'notfound', component: Notfound },
    { path: 'auth', loadChildren: () => import('./pages/auth/auth.routes') },
    { path: '**', redirectTo: '/notfound' }
];
