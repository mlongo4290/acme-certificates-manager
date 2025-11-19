import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { environment } from '../../../../environments/environment';
import { AuthProvider, AuthProviderService } from '../../../services/auth-provider.service';

@Component({
    selector: 'app-auth-providers',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        TableModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        ToggleSwitchModule,
        SelectModule,
        InputNumberModule,
        PasswordModule,
        MessageModule,
        MenuModule,
        ConfirmDialogModule,
        ToastModule,
        TextareaModule,
        InputIconModule,
        IconFieldModule,
        MultiSelectModule,
        TagModule
    ],
    templateUrl: './auth-providers.html'
})
export class AuthProvidersComponent {
    private translateService = inject(TranslateService);
    private authProviderService = inject(AuthProviderService);
    private confirmationService = inject(ConfirmationService);
    private messageService = inject(MessageService);

    @ViewChild('dt') table: any;

    providers: AuthProvider[] = [];
    totalRecords = 0;
    displayDialog: boolean = false;
    selectedProvider: AuthProvider | null = null;
    isNewProvider: boolean = false;
    loading: boolean = false;

    providerTypes = [
        { label: 'Local', value: 'local' },
        { label: 'LDAP', value: 'ldap' },
        { label: 'OAuth2', value: 'oauth2' },
        { label: 'Azure AD', value: 'azure-ad' },
        { label: 'OIDC', value: 'oidc' },
        { label: 'SAML', value: 'saml' }
    ];

    createProviderMenuItems = [
        {
            label: 'LDAP',
            icon: 'pi pi-shield',
            command: () => this.showCreateDialog('ldap')
        },
        {
            label: 'OAuth2',
            icon: 'pi pi-external-link',
            command: () => this.showCreateDialog('oauth2')
        },
        {
            label: 'Azure AD',
            icon: 'pi pi-microsoft',
            command: () => this.showCreateDialog('azure-ad')
        },
        {
            label: 'OIDC',
            icon: 'pi pi-id-card',
            command: () => this.showCreateDialog('oidc')
        },
        {
            label: 'SAML',
            icon: 'pi pi-key',
            command: () => this.showCreateDialog('saml')
        }
    ];

    // Form model
    providerForm: Partial<AuthProvider> = {
        name: '',
        type: 'local',
        enabled: true,
        priority: 0,
        settings: {}
    };

