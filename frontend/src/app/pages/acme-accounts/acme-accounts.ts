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
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AcmeAccount, AcmeAccountService } from '../../services/acme-account.service';
import { AcmeCaService } from '../../services/acme-ca.service';

@Component({
    selector: 'app-acme-accounts',
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
        IconFieldModule,
        InputIconModule,
        MultiSelectModule
    ],
    templateUrl: './acme-accounts.html',
    providers: [MessageService, ConfirmationService]
})
export class AcmeAccountsComponent implements OnInit {
    private acmeAccountService = inject(AcmeAccountService);
    private acmeCaService = inject(AcmeCaService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private translateService = inject(TranslateService);

    accounts: AcmeAccount[] = [];
    totalRecords = 0;
    cas: any[] = [];
    displayDialog = false;
    isNewAccount = false;
    loading = false;
    saving = false;

    accountForm: any = {
        name: '',
        email: '',
        caId: null,
        eabKeyId: '',
        eabHmacKey: ''
    };

    @ViewChild('dt') table: any;

    ngOnInit() {
        this.loadCAs();
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
                    // Special handling for registeredAt multiselect filter
                    if (field === 'registeredAt' && filterData.value && Array.isArray(filterData.value)) {
                        // Convert array of boolean values to constraints
                        const constraints = filterData.value.map((val: boolean) => ({
                            value: val,
                            matchMode: 'equals'
                        }));
                        if (constraints.length > 0) {
                            filters[field] = {
                                operator: 'or', // Use OR for multiselect
                                constraints
                            };
                        }
                    }
                    else if (Array.isArray(filterData)) {
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

        this.acmeAccountService.getAllAccounts(page, limit, sortField, sortOrder, filters).subscribe({
            next: (response) => {
                this.accounts = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('acmeAccounts.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    loadCAs() {
        this.acmeCaService.getAllCAs(0, 100).subscribe({
            next: (response) => {
                this.cas = response.data.filter((ca: any) => ca.enabled);
            },
            error: (error) => {
            }
        });
    }

    getStatusOptions() {
        return [{ label: this.translateService.instant('acmeAccounts.registered'), value: true },
        { label: this.translateService.instant('acmeAccounts.notRegistered'), value: false }];
    }

    showCreateDialog() {
        this.isNewAccount = true;
        this.accountForm = {
            name: '',
            email: '',
            caId: null,
            eabKeyId: '',
            eabHmacKey: ''
        };
        this.displayDialog = true;
    }

    showEditDialog(account: AcmeAccount) {
        this.isNewAccount = false;
        this.accountForm = {
            _id: account._id,
            name: account.name,
            email: account.email,
            caId: typeof account.caId === 'object' ? account.caId._id : account.caId,
            eabKeyId: account.eabKeyId || '',
            eabHmacKey: account.eabHmacKey || ''
        };
        this.displayDialog = true;
    }

    saveAccount() {
        if (!this.accountForm.name || !this.accountForm.email || !this.accountForm.caId) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('acmeAccounts.errors.validation')
            });
            return;
        }

        this.saving = true;
        const accountData = {
            name: this.accountForm.name,
            email: this.accountForm.email,
            caId: this.accountForm.caId,
            eabKeyId: this.accountForm.eabKeyId || undefined,
            eabHmacKey: this.accountForm.eabHmacKey || undefined
        };

        if (this.isNewAccount) {
            this.acmeAccountService.createAccount(accountData).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('acmeAccounts.success.created')
                    });
                    this.displayDialog = false;
                    this.reloadTableData();
                    this.saving = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('acmeAccounts.errors.creationFailed')
                    });
                    this.saving = false;
                }
            });
        } else {
            this.acmeAccountService.updateAccount(this.accountForm._id, accountData).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('acmeAccounts.success.updated')
                    });
                    this.displayDialog = false;
                    this.reloadTableData();
                    this.saving = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('acmeAccounts.errors.updateFailed')
                    });
                    this.saving = false;
                }
            });
        }
    }

    deleteAccount(account: AcmeAccount) {
        this.confirmationService.confirm({
            message: this.translateService.instant('acmeAccounts.confirmDelete', { name: account.name }),
            header: this.translateService.instant('common.confirm'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.acmeAccountService.deleteAccount(account._id!).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('acmeAccounts.success.deleted')
                        });
                        this.reloadTableData();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('acmeAccounts.errors.deleteFailed')
                        });
                    }
                });
            }
        });
    }

    registerAccount(account: AcmeAccount) {
        this.saving = true;
        this.acmeAccountService.registerWithCA(account._id!).subscribe({
            next: (result) => {
                if (result.success) {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: result.message
                    });
                    this.reloadTableData();
                } else {
                    this.messageService.add({
                        severity: 'warn',
                        summary: this.translateService.instant('common.warning'),
                        detail: result.message
                    });
                }
                this.saving = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || error.error?.error || this.translateService.instant('acmeAccounts.errors.registrationFailed')
                });
                this.saving = false;
            }
        });
    }

    getCAName(account: AcmeAccount): string {
        if (typeof account.caId === 'object') {
            return account.caId.name;
        }
        const ca = this.cas.find(c => c._id === account.caId);
        return ca ? ca.name : '';
    }

    getSeverity(isRegistered: boolean): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
        return isRegistered ? 'success' : 'secondary';
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
