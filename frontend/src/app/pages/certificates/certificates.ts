import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { StepperModule } from 'primeng/stepper';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { environment } from '../../../environments/environment';
import { CertificateViewerComponent } from '../../components/certificate-viewer/certificate-viewer.component';
import { AcmeAccountService } from '../../services/acme-account.service';
import { AcmeCaService } from '../../services/acme-ca.service';
import { AuthService } from '../../services/auth.service';
import { Certificate, CertificateService } from '../../services/certificate.service';
import { DnsProviderService } from '../../services/dns-provider.service';
import { PostIssueScriptsService } from '../../services/post-issue-scripts.service';
import { SshKeyService } from '../../services/ssh-key.service';

@Component({
    selector: 'app-certificates',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        ButtonModule,
        TableModule,
        DialogModule,
        InputTextModule,
        TextareaModule,
        SelectModule,
        TagModule,
        TooltipModule,
        ConfirmDialogModule,
        ToastModule,
        ToggleSwitchModule,
        InputNumberModule,
        DatePickerModule,
        SliderModule,
        StepperModule,
        ProgressSpinnerModule,
        MenuModule,
        TabsModule,
        IconFieldModule,
        InputIconModule,
        MultiSelectModule,
        CertificateViewerComponent
    ],
    templateUrl: './certificates.html',
    providers: [MessageService, ConfirmationService]
})
export class CertificatesComponent implements OnInit {
    private certificateService = inject(CertificateService);
    private dnsProviderService = inject(DnsProviderService);
    private acmeCaService = inject(AcmeCaService);
    private acmeAccountService = inject(AcmeAccountService);
    private authService = inject(AuthService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private cdr = inject(ChangeDetectorRef);
    private postIssueScriptsService = inject(PostIssueScriptsService);
    private sshKeyService = inject(SshKeyService);
    public translateService = inject(TranslateService);

    activeStep: number = 1;
    // Expose Math to template
    Math = Math;

    certificates: Certificate[] = [];
    totalRecords = 0;
    displayDialog = false;
    displayProgressDialog = false;
    displayScriptErrorDialog = false;
    scriptErrorDetails: { output?: string; error?: string } = {};
    progressMessages: string[] = [];
    loading = false;
    saving = false;
    activeTabIndex = 0;

    get dateFormat(): string {
        const formatter = new Intl.DateTimeFormat(this.translateService.getCurrentLang(), {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(new Date(2021, 0, 15));
        let format = '';
        for (const part of parts) {
            if (part.type === 'day') format += 'dd';
            else if (part.type === 'month') format += 'mm';
            else if (part.type === 'year') format += 'yy';
            else if (part.type === 'literal') format += part.value;
        }
        return format;
    }

    tabItems = [
        { value: 0, icon: 'pi pi-verified', translationKey: 'certificates.certificateDetails' },
        { value: 1, icon: 'pi pi-refresh', translationKey: 'certificates.autoRenewalSettings' }
    ];

    dnsProviders: any[] = [];
    certificateAuthorities: any[] = [];
    acmeAccounts: any[] = [];
    filteredAccounts: any[] = [];
    postIssueScripts: any[] = [];
    sshKeys: any[] = [];
    selectedScript: any = null;
    downloadMenuItems: any[] = [];
    @ViewChild('downloadMenu') downloadMenu: any;
    @ViewChild('dt') table: any;

    // Certificate viewer dialog
    displayCertificateViewer = false;
    selectedCertificatePem: string | null = null;

    statuses = [
        { label: this.translateService.instant('certificates.status.valid'), value: 'valid' },
        { label: this.translateService.instant('certificates.status.expired'), value: 'expired' },
        { label: this.translateService.instant('certificates.status.pending'), value: 'pending' },
        { label: this.translateService.instant('certificates.status.error'), value: 'error' }
    ]

    challengeTypes = [
        { label: 'HTTP-01', value: 'http-01' },
        { label: 'DNS-01', value: 'dns-01' },
        { label: 'TLS-ALPN-01', value: 'tls-alpn-01' }
    ];

    certificateForm: any = {
        domain: '',
        additionalDomains: [],
        challengeType: 'http-01',
        certificateAuthority: '',
        acmeAccount: '',
        dnsProvider: '',
        autoRenewal: true,
        renewalSchedule: {
            daysBeforeExpiry: 30,
            time: new Date(0, 0, 0, 4, 0), // 04:00 as Date object
            timeShiftMinutes: 60
        },
        postIssueScripts: []
    };

    // Temporary fields for adding domains
    newAdditionalDomain = '';

    // Script management
    selectedScriptToAdd: string | null = null;
    selectedScriptDetails: any = null;

    // Expose Object.keys to template
    objectKeys = Object.keys;

    ngOnInit() {
        this.loadDnsProviders();
        this.loadCertificateAuthorities();
        this.loadAcmeAccounts();
        this.loadPostIssueScripts();
        this.loadSshKeys();

        this.translateService.onLangChange.subscribe(() => {
            this.statuses = [
                { label: this.translateService.instant('certificates.status.valid'), value: 'valid' },
                { label: this.translateService.instant('certificates.status.expired'), value: 'expired' },
                { label: this.translateService.instant('certificates.status.pending'), value: 'pending' },
                { label: this.translateService.instant('certificates.status.error'), value: 'error' }
            ];
        });
    }

    onLazyLoad(event: any) {
        this.loading = true;

        const page = event.first / event.rows;
        const limit = event.rows;
        const sortField = event.sortField || 'createdAt';
        const sortOrder = event.sortOrder || -1;

        // Extract filters from PrimeNG event - same logic as activity-log
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

        this.certificateService.getAllCertificates(page, limit, sortField, sortOrder, filters).subscribe({
            next: (response) => {
                this.certificates = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('certificates.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    /**
     * Reload table data preserving current state (sort, filters, pagination)
     */
    reloadTableData() {
        if (this.table) {
            // Get current lazy load event state from table
            const lazyLoadEvent = this.table.createLazyLoadMetadata();
            // Trigger lazy load with current state
            this.onLazyLoad(lazyLoadEvent);
        }
    }

    showCreateDialog() {
        // Find default CA
        const defaultCa = this.certificateAuthorities.find(ca => ca.isDefault);

        this.certificateForm = {
            domain: '',
            additionalDomains: [],
            challengeType: 'http-01',
            certificateAuthority: defaultCa?.value || '',
            acmeAccount: '',
            dnsProvider: '',
            autoRenewal: true,
            renewalSchedule: {
                daysBeforeExpiry: 30,
                time: new Date(0, 0, 0, 4, 0), // 04:00 as Date object
                timeShiftMinutes: 60
            },
            postIssueScripts: []
        };
        this.newAdditionalDomain = '';
        this.selectedScript = null;
        this.selectedScriptToAdd = null;
        this.selectedScriptDetails = null;

        // Load accounts for the default CA if set
        if (this.certificateForm.certificateAuthority) {
            this.onCertificateAuthorityChange();
        }

        this.activeStep = 1;

        this.displayDialog = true;
    }

    addAdditionalDomain() {
        if (this.newAdditionalDomain && !this.certificateForm.additionalDomains.includes(this.newAdditionalDomain)) {
            this.certificateForm.additionalDomains.push(this.newAdditionalDomain);
            this.newAdditionalDomain = '';
        }
    }

    removeAdditionalDomain(index: number) {
        this.certificateForm.additionalDomains.splice(index, 1);
    }

    showEditDialog(certificate: Certificate) {
        // Convert string time to Date object
        const timeString = certificate.renewalSchedule.time;
        const [hours, minutes] = timeString.split(':').map(Number);
        const timeDate = new Date(0, 0, 0, hours, minutes);

        let postIssueScripts: any[] = [];
        if (certificate.postIssueScripts && certificate.postIssueScripts.length > 0) {
            postIssueScripts = certificate.postIssueScripts.map(ps => ({
                script: typeof ps.script === 'object' && ps.script ? ps.script._id : ps.script,
                vars: { ...ps.vars },
                sshKey: ps.sshKey
            }));
        }

        this.certificateForm = {
            _id: certificate._id,
            domain: certificate.domain,
            additionalDomains: certificate.additionalDomains ? [...certificate.additionalDomains] : [],
            challengeType: certificate.challengeType,
            certificateAuthority: certificate.certificateAuthority || '',
            acmeAccount: certificate.acmeAccount || '',
            dnsProvider: certificate.dnsProvider || '',
            autoRenewal: certificate.autoRenewal,
            renewalSchedule: {
                daysBeforeExpiry: certificate.renewalSchedule.daysBeforeExpiry,
                time: timeDate,
                timeShiftMinutes: certificate.renewalSchedule.timeShiftMinutes
            },
            postIssueScripts: postIssueScripts
        };

        // Load accounts for the selected CA
        this.onCertificateAuthorityChange();

        this.activeStep = 1;
        this.newAdditionalDomain = '';
        this.selectedScriptToAdd = null;
        this.selectedScriptDetails = null;
        this.displayDialog = true;
    }

    saveCertificate() {
        if (!this.certificateForm.domain) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('validationError')
            });
            return;
        }

        // Validate Certificate Authority is set
        if (!this.certificateForm.certificateAuthority) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('certificates.errors.caRequired')
            });
            return;
        }

        // Validate DNS provider is set if challenge type is dns-01
        if (this.certificateForm.challengeType === 'dns-01' && !this.certificateForm.dnsProvider) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('certificates.errors.dnsRequired')
            });
            return;
        }