    onLazyLoad(event: any) {
        this.loading = true;

        const page = event.first / event.rows;
        const limit = event.rows;
        const sortField = event.sortField || 'priority';
        const sortOrder = event.sortOrder || 1;

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

        this.authProviderService.getAllProviders(page, limit, sortField, sortOrder, filters).subscribe({
            next: (response) => {
                this.providers = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('authProviders.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    showCreateDialog(providerType: 'local' | 'ldap' | 'oauth2' | 'azure-ad' | 'oidc' | 'saml' = 'local'): void {
        this.isNewProvider = true;
        this.providerForm = {
            name: '',
            type: providerType,
            enabled: true,
            priority: 0,
            settings: {
                ldap: {
                    servers: [''],
                    bindDN: '',
                    bindCredentials: '',
                    searchBase: '',
                    searchFilter: '(uid={{username}})',
                    usernameField: 'uid',
                    tlsRejectUnauthorized: true,
                    tlsCaCert: ''
                },
                oauth2: {
                    authorizationURL: '',
                    tokenURL: '',
                    clientID: '',
                    clientSecret: '',
                    callbackURL: '',
                    userInfoURL: '',
                    scopes: ['openid', 'profile', 'email']
                },
                azureAd: {
                    tenantID: '',
                    clientID: '',
                    clientSecret: '',
                    callbackURL: ''
                },
                oidc: {
                    issuerURL: '',
                    clientID: '',
                    clientSecret: '',
                    callbackURL: '',
                    scopes: ['openid', 'profile', 'email']
                },
                saml: {
                    entryPoint: '',
                    issuer: '',
                    callbackURL: '',
                    cert: '',
                    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
                    signatureAlgorithm: 'sha256',
                    wantAssertionsSigned: true
                }
            }
        };
        this.updateCallbackURL();
        this.displayDialog = true;
    }

    showEditDialog(provider: AuthProvider): void {
        this.isNewProvider = false;
        this.selectedProvider = provider;
        // Deep clone per evitare modifiche all'oggetto originale
        this.providerForm = JSON.parse(JSON.stringify(provider));
        // Inizializza settings se non esiste
        if (!this.providerForm.settings) {
            this.providerForm.settings = {};
        }

        // Inizializza settings.ldap
        if (!this.providerForm.settings.ldap) {
            this.providerForm.settings.ldap = {
                servers: [''],
                bindDN: '',
                bindCredentials: '',
                searchBase: '',
                searchFilter: '(uid={{username}})',
                usernameField: 'uid',
                tlsRejectUnauthorized: true,
                tlsCaCert: ''
            };
        }
        // Assicurati che servers sia un array
        if (!this.providerForm.settings.ldap.servers || this.providerForm.settings.ldap.servers.length === 0) {
            this.providerForm.settings.ldap.servers = [''];
        }
        // Assicurati che tlsRejectUnauthorized abbia un valore di default
        if (this.providerForm.settings.ldap.tlsRejectUnauthorized === undefined) {
            this.providerForm.settings.ldap.tlsRejectUnauthorized = true;
        }
        // Assicurati che tlsCaCert abbia un valore di default
        if (this.providerForm.settings.ldap.tlsCaCert === undefined) {
            this.providerForm.settings.ldap.tlsCaCert = '';
        }

        // Inizializza settings.oauth2
        if (!this.providerForm.settings.oauth2) {
            this.providerForm.settings.oauth2 = {
                authorizationURL: '',
                tokenURL: '',
                clientID: '',
                clientSecret: '',
                callbackURL: '',
                userInfoURL: '',
                scopes: ['openid', 'profile', 'email']
            };
        }
        // Assicurati che scopes sia un array
        if (!this.providerForm.settings.oauth2.scopes || this.providerForm.settings.oauth2.scopes.length === 0) {
            this.providerForm.settings.oauth2.scopes = ['openid', 'profile', 'email'];
        }

        // Inizializza settings.azureAd
        if (!this.providerForm.settings.azureAd) {
            this.providerForm.settings.azureAd = {
                tenantID: '',
                clientID: '',
                clientSecret: '',
                callbackURL: ''
            };
        }

        // Inizializza settings.oidc
        if (!this.providerForm.settings.oidc) {
            this.providerForm.settings.oidc = {
                issuerURL: '',
                clientID: '',
                clientSecret: '',
                callbackURL: '',
                scopes: ['openid', 'profile', 'email']
            };
        }
        // Assicurati che scopes sia un array
        if (!this.providerForm.settings.oidc.scopes || this.providerForm.settings.oidc.scopes.length === 0) {
            this.providerForm.settings.oidc.scopes = ['openid', 'profile', 'email'];
        }

        // Inizializza settings.saml
        if (!this.providerForm.settings.saml) {
            this.providerForm.settings.saml = {
                entryPoint: '',
                issuer: '',
                callbackURL: '',
                cert: '',
                identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
                signatureAlgorithm: 'sha256',
                wantAssertionsSigned: true
            };
        }

        this.updateCallbackURL();
        this.displayDialog = true;
    }

    hideDialog(): void {
        this.displayDialog = false;
        this.selectedProvider = null;
    }

    saveProvider(): void {
        if (!this.providerForm.name || !this.providerForm.type) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translateService.instant('common.warning'),
                detail: this.translateService.instant('authProviders.errors.missingRequiredFields')
            });
            return;
        }

        this.loading = true;

        if (this.isNewProvider) {
            this.authProviderService.createProvider(this.providerForm as AuthProvider).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('authProviders.success.created')
                    });
                    this.reloadTableData();
                    this.hideDialog();
                    this.loading = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('authProviders.errors.creationFailed')
                    });
                    this.loading = false;
                }
            });
        } else if (this.selectedProvider) {
            this.authProviderService.updateProvider(this.selectedProvider._id!, this.providerForm).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('authProviders.success.updated')
                    });
                    this.reloadTableData();
                    this.hideDialog();
                    this.loading = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('authProviders.errors.updateFailed')
                    });
                    this.loading = false;
                }
            });
        }
    }

    deleteProvider(provider: AuthProvider): void {
        this.confirmationService.confirm({
            message: this.translateService.instant('authProviders.confirmDelete', { name: provider.name }),
            header: this.translateService.instant('common.confirmDelete'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.authProviderService.deleteProvider(provider._id!).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('authProviders.success.deleted')
                        });
                        this.reloadTableData();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('authProviders.errors.deleteFailed')
                        });
                    }
                });
            }
        });
    }

    getProviderTypeLabel(type: string): string {
        const providerType = this.providerTypes.find(pt => pt.value === type);
        return providerType ? providerType.label : type;
    }

    // LDAP servers management
    addLdapServer(): void {
        if (!this.providerForm.settings?.ldap?.servers) {
            if (!this.providerForm.settings) this.providerForm.settings = {};
            if (!this.providerForm.settings.ldap) this.providerForm.settings.ldap = {};
            this.providerForm.settings.ldap.servers = [];
        }
        this.providerForm.settings.ldap.servers.push('');
    }

    removeLdapServer(index: number): void {
        if (this.providerForm.settings?.ldap?.servers && this.providerForm.settings.ldap.servers.length > 1) {
            this.providerForm.settings.ldap.servers.splice(index, 1);
        }
    }

    // OAuth2 scopes management
    addOAuth2Scope(): void {
        if (!this.providerForm.settings?.oauth2?.scopes) {
            if (!this.providerForm.settings) this.providerForm.settings = {};
            if (!this.providerForm.settings.oauth2) this.providerForm.settings.oauth2 = {};
            this.providerForm.settings.oauth2.scopes = [];
        }
        this.providerForm.settings.oauth2.scopes.push('');
    }

    removeOAuth2Scope(index: number): void {
        if (this.providerForm.settings?.oauth2?.scopes && this.providerForm.settings.oauth2.scopes.length > 1) {
            this.providerForm.settings.oauth2.scopes.splice(index, 1);
        }
    }

    // OIDC scopes management
    addOIDCScope(): void {
        if (!this.providerForm.settings?.oidc?.scopes) {
            if (!this.providerForm.settings) this.providerForm.settings = {};
            if (!this.providerForm.settings.oidc) this.providerForm.settings.oidc = {};
            this.providerForm.settings.oidc.scopes = [];
        }
        this.providerForm.settings.oidc.scopes.push('');
    }

    removeOIDCScope(index: number): void {
        if (this.providerForm.settings?.oidc?.scopes && this.providerForm.settings.oidc.scopes.length > 1) {
            this.providerForm.settings.oidc.scopes.splice(index, 1);
        }
    }

    // SAML dropdown options
    samlIdentifierFormats = [
        { label: 'Email Address', value: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' },
        { label: 'Unspecified', value: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified' },
        { label: 'X509 Subject Name', value: 'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName' },
        { label: 'Windows Domain Qualified Name', value: 'urn:oasis:names:tc:SAML:1.1:nameid-format:WindowsDomainQualifiedName' },
        { label: 'Persistent', value: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent' },
        { label: 'Transient', value: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient' }
    ];

    samlSignatureAlgorithms = [
        { label: 'SHA-1', value: 'sha1' },
        { label: 'SHA-256', value: 'sha256' },
        { label: 'SHA-512', value: 'sha512' }
    ];

    trackByIndex(index: number): number {
        return index;
    }

    // Generate slug from provider name
    generateSlug(name: string): string {
        if (!name) return '';
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    // Get computed slug (read-only preview)
    get computedSlug(): string {
        return this.generateSlug(this.providerForm.name || '');
    }

    // Update callback URL automatically based on provider type and computed slug
    updateCallbackURL(): void {
        const slug = this.computedSlug;
        if (!slug) return;

        // Use window.location.origin to get the base URL (works with reverse proxy)
        const baseUrl = window.location.origin;

        if (this.providerForm.type === 'azure-ad' && this.providerForm.settings?.azureAd) {
            this.providerForm.settings.azureAd.callbackURL = `${baseUrl}${environment.apiUrl}/auth/azure-ad/${slug}/callback`;
        } else if (this.providerForm.type === 'oauth2' && this.providerForm.settings?.oauth2) {
            this.providerForm.settings.oauth2.callbackURL = `${baseUrl}${environment.apiUrl}/auth/oauth2/${slug}/callback`;
        } else if (this.providerForm.type === 'oidc' && this.providerForm.settings?.oidc) {
            this.providerForm.settings.oidc.callbackURL = `${baseUrl}${environment.apiUrl}/auth/oidc/${slug}/callback`;
        } else if (this.providerForm.type === 'saml' && this.providerForm.settings?.saml) {
            this.providerForm.settings.saml.callbackURL = `${baseUrl}${environment.apiUrl}/auth/saml/${slug}/callback`;
        }
    }

    // Called when provider name or type changes
    onProviderNameOrTypeChange(): void {
        this.updateCallbackURL();
    }

    reloadTableData() {
        if (this.table) {
            // Get current lazy load event state from table
            const lazyLoadEvent = this.table.createLazyLoadMetadata();
            // Trigger lazy load with current state
            this.onLazyLoad(lazyLoadEvent);
        }
    }
}

