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
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { AdminUserService } from '../../../services/admin-user.service';
import { AuthProviderService } from '../../../services/auth-provider.service';
import { Role, RoleService } from '../../../services/role.service';

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
        
        TooltipModule,
        IconFieldModule,
        InputIconModule
    ],
    templateUrl: './users.html'
})
export class UsersComponent implements OnInit {
    private adminUserService = inject(AdminUserService);
    private authProviderService = inject(AuthProviderService);
    private roleService = inject(RoleService);
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
    roles: Role[] = [];
    roleOptions: { label: string; value: string }[] = [];

    providerOptions: any[] = [];

    userForm: any = {
        username: '',
        email: '',
        password: '',
        authProvider: 'local',
        isActive: true,
        role: null
    };

    ngOnInit() {
        this.loadAuthProviders();
        this.loadRoles();
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
            error: () => {
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
            error: () => { }
        });
    }

    loadRoles() {
        this.roleService.getRoles(0, 0).subscribe({
            next: (response) => {
                this.roles = response.data;
                this.roleOptions = response.data.map(g => ({
                    label: g.name,
                    value: g._id!
                }));
            },
            error: () => { }
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
            error: () => {
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
            authProvider: 'local',
            isActive: true,
            role: null
        };
        this.displayDialog = true;
    }

    showEditDialog(user: any) {
        this.isNewUser = false;
        this.userForm = {
            id: user._id,
            username: user.username,
            email: user.email,
            isActive: user.isActive,
            authProvider: user.authProvider,
            authProviderName: user.authProviderName,
            mfaEnabled: user.mfaEnabled || false,
            role: user.role?._id || user.role || null
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

        // Role is required
        if (!userData.role) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('users.errors.roleRequired')
            });
            this.saving = false;
            return;
        }

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
            // For external auth users, don't send email (managed by provider)
            if (userData.authProvider !== 'local') {
                delete userData.email;
            }
        }

        // For non-MFA supported providers, don't send MFA fields
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

    getRoleName(user: any): string {
        if (!user.role) return '-';
        if (typeof user.role === 'object') return user.role.name || '-';
        const g = this.roles.find(g => g._id === user.role);
        return g?.name || '-';
    }

    getProviderLabel(provider: string, providerName?: string): string {
        if (providerName) {
            return providerName;
        }
        const labels: { [key: string]: string } = {
            'local': 'Local',
            'ldap': 'LDAP',
            'azure-ad': 'Azure AD',
            'oidc': 'OIDC'
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
