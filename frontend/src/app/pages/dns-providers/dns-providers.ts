import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
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
import { MultiSelectModule } from 'primeng/multiselect';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { DnsProvider, DnsProviderService, ProviderTypeMetadata } from '../../services/dns-provider.service';
import { AuthService } from '../../services/auth.service';

// Credential field template interface
interface CredentialField {
    key: string;
    placeholder: string;
    type?: 'text' | 'password' | 'textarea';
    required?: boolean;
    hint?: string;
}

@Component({
    selector: 'app-dns-providers',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        ButtonModule,
        TableModule,
        DialogModule,
        InputTextModule,
        InputNumberModule,
        TextareaModule,
        PasswordModule,
        SelectModule,
        TagModule,
        TooltipModule,
        ConfirmDialogModule,
        
        ToggleSwitchModule,
        IconFieldModule,
        InputIconModule,
        MultiSelectModule
    ],
    templateUrl: './dns-providers.html'
})
export class DnsProvidersComponent implements OnInit {
    private dnsProviderService = inject(DnsProviderService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private translateService = inject(TranslateService);
    private authService = inject(AuthService);

    hasPermission = (resource: string, level: 'read' | 'write') => this.authService.hasPermission(resource, level);

    // Expose Object to template
    Object = Object;
    @ViewChild('dt') table: any;

    providers: DnsProvider[] = [];
    totalRecords = 0;
    displayDialog = false;
    isNewProvider = false;
    loading = false;
    saving = false;
    loadingProviderTypes = false;

    // Available provider types (loaded dynamically from backend)
    availableProviderTypes: { label: string; value: string }[] = [];

    // Provider metadata cache
    private providerMetadataCache: Map<string, ProviderTypeMetadata> = new Map();

    getStatusOptions() {
        return [{ label: this.translateService.instant('common.enabled'), value: true },
        { label: this.translateService.instant('common.disabled'), value: false }];
    }

    // Get credential template for a provider type
    getCredentialTemplate(providerType: string): CredentialField[] {
        const metadata = this.providerMetadataCache.get(providerType);
        if (!metadata) return [];

        // For manual provider, no credentials needed
        if (providerType === 'manual') return [];

        // Generate template from required credentials
        const requiredFields = metadata.requiredCredentials.map((credKey: string) => {
            const template: CredentialField = {
                key: credKey,
                placeholder: this.getPlaceholderForCredential(credKey, providerType),
                type: this.getFieldTypeForCredential(credKey),
                required: true,
                hint: this.getHintForCredential(credKey, providerType)
            };
            return template;
        });

        // Add optional credentials
        const optionalFields = metadata.optionalCredentials.map((credKey: string) => {
            const template: CredentialField = {
                key: credKey,
                placeholder: this.getPlaceholderForCredential(credKey, providerType),
                type: this.getFieldTypeForCredential(credKey),
                required: false,
                hint: this.getHintForCredential(credKey, providerType)
            };
            return template;
        });

        return [...requiredFields, ...optionalFields];
    }

    // Helper to determine field type based on credential key
    private getFieldTypeForCredential(key: string): 'text' | 'password' | 'textarea' {
        if (key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key')) {
            return 'password';
        }
        if (key.toLowerCase().includes('keyfile') ||
            key.toLowerCase().includes('json')) {
            return 'textarea';
        }
        return 'text';
    }

    // Helper to generate placeholder text
    private getPlaceholderForCredential(key: string, providerType: string): string {
        const keyFormatted = key.replace(/([A-Z])/g, ' $1').trim();
        const capitalizedKey = keyFormatted.charAt(0).toUpperCase() + keyFormatted.slice(1);

        if (key === 'endpoint') {
            return providerType === 'ovh' ? 'ovh-eu' : capitalizedKey;
        }
        if (key === 'region') {
            return 'us-east-1';
        }

        return `${capitalizedKey}`;
    }

    // Helper to generate hint text
    private getHintForCredential(key: string, providerType: string): string {
        const hints: Record<string, Record<string, string>> = {
            cloudflare: {
                apiToken: this.translateService.instant('dnsProviders.hints.createApiToken'),
                zoneId: this.translateService.instant('dnsProviders.hints.optionalZoneId')
            },
            namecheap: {
                apiKey: this.translateService.instant('dnsProviders.hints.enableApiAccess'),
                clientIp: this.translateService.instant('dnsProviders.hints.whitelistedIps')
            },
            route53: {
                hostedZoneId: this.translateService.instant('dnsProviders.hints.hostedZoneId'),
                region: this.translateService.instant('dnsProviders.hints.region')
            },
            google: {
                keyFile: this.translateService.instant('dnsProviders.hints.keyFile'),
                managedZone: this.translateService.instant('dnsProviders.hints.managedZone')
            },
            ovh: {
                endpoint: this.translateService.instant('dnsProviders.hints.ovhEndpoint'),
                zoneName: this.translateService.instant('dnsProviders.hints.ovhZoneName')
            }
        };

        return hints[providerType]?.[key] || '';
    }

    providerForm: any = {
        name: '',
        type: 'manual',
        enabled: true,
        description: '',
        dnsPropagationTime: 60,
        credentials: {}
    };

    ngOnInit() {
        this.loadProviderTypes();
    }

    onLazyLoad(event: any) {
        this.loading = true;

        const page = event.first / event.rows;
        const limit = event.rows;
        const sortField = event.sortField || 'name';
        const sortOrder = event.sortOrder || 1;

        // Extract filters from PrimeNG event - same logic as certificates
        const filters: any = {};
        if (event.filters) {
            Object.keys(event.filters).forEach(field => {
                const filterData = event.filters[field];
                if (filterData) {
                    if (Array.isArray(filterData)) {
                        // Multiple filters on same field
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
                        // Single filter
                        filters[field] = {
                            operator: filterData.operator || 'and',
                            constraints: [{
                                value: filterData.value,
                                matchMode: filterData.matchMode || 'contains'
                            }]
                        };
                    } else if (filterData.constraints) {
                        // Filter with constraints array and operator
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

        this.dnsProviderService.getAllProviders(page, limit, sortField, sortOrder, filters).subscribe({
            next: (response) => {
                this.providers = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('dnsProviders.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    loadProviderTypes() {
        this.loadingProviderTypes = true;
        this.dnsProviderService.getAvailableProviderTypes().subscribe({
            next: (types) => {
                // Store provider types for dropdown
                this.availableProviderTypes = types.map(t => ({
                    label: t.label,
                    value: t.type
                }));

                // Cache metadata for credential template generation
                types.forEach(t => {
                    this.providerMetadataCache.set(t.type, t);
                });

                this.loadingProviderTypes = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('dnsProviders.errors.loadTypesFailed')
                });
                this.loadingProviderTypes = false;
            }
        });
    }

    showCreateDialog() {
        this.isNewProvider = true;
        this.providerForm = {
            name: '',
            type: 'manual',
            enabled: true,
            description: '',
            dnsPropagationTime: 60,
            credentials: {}
        };
        this.displayDialog = true;
    }

    showEditDialog(provider: DnsProvider) {
        this.isNewProvider = false;
        this.providerForm = {
            _id: provider._id,
            name: provider.name,
            type: provider.type || 'manual',
            enabled: provider.enabled,
            description: provider.description || '',
            dnsPropagationTime: provider.dnsPropagationTime || 60,
            credentials: { ...(provider.credentials || {}) }
        };

        this.displayDialog = true;
    }

    onProviderTypeChange() {
        // Reset credentials when provider type changes
        this.providerForm.credentials = {};
    }

    getCredentialTemplateForCurrentType(): CredentialField[] {
        return this.getCredentialTemplate(this.providerForm.type);
    }

    saveProvider() {
        if (!this.providerForm.name) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('dnsProviders.errors.failedToValidate')
            });
            return;
        }

        // Validate required credentials
        const template = this.getCredentialTemplateForCurrentType();
        const missingFields = template
            .filter((field: CredentialField) => field.required && !this.providerForm.credentials[field.key])
            .map((field: CredentialField) => field.key);

        if (missingFields.length > 0) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('dnsProviders.errors.missingRequiredFields') + ': ' + missingFields.join(', ')
            });
            return;
        }

        this.saving = true;
        const providerData = {
            name: this.providerForm.name,
            type: this.providerForm.type || 'manual',
            enabled: this.providerForm.enabled,
            description: this.providerForm.description || undefined,
            dnsPropagationTime: this.providerForm.dnsPropagationTime || 60,
            credentials: this.providerForm.credentials
        };

        if (this.isNewProvider) {
            this.dnsProviderService.createProvider(providerData).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('dnsProviders.success.created')
                    });
                    this.displayDialog = false;
                    this.reloadTableData();
                    this.saving = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('dnsProviders.errors.failedToCreate')
                    });
                    this.saving = false;
                }
            });
        } else {
            this.dnsProviderService.updateProvider(this.providerForm._id, providerData).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('dnsProviders.success.updated')
                    });
                    this.displayDialog = false;
                    this.reloadTableData();
                    this.saving = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('dnsProviders.errors.failedToUpdate')
                    });
                    this.saving = false;
                }
            });
        }
    }

    deleteProvider(provider: DnsProvider) {
        this.confirmationService.confirm({
            message: this.translateService.instant('dnsProviders.confirmDelete', { name: provider.name }),
            header: this.translateService.instant('common.confirm'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.dnsProviderService.deleteProvider(provider._id!).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('dnsProviders.success.deleted')
                        });
                        this.reloadTableData();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('dnsProviders.errors.failedToDelete')
                        });
                    }
                });
            }
        });
    }

    testProvider(provider: DnsProvider) {
        this.saving = true;
        this.dnsProviderService.testProvider(provider._id!).subscribe({
            next: (result) => {
                this.messageService.add({
                    severity: result.success ? 'success' : 'error',
                    summary: result.success ? this.translateService.instant('common.success') : this.translateService.instant('common.error'),
                    detail: result.message,
                    life: 5000
                });
                this.saving = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant('dnsProviders.errors.testFailed')
                });
                this.saving = false;
            }
        });
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
