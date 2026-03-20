import { ApiToken, ApiTokenService, CreateTokenRequest } from '@/services/api-token.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        CardModule,
        InputTextModule,
        PasswordModule,
        ButtonModule,
        MessageModule,
        
        DialogModule,
        CheckboxModule,
        SelectModule,
        TabsModule,
        TooltipModule,
        TableModule,
        InputNumberModule,
        MultiSelectModule,
        TagModule,
        ConfirmDialogModule,
    ],
    templateUrl: './profile.html'
})
export class ProfileComponent implements OnInit {
    currentPassword: string = '';
    newPassword: string = '';
    confirmPassword: string = '';
    email: string = '';
    preferredLanguage: string = 'en';
    isLoading: boolean = false;
    isLoadingEmail: boolean = false;

    // MFA properties
    mfaEnabled: boolean = false;
    mfaSetupDialog: boolean = false;
    mfaDisableDialog: boolean = false;
    mfaQrCode: string = '';
    mfaSecret: string = '';
    mfaToken: string = '';
    mfaPassword: string = '';
    isLoadingMfa: boolean = false;
    mfaTrustDuration: number = 30;
    isLoadingMfaTrust: boolean = false;
    showTrustedDevicesDialog: boolean = false;
    trustedDevices: any[] = [];

    // Notification properties
    notificationEvents: string[] = [];

    languageOptions = [
        { label: 'English', value: 'en' },
        { label: 'Italiano', value: 'it' }
    ];

    alertTypes: Array<{ value: string; label: string; description: string }> = [
        {
            value: 'certificate_renewed_success',
            label: 'notifications.alertTypes.certificateRenewedSuccess',
            description: 'notifications.alertDescriptions.certificateRenewedSuccess'
        },
        {
            value: 'certificate_renewed_failed',
            label: 'notifications.alertTypes.certificateRenewedFailed',
            description: 'notifications.alertDescriptions.certificateRenewedFailed'
        },
        {
            value: 'certificate_issued_success',
            label: 'notifications.alertTypes.certificateIssuedSuccess',
            description: 'notifications.alertDescriptions.certificateIssuedSuccess'
        },
        {
            value: 'certificate_issued_failed',
            label: 'notifications.alertTypes.certificateIssuedFailed',
            description: 'notifications.alertDescriptions.certificateIssuedFailed'
        },
        {
            value: 'post_script_success',
            label: 'notifications.alertTypes.postScriptSuccess',
            description: 'notifications.alertDescriptions.postScriptSuccess'
        },
        {
            value: 'post_script_failed',
            label: 'notifications.alertTypes.postScriptFailed',
            description: 'notifications.alertDescriptions.postScriptFailed'
        }
    ];

    public authService = inject(AuthService);
    private userService = inject(UserService);
    private messageService = inject(MessageService);
    public translateService = inject(TranslateService);
    private apiTokenService = inject(ApiTokenService);
    private confirmationService = inject(ConfirmationService);

    tokens: ApiToken[] = [];
    loading: boolean = false;

    // Create token dialog
    displayCreateDialog: boolean = false;
    newTokenName: string = '';
    expiresInDays: number | null = null;
    neverExpire: boolean = true;
    creating: boolean = false;

    // Token created dialog
    displayTokenDialog: boolean = false;
    createdToken: string = '';
    createdTokenName: string = '';
    tokenCopied: boolean = false;


    ngOnInit() {
        this.loadUserData();
        this.loadTokens();
    }

    loadUserData(): void {
        this.userService.getCurrentUser().subscribe({
            next: (user: any) => {
                this.email = user.email || '';
                this.mfaEnabled = user.mfaEnabled || false;
                this.mfaTrustDuration = user.mfaTrustDuration || 30;
                this.notificationEvents = user.notificationEvents || [];
                this.preferredLanguage = user.preferredLanguage || 'en';
            },
            error: (error: any) => {
            }
        });
    }

    get currentUser() {
        return this.authService.currentUser();
    }

    get isLocalUser(): boolean {
        return this.currentUser?.authProvider === 'local';
    }

    get isLocalOrLdapUser(): boolean {
        return this.currentUser?.authProvider === 'local' || this.currentUser?.authProvider === 'ldap';
    }

