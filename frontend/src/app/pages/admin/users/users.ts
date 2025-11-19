import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { AdminUserService } from '../../../services/admin-user.service';
import { AuthProviderService } from '../../../services/auth-provider.service';

@Component({
    selector: 'app-users',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        ButtonModule,
        TableModule,
        DialogModule,
        InputTextModule,
        MessageModule,
        PasswordModule,
        ToggleSwitchModule,
        SelectModule,
        TagModule,
        ConfirmDialogModule,
        ToastModule,
        TooltipModule,
        IconFieldModule,
        InputIconModule
    ],
    templateUrl: './users.html'
})
export class UsersComponent implements OnInit {
    private adminUserService = inject(AdminUserService);
    private authProviderService = inject(AuthProviderService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private translateService = inject(TranslateService);

    users: any[] = [];
    totalRecords = 0;
    displayDialog = false;
    isNewUser = false;
    loading = false;
    saving = false;
    authProviders: any[] = [];

    roleOptions = [
        { label: this.translateService.instant('users.roles.admin'), value: 'ADMIN' },
        { label: this.translateService.instant('users.roles.certManager'), value: 'CERT_MANAGER' },
        { label: this.translateService.instant('users.roles.readOnly'), value: 'READ_ONLY' }
    ];

    providerOptions: any[] = [];

    userForm: any = {
        username: '',
        email: '',
        password: '',
        role: 'CERT_MANAGER',
        authProvider: 'local',
        isActive: true
    };

    ngOnInit() {
        this.loadAuthProviders();

        this.translateService.onLangChange.subscribe(() => {
            this.roleOptions = [
                { label: this.translateService.instant('users.roles.admin'), value: 'ADMIN' },
                { label: this.translateService.instant('users.roles.certManager'), value: 'CERT_MANAGER' },
                { label: this.translateService.instant('users.roles.readOnly'), value: 'READ_ONLY' }
            ];
        });
    }

    onLazyLoad(event: any) {
        this.loading = true;

        const page = event.first / event.rows;
        const limit = event.rows;
        const sortField = event.sortField || 'createdAt';
        const sortOrder = event.sortOrder || -1;

        const filters: any = {};
        if (event.filters) {
            Object.keys(event.filters).forEach(field => {
                const filterData = event.filters[field];
                if (filterData) {
                    if (Array.isArray(filterData)) {
                        const constraints = filterData
                            .filter(f => f && f.value !== null && f.value !== undefined && f.value !== '')
                            .map(f => ({
                                value: f.value,
                                matchMode: f.matchMode || 'contains'
                            }));
                        if (constraints.length > 0) {
                            filters[field] = {
                                operator: filterData[0]?.operator || 'and',
                                constraints
                            };
                        }
                    } else if (filterData.value !== null && filterData.value !== undefined && filterData.value !== '') {
                        filters[field] = {
                            operator: filterData.operator || 'and',
                            constraints: [{
                                value: filterData.value,
                                matchMode: filterData.matchMode || 'contains'
                            }]
                        };
                    } else if (filterData.constraints) {
                        const constraints = filterData.constraints
                            .filter((f: any) => f && f.value !== null && f.value !== undefined && f.value !== '')
                            .map((f: any) => ({
                                value: f.value,
                                matchMode: f.matchMode || 'contains'
                            }));
                        if (constraints.length > 0) {
                            filters[field] = {
                                operator: filterData.operator || 'and',
                                constraints
                            };
                        }
                    }
                }
            });
        }

        this.adminUserService.getUsers(page, limit, sortField, sortOrder, filters).subscribe({
            next: (response) => {
                this.users = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('users.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    loadAuthProviders() {
        this.authProviderService.getAllProviders(0, 100).subscribe({
            next: (response) => {
                this.authProviders = response.data;
                this.providerOptions = response.data.map((p: any) => ({
                    label: p.name,
                    value: p.type
                }));
            },
            error: (error) => {
            }
        });
    }

    loadUsers() {
        this.loading = true;
        this.adminUserService.getUsers(0, 10).subscribe({
            next: (response) => {
                this.users = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('users.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    showCreateDialog() {
        this.isNewUser = true;
        this.userForm = {
            username: '',
            email: '',
            password: '',
            role: 'CERT_MANAGER',
            authProvider: 'local',
            isActive: true
        };
        this.displayDialog = true;
    }

    showEditDialog(user: any) {
        this.isNewUser = false;
        this.userForm = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            mfaEnabled: user.mfaEnabled || false
        };
        this.displayDialog = true;
    }

    hideDialog() {
        this.displayDialog = false;
    }

    saveUser() {
        this.saving = true;

        // Prepare user data
        const userData = { ...this.userForm };

        // Validation for new users
        if (this.isNewUser) {
            // Password is required only for local users
            if (userData.authProvider === 'local' && !userData.password) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('users.errors.passwordRequired')
                });
                this.saving = false;
                return;
            }

            // Remove password for external auth users
            if (userData.authProvider !== 'local') {
                delete userData.password;
            }
        } else {
            // For external auth users (except LDAP), don't send email (managed by provider)
            if (userData.authProvider !== 'local') {
                delete userData.email;
            }
        }

        // For non-MFA supported providers (OAuth2, Azure AD, OIDC, SAML), don't send MFA fields
        const mfaSupportedProviders = ['local', 'ldap'];
        if (!this.isNewUser && !mfaSupportedProviders.includes(userData.authProvider)) {
            delete userData.mfaEnabled;
            delete userData.mfaSecret;
        }

        const operation = this.isNewUser
            ? this.adminUserService.createUser(userData)
            : this.adminUserService.updateUser(userData.id, userData);

        operation.subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant(this.isNewUser ? 'users.success.created' : 'users.success.updated')
                });
                this.hideDialog();
                this.loadUsers();
                this.saving = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant('users.errors.saveFailed')
                });
                this.saving = false;
            }
        });
    }

    deleteUser(user: any) {
        this.confirmationService.confirm({
            message: this.translateService.instant('users.confirmDelete'),
            header: this.translateService.instant('common.confirmDelete'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.adminUserService.deleteUser(user._id).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('users.success.deleted')
                        });
                        this.loadUsers();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('users.errors.deleteFailed')
                        });
                    }
                });
            }
        });
    }

    getRoleLabel(role: string): string {
        return this.roleOptions.find(r => r.value === role)?.label || role;
    }

    getProviderLabel(provider: string, providerName?: string): string {
        if (providerName) {
            return providerName;
        }
        const labels: { [key: string]: string } = {
            'local': 'Local',
            'ldap': 'LDAP',
            'oauth2': 'OAuth2',
            'azure-ad': 'Azure AD',
            'oidc': 'OIDC',
            'saml': 'SAML'
        };
        return labels[provider] || provider;
    }

    isInternalProvider(provider: string): boolean {
        return provider === 'local' || provider === 'ldap';
    }

    disableMfaForUser(user: any): void {
        this.confirmationService.confirm({
            message: this.translateService.instant('mfa.confirmDisable'),
            header: this.translateService.instant('mfa.disable'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                // Update user to disable MFA
                this.adminUserService.updateUser(user._id, { mfaEnabled: false }).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('mfa.success.disabled')
                        });
                        this.loadUsers();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('mfa.errors.disableFailed')
                        });
                    }
                });
            }
        });
    }

    disableMfa(): void {
        this.confirmationService.confirm({
            message: this.translateService.instant('mfa.confirmDisable'),
            header: this.translateService.instant('mfa.disable'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.userForm.mfaEnabled = false;
                this.userForm.mfaSecret = null;
            }
        });
    }

    onAuthProviderChange(): void {
        // Clear password when switching to external auth
        if (this.userForm.authProvider !== 'local') {
            this.userForm.password = '';
        }
    }
}