        this.saving = true;

        // Convert Date object to HH:mm string
        const timeDate = this.certificateForm.renewalSchedule.time;
        const hours = timeDate.getHours().toString().padStart(2, '0');
        const minutes = timeDate.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        const certData = {
            domain: this.certificateForm.domain,
            additionalDomains: this.certificateForm.additionalDomains || [],
            challengeType: this.certificateForm.challengeType,
            certificateAuthority: this.certificateForm.certificateAuthority,
            acmeAccount: this.certificateForm.acmeAccount,
            dnsProvider: this.certificateForm.challengeType === 'dns-01' ? this.certificateForm.dnsProvider : undefined,
            autoRenewal: this.certificateForm.autoRenewal,
            renewalSchedule: {
                daysBeforeExpiry: this.certificateForm.renewalSchedule.daysBeforeExpiry,
                time: timeString,
                timeShiftMinutes: this.certificateForm.renewalSchedule.timeShiftMinutes
            },
            postIssueScripts: (this.certificateForm.postIssueScripts || []).map((ps: any) => ({
                script: ps.script,
                vars: ps.vars,
                sshKey: ps.sshKey || undefined
            }))
        };

        if (!this.certificateForm._id) {
            this.certificateService.createCertificate(certData).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('certificates.success.created')
                    });
                    this.displayDialog = false;
                    this.reloadTableData();
                    this.saving = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('certificates.errors.failedToCreate')
                    });
                    this.saving = false;
                }
            });
        } else {
            this.certificateService.updateCertificate(this.certificateForm._id, certData).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('certificates.success.updated')
                    });
                    this.displayDialog = false;
                    this.reloadTableData();
                    this.saving = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('certificates.errors.updateFailed')
                    });
                    this.saving = false;
                }
            });
        }
    }

    deleteCertificate(certificate: Certificate) {
        this.confirmationService.confirm({
            message: this.translateService.instant('certificates.confirm.delete', { domain: certificate.domain }),
            header: this.translateService.instant('common.confirm'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.certificateService.deleteCertificate(certificate._id!).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('certificates.success.deleted')
                        });
                        this.reloadTableData();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('certificates.errors.deleteFailed')
                        });
                    }
                });
            }
        });
    }

    reissueCertificate(certificate: Certificate) {
        this.confirmationService.confirm({
            message: this.translateService.instant('certificates.reissueConfirm', { domain: certificate.domain }),
            header: this.translateService.instant('certificates.actions.reissue'),
            icon: 'pi pi-file-edit',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.displayProgressDialog = true;
                this.progressMessages = [];
                this.saving = true;

                const token = this.authService.getToken();
                const eventSource = new EventSource(
                    `${environment.apiUrl}/certificates/${certificate._id}/reissue?token=${token}&domain=${encodeURIComponent(certificate.domain)}&additionalDomains=${encodeURIComponent(JSON.stringify(certificate.additionalDomains || []))}`
                );

                eventSource.onmessage = (event) => {
                    const data = JSON.parse(event.data);

                    if (data.type === 'progress') {
                        let icon = '';
                        if (data.level === 'error') {
                            icon = '✗ ';
                        } else if (data.level === 'warn') {
                            icon = '⚠ ';
                        }
                        this.progressMessages.push(icon + data.message);
                        this.cdr.detectChanges();

                        setTimeout(() => {
                            const container = document.querySelector('.max-h-96.overflow-y-auto');
                            if (container) {
                                container.scrollTop = container.scrollHeight;
                            }
                        }, 10);
                    } else if (data.type === 'success') {
                        this.progressMessages.push('✓ ' + data.message);
                        this.cdr.detectChanges();
                        eventSource.close();
                        setTimeout(() => {
                            this.displayProgressDialog = false;
                            this.messageService.add({
                                severity: 'success',
                                summary: this.translateService.instant('common.success'),
                                detail: data.message,
                                life: 5000
                            });
                            this.reloadTableData();
                            this.saving = false;
                        }, 1000);
                    } else if (data.type === 'error') {
                        this.progressMessages.push('✗ ' + data.message);
                        this.cdr.detectChanges();
                        eventSource.close();
                        setTimeout(() => {
                            this.messageService.add({
                                severity: 'error',
                                summary: this.translateService.instant('common.error'),
                                detail: data.message,
                                life: 5000
                            });
                            this.saving = false;
                        }, 1000);
                    }
                };

                eventSource.onerror = () => {
                    eventSource.close();
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: this.translateService.instant('certificates.errors.connectionError')
                    });
                    this.saving = false;
                };
            }
        });
    }

    renewCertificate(certificate: Certificate) {
        this.confirmationService.confirm({
            message: this.translateService.instant('certificates.renewConfirm', { domain: certificate.domain }),
            header: this.translateService.instant('certificates.actions.renew'),
            icon: 'pi pi-refresh',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.displayProgressDialog = true;
                this.progressMessages = [];
                this.saving = true;

                const token = this.authService.getToken();
                const eventSource = new EventSource(
                    `${environment.apiUrl}/certificates/${certificate._id}/renew?token=${token}`
                );

                eventSource.onmessage = (event) => {
                    const data = JSON.parse(event.data);

                    if (data.type === 'progress') {
                        let icon = '';
                        if (data.level === 'error') {
                            icon = '✗ ';
                        } else if (data.level === 'warn') {
                            icon = '⚠ ';
                        }
                        this.progressMessages.push(icon + data.message);
                        this.cdr.detectChanges();

                        setTimeout(() => {
                            const container = document.querySelector('.max-h-96.overflow-y-auto');
                            if (container) {
                                container.scrollTop = container.scrollHeight;
                            }
                        }, 10);
                    } else if (data.type === 'success') {
                        this.progressMessages.push('✓ ' + data.message);
                        this.cdr.detectChanges();
                        eventSource.close();
                        setTimeout(() => {
                            this.displayProgressDialog = false;
                            this.messageService.add({
                                severity: 'success',
                                summary: this.translateService.instant('common.success'),
                                detail: data.message,
                                life: 5000
                            });
                            this.reloadTableData();
                            this.saving = false;
                        }, 1000);
                    } else if (data.type === 'error') {
                        this.progressMessages.push('✗ ' + data.message);
                        this.cdr.detectChanges();
                        eventSource.close();
                        setTimeout(() => {
                            this.messageService.add({
                                severity: 'error',
                                summary: this.translateService.instant('common.error'),
                                detail: data.message,
                                life: 5000
                            });
                            this.saving = false;
                        }, 1000);
                    }
                };

                eventSource.onerror = () => {
                    eventSource.close();
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: this.translateService.instant('certificates.errors.connectionError')
                    });
                    this.saving = false;
                };
            }
        });
    }

    issueCertificate(certificate: Certificate) {
        this.confirmationService.confirm({
            message: this.translateService.instant('certificates.issueConfirm', { domain: certificate.domain, challenge: certificate.challengeType.toUpperCase(), dns_provider: this.dnsProviders.find(dp => dp.value === certificate.dnsProvider)?.label || 'N/A' }),
            header: this.translateService.instant('certificates.actions.issue'),
            icon: 'pi pi-play',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.displayProgressDialog = true;
                this.progressMessages = [];
                this.saving = true;

                const token = this.authService.getToken();
                const eventSource = new EventSource(
                    `${environment.apiUrl}/certificates/${certificate._id}/issue?token=${token}`
                );

                eventSource.onmessage = (event) => {
                    const data = JSON.parse(event.data);

                    if (data.type === 'progress') {
                        // Add icon based on level
                        let icon = '';
                        if (data.level === 'error') {
                            icon = '✗ ';
                        } else if (data.level === 'warn') {
                            icon = '⚠ ';
                        }
                        this.progressMessages.push(icon + data.message);

                        // Force change detection
                        this.cdr.detectChanges();

                        // Scroll to bottom
                        setTimeout(() => {
                            const container = document.querySelector('.max-h-96.overflow-y-auto');
                            if (container) {
                                container.scrollTop = container.scrollHeight;
                            }
                        }, 10);
                    } else if (data.type === 'success') {
                        this.progressMessages.push('✓ ' + data.message);
                        this.cdr.detectChanges();
                        eventSource.close();
                        setTimeout(() => {
                            this.displayProgressDialog = false;
                            this.messageService.add({
                                severity: 'success',
                                summary: this.translateService.instant('common.success'),
                                detail: data.message,
                                life: 5000
                            });
                            this.reloadTableData();
                            this.saving = false;
                        }, 2000);
                    } else if (data.type === 'error') {
                        this.progressMessages.push('✗ ' + data.message);
                        this.cdr.detectChanges();
                        eventSource.close();
                        // Don't close the dialog on error - let user read the messages
                        this.saving = false;
                    }
                };

                eventSource.onerror = (error) => {
                    eventSource.close();
                    this.displayProgressDialog = false;
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: this.translateService.instant('certificates.errors.connectionError')
                    });
                    this.saving = false;
                };
            }
        });
    }

    runPostIssuanceScripts(certificate: Certificate) {
        this.confirmationService.confirm({
            message: this.translateService.instant('certificates.confirm.runScripts', {
                count: certificate.postIssueScripts?.length,
                domain: certificate.domain
            }),
            header: this.translateService.instant('certificates.actions.runScripts'),
            icon: 'pi pi-bolt',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.saving = true;
                this.certificateService.testPostIssueScript(certificate._id!).subscribe({
                    next: (result) => {
                        if (result.success) {
                            this.messageService.add({
                                severity: 'success',
                                summary: this.translateService.instant('common.success'),
                                detail: result.output || this.translateService.instant('scripts.success.executed'),
                                life: 10000
                            });
                        } else {
                            // Show error dialog
                            this.scriptErrorDetails = {
                                output: result.output,
                                error: result.error
                            };
                            this.displayScriptErrorDialog = true;

                            // Also show toast
                            this.messageService.add({
                                severity: 'error',
                                summary: this.translateService.instant('common.error'),
                                detail: result.error || this.translateService.instant('scripts.errors.executionFailed'),
                                life: 10000
                            });
                        }
                        this.saving = false;
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('scripts.errors.executionFailed')
                        });
                        this.saving = false;
                    }
                });
            }
        });
    }

    getStatusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
        switch (status) {
            case 'valid':
                return 'success';
            case 'expired':
                return 'danger';
            case 'pending':
                return 'info';
            case 'error':
                return 'warn';
            default:
                return 'secondary';
        }
    }

    loadDnsProviders() {
        this.dnsProviderService.getAllProviders().subscribe({
            next: (response) => {
                this.dnsProviders = response.data
                    .filter(p => p.enabled)
                    .map(p => ({
                        label: p.name,
                        value: p._id
                    }));
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('dnsProviders.errors.loadFailed')
                });
            }
        });
    }

    loadCertificateAuthorities() {
        this.acmeCaService.getAllCAs().subscribe({
            next: (response) => {
                // Find default CA
                const defaultCa = response.data.find((ca: any) => ca.enabled && ca.isDefault);

                this.certificateAuthorities = response.data
                    .filter((ca: any) => ca.enabled)
                    .map((ca: any) => ({
                        label: ca.name,
                        value: ca._id,
                        isDefault: ca.isDefault
                    }));

                // Set default CA in form if found and form is empty
                if (defaultCa && !this.certificateForm.certificateAuthority) {
                    this.certificateForm.certificateAuthority = defaultCa._id;
                    this.onCertificateAuthorityChange(); // Load accounts for default CA
                }
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('acmeCa.errors.loadFailed')
                });
            }
        });
    }

    loadAcmeAccounts() {
        this.acmeAccountService.getAllAccounts().subscribe({
            next: (response: any) => {
                this.acmeAccounts = response.data.filter((acc: any) => acc.registeredAt); // Only registered accounts
            },
            error: (error: any) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('acmeAccounts.errors.loadFailed')
                });
            }
        });
    }

    loadPostIssueScripts() {
        this.postIssueScriptsService.getAllPostIssueScripts().subscribe({
            next: (response) => {
                this.postIssueScripts = response.data;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: 'Failed to load post-issue scripts'
                });
            }
        });
    }

    loadSshKeys() {
        this.sshKeyService.getAllKeys().subscribe({
            next: (response) => {
                this.sshKeys = response.data;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: 'Failed to load SSH keys'
                });
            }
        });
    }

    onScriptChange() {
        // Find the selected script
        const script = this.postIssueScripts.find(s => s._id === this.certificateForm.postIssueScript);
        if (script) {
            this.selectedScript = script;
            // Initialize vars with default values if not already set
            if (!this.certificateForm.postIssueScriptVars) {
                this.certificateForm.postIssueScriptVars = {};
            }
            // Set default values for new variables
            if (script.envVars) {
                script.envVars.forEach((v: any) => {
                    if (!(v.key in this.certificateForm.postIssueScriptVars) && v.defaultValue) {
                        this.certificateForm.postIssueScriptVars[v.key] = v.defaultValue;
                    }
                });
            }
        } else {
            this.selectedScript = null;
            this.certificateForm.postIssueScriptVars = {};
        }
    }

    onCertificateAuthorityChange() {
        // Filter accounts for selected CA
        this.filteredAccounts = this.acmeAccounts
            .filter(acc => {
                const accountCaId = typeof acc.caId === 'object' ? acc.caId._id : acc.caId;
                return accountCaId === this.certificateForm.certificateAuthority;
            })
            .map(acc => ({
                label: acc.email,
                value: acc._id
            }));

        // Reset account selection if current selection is not valid for new CA
        if (this.certificateForm.acmeAccount) {
            const isValidAccount = this.filteredAccounts.some(
                acc => acc.value === this.certificateForm.acmeAccount
            );
            if (!isValidAccount) {
                this.certificateForm.acmeAccount = '';
            }
        }

        // Auto-select if only one account available
        if (this.filteredAccounts.length === 1) {
            this.certificateForm.acmeAccount = this.filteredAccounts[0].value;
        }
    }

    getDaysUntilExpiry(expiryDate?: Date): number | null {
        if (!expiryDate) return null;
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    getSliderValue(expiryDate?: Date): number {
        const days = this.getDaysUntilExpiry(expiryDate);
        if (days === null || days < 0) return 0;
        return Math.min(days, 90); // Cap at 90 days for display
    }

    getChallengeTypeLabel(challengeType: string): string {
        return challengeType ? challengeType.toUpperCase() : '-';
    }

    getDnsProviderLabel(value: string): string {
        const provider = this.dnsProviders.find(p => p.value === value);
        return provider ? provider.label : value;
    }

    showDownloadMenu(event: Event, cert: Certificate) {
        // Update menu items for the selected certificate
        this.downloadMenuItems = [
            {
                label: this.translateService.instant('certificates.actions.downloadCert'),
                icon: 'pi pi-file',
                command: () => this.downloadCertificate(cert, 'cert')
            },
            {
                label: this.translateService.instant('certificates.actions.downloadKey'),
                icon: 'pi pi-key',
                command: () => this.downloadCertificate(cert, 'key')
            },
            {
                label: this.translateService.instant('certificates.actions.downloadFullchain'),
                icon: 'pi pi-file-export',
                command: () => this.downloadCertificate(cert, 'fullchain')
            },
            {
                label: this.translateService.instant('certificates.actions.downloadZip'),
                icon: 'pi pi-file-plus',
                command: () => this.downloadCertificate(cert, 'zip')
            }
        ];

        // Show the menu
        this.downloadMenu.toggle(event);
    }

    showCertificateDetails(cert: Certificate) {
        if (cert.fullChain || cert.certificate) {
            this.selectedCertificatePem = cert.fullChain || cert.certificate || null;
            this.displayCertificateViewer = true;
        } else {
            this.messageService.add({
                severity: 'warn',
                summary: this.translateService.instant('common.warning'),
                detail: this.translateService.instant('certificates.noCertificates')
            });
        }
    }

    downloadCertificate(cert: Certificate, type: 'cert' | 'key' | 'fullchain' | 'zip') {
        const token = this.authService.getToken();
        const url = `${this.certificateService['apiUrl']}/${cert._id}/download/${type}`;

        // Add authorization header using fetch
        fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(response => {
                // Extract filename from Content-Disposition header
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `${cert.domain}-${type}`; // Default fallback

                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                    if (filenameMatch && filenameMatch[1]) {
                        filename = filenameMatch[1];
                    }
                }

                return response.blob().then(blob => ({ blob, filename }));
            })
            .then(({ blob, filename }) => {
                const objectUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = objectUrl;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(objectUrl);

                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('certificates.success.downloaded')
                });
            })
            .catch(error => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('certificates.errors.downloadFailed')
                });
            });
    }

    get hourFormat(): string {
        const formatter = new Intl.DateTimeFormat(this.translateService.getCurrentLang(), { hour: 'numeric' });
        const options = formatter.resolvedOptions();
        return options.hour12 ? '12' : '24';
    }

    // Script management methods
    addScript() {
        if (!this.selectedScriptToAdd) return;

        const script = this.postIssueScripts.find(s => s._id === this.selectedScriptToAdd);
        if (!script) return;

        // Initialize vars with default values
        const vars: any = {};
        if (script.envVars) {
            script.envVars.forEach((v: any) => {
                if (v.defaultValue) {
                    vars[v.key] = v.defaultValue;
                }
            });
        }

        this.certificateForm.postIssueScripts.push({
            script: this.selectedScriptToAdd,
            vars: vars,
            sshKey: undefined
        });

        this.selectedScriptToAdd = null;
        this.selectedScriptDetails = null;
    }

    removeScript(index: number) {
        this.certificateForm.postIssueScripts.splice(index, 1);
    }

    moveScriptUp(index: number) {
        if (index === 0) return;
        const temp = this.certificateForm.postIssueScripts[index];
        this.certificateForm.postIssueScripts[index] = this.certificateForm.postIssueScripts[index - 1];
        this.certificateForm.postIssueScripts[index - 1] = temp;
    }

    moveScriptDown(index: number) {
        if (index === this.certificateForm.postIssueScripts.length - 1) return;
        const temp = this.certificateForm.postIssueScripts[index];
        this.certificateForm.postIssueScripts[index] = this.certificateForm.postIssueScripts[index + 1];
        this.certificateForm.postIssueScripts[index + 1] = temp;
    }

    getScriptDetails(scriptId: string): any {
        return this.postIssueScripts.find(s => s._id === scriptId);
    }

    scriptRequiresSshKey(scriptId: string): boolean {
        const script = this.getScriptDetails(scriptId);
        return script && script.requiresSshKey === true;
    }

    onScriptToAddChange() {
        if (this.selectedScriptToAdd) {
            this.selectedScriptDetails = this.getScriptDetails(this.selectedScriptToAdd);
        } else {
            this.selectedScriptDetails = null;
        }
    }
}