    updateEmail(): void {
        if (!this.email) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant("auth.errors.emailRequired")
            });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.email)) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant("auth.errors.invalidEmailFormat")
            });
            return;
        }

        this.isLoadingEmail = true;
        this.userService.updateEmail(this.email, this.preferredLanguage).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('auth.success.emailUpdated')
                });
                this.isLoadingEmail = false;
            },
            error: (error: any) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant("auth.errors.emailUpdateFailed")
                });
                this.isLoadingEmail = false;
            }
        });
    }

    changePassword(): void {
        if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('auth.errors.allFieldsRequired')
            });
            return;
        }

        if (this.newPassword !== this.confirmPassword) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('auth.errors.passwordsDoNotMatch')
            });
            return;
        }

        if (this.newPassword.length < 6) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('auth.errors.passwordTooShort')
            });
            return;
        }

        this.isLoading = true;

        this.userService.changePassword(this.currentPassword, this.newPassword).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('auth.passwordChangedSuccessfully')
                });
                this.currentPassword = '';
                this.newPassword = '';
                this.confirmPassword = '';
                this.isLoading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant("auth.errors.passwordChangeFailed")
                });
                this.isLoading = false;
            }
        });
    }

    // MFA methods
    startMfaSetup(): void {
        this.isLoadingMfa = true;
        this.userService.setupMFA().subscribe({
            next: (response: any) => {
                this.mfaQrCode = response.qrCode;
                this.mfaSecret = response.secret;
                this.mfaSetupDialog = true;
                this.isLoadingMfa = false;
            },
            error: (error: any) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant("mfa.errors.failed")
                });
                this.isLoadingMfa = false;
            }
        });
    }

    verifyAndEnableMfa(): void {
        if (!this.mfaToken || this.mfaToken.length !== 6) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('mfa.errors.invalid')
            });
            return;
        }

        this.isLoadingMfa = true;
        this.userService.verifyAndEnableMFA(this.mfaToken).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('mfa.success.enabled')
                });
                this.mfaEnabled = true;
                this.mfaSetupDialog = false;
                this.mfaToken = '';
                this.mfaQrCode = '';
                this.mfaSecret = '';
                this.isLoadingMfa = false;
            },
            error: (error: any) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant("mfa.errors.failed")
                });
                this.isLoadingMfa = false;
            }
        });
    }

    openDisableMfaDialog(): void {
        this.mfaDisableDialog = true;
        this.mfaPassword = '';
        this.mfaToken = '';
    }

    disableMfa(): void {
        // For local users, password is required
        if (this.isLocalUser && !this.mfaPassword) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('mfa.errors.passwordRequired')
            });
            return;
        }

        if (!this.mfaToken || this.mfaToken.length !== 6) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('mfa.errors.invalid')
            });
            return;
        }

        this.isLoadingMfa = true;
        this.userService.disableMFA(this.mfaPassword, this.mfaToken).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('mfa.success.disabled')
                });
                this.mfaEnabled = false;
                this.mfaDisableDialog = false;
                this.mfaPassword = '';
                this.mfaToken = '';
                this.isLoadingMfa = false;
            },
            error: (error: any) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant("mfa.errors.disableFailed")
                });
                this.isLoadingMfa = false;
            }
        });
    }

    cancelMfaSetup(): void {
        this.mfaSetupDialog = false;
        this.mfaToken = '';
        this.mfaQrCode = '';
        this.mfaSecret = '';
    }

    cancelMfaDisable(): void {
        this.mfaDisableDialog = false;
        this.mfaPassword = '';
        this.mfaToken = '';
    }

    updateMfaTrustDuration(): void {
        if (this.mfaTrustDuration < 0 || this.mfaTrustDuration > 365) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('mfa.errors.invalidTrustDuration')
            });
            return;
        }

        this.isLoadingMfaTrust = true;
        this.userService.updateMfaTrustDuration(this.mfaTrustDuration).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('mfa.success.trustDurationUpdated')
                });
                this.isLoadingMfaTrust = false;
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('profile.errors.updateFailed')
                });
                this.isLoadingMfaTrust = false;
            }
        });
    }

    loadTrustedDevices(): void {
        this.userService.getTrustedDevices().subscribe({
            next: (devices) => {
                this.trustedDevices = devices;
                this.showTrustedDevicesDialog = true;
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('mfa.errors.loadTrustedDevicesFailed')
                });
            }
        });
    }

    revokeTrustedDevice(deviceId: string): void {
        this.confirmationService.confirm({
            message: this.translateService.instant('mfa.confirmRevoke'),
            header: this.translateService.instant('common.confirm'),
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.userService.revokeTrustedDevice(deviceId).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('mfa.success.revoked')
                        });
                        this.loadTrustedDevices();
                    },
                    error: () => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: this.translateService.instant('mfa.errors.revokeFailed')
                        });
                    }
                });
            }
        });
    }

    revokeAllTrustedDevices(): void {
        this.confirmationService.confirm({
            message: this.translateService.instant('mfa.confirmRevokeAll'),
            header: this.translateService.instant('common.confirm'),
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.userService.revokeAllTrustedDevices().subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('mfa.success.revokedAll')
                        });
                        this.trustedDevices = [];
                        this.showTrustedDevicesDialog = false;
                    },
                    error: () => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: this.translateService.instant('mfa.errors.revokeFailed')
                        });
                    }
                });
            }
        });
    }

    // Notification methods
    toggleNotificationEvent(eventType: string, enabled: boolean): void {
        if (enabled) {
            if (!this.notificationEvents.includes(eventType)) {
                this.notificationEvents.push(eventType);
            }
        } else {
            this.notificationEvents = this.notificationEvents.filter(e => e !== eventType);
        }
    }

    saveNotificationSettings(): void {
        this.userService.updateNotificationEvents(this.notificationEvents).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('notifications.settingsSaved')
                });
            },
            error: (err: any) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: err.error?.message || this.translateService.instant('notifications.errors.saveFailed')
                });
            }
        });
    }

    loadTokens() {
        this.loading = true;
        this.apiTokenService.getTokens().subscribe({
            next: (tokens) => {
                this.tokens = tokens;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant("apiTokens.errors.loadFailed")
                });
                this.loading = false;
            }
        });
    }

    deleteToken(token: ApiToken) {
        this.confirmationService.confirm({
            message: this.translateService.instant("apiTokens.confirmDelete", { name: token.name }),
            header: this.translateService.instant("common.confirmDelete"),
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () => {
                this.apiTokenService.deleteToken(token._id).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant("apiTokens.success.deleted")
                        });
                        this.loadTokens();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant("apiTokens.errors.deleteFailed")
                        });
                    }
                });
            }
        });
    }

    getExpiryStatus(token: ApiToken): string {
        if (!token.expiresAt) return 'never';

        const now = new Date();
        const expiry = new Date(token.expiresAt);
        const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) return 'expired';
        if (daysUntilExpiry <= 7) return 'expiring-soon';
        if (daysUntilExpiry <= 30) return 'expiring';
        return 'active';
    }

    getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' {
        switch (status) {
            case 'never':
            case 'active':
                return 'success';
            case 'expiring':
                return 'info';
            case 'expiring-soon':
                return 'warn';
            case 'expired':
                return 'danger';
            default:
                return 'info';
        }
    }

    showCreateDialog() {
        this.newTokenName = '';
        this.expiresInDays = null;
        this.neverExpire = true;
        this.displayCreateDialog = true;
    }

    onNeverExpireChange() {
        if (this.neverExpire) {
            this.expiresInDays = null;
        } else {
            this.expiresInDays = 365; // Default to 1 year
        }
    }

    createToken() {
        if (!this.newTokenName || this.newTokenName.trim() === '') {
            this.messageService.add({
                severity: 'warn',
                summary: this.translateService.instant('common.warning'),
                detail: this.translateService.instant("apiTokens.errors.nameRequired")
            });
            return;
        }

        this.creating = true;

        const request: CreateTokenRequest = {
            name: this.newTokenName.trim(),
            expiresInDays: this.neverExpire ? undefined : (this.expiresInDays || undefined)
        };

        this.apiTokenService.createToken(request).subscribe({
            next: (response) => {
                this.creating = false;
                this.displayCreateDialog = false;

                // Show the created token
                this.createdToken = response.token;
                this.createdTokenName = response.name;
                this.tokenCopied = false;
                this.displayTokenDialog = true;

                // Reload tokens list
                this.loadTokens();

                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant("apiTokens.tokenCreated")
                });
            },
            error: (error) => {
                this.creating = false;
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant("apiTokens.errors.createFailed")
                });
            }
        });
    }

    copyToken() {
        navigator.clipboard.writeText(this.createdToken).then(() => {
            this.tokenCopied = true;
            this.messageService.add({
                severity: 'success',
                summary: this.translateService.instant("common.copied"),
                detail: this.translateService.instant("apiTokens.success.copied"),
                life: 2000
            });
        }).catch(err => {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant("apiTokens.errors.copyFailed")
            });
        });
    }

    closeTokenDialog() {
        this.displayTokenDialog = false;
        this.createdToken = '';
        this.createdTokenName = '';
        this.tokenCopied = false;
    }
}
