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
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { AcmeCaService } from '../../services/acme-ca.service';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-acme-ca',
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
        ToggleSwitchModule,
        SelectModule,
        TagModule,
        TooltipModule,
        ConfirmDialogModule,
        
        IconFieldModule,
        InputIconModule,
        MultiSelectModule
    ],
    templateUrl: './acme-ca.html'
})
export class AcmeCaComponent {
    private acmeCaService = inject(AcmeCaService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private translateService = inject(TranslateService);
    private authService = inject(AuthService);

    hasPermission = (resource: string, level: 'read' | 'write') => this.authService.hasPermission(resource, level);

    @ViewChild('dt') table: any;

    cas: any[] = [];
    totalRecords = 0;
    displayDialog = false;
    isNewCa = false;
    loading = false;
    saving = false;

    caForm: any = {
        name: '',
        server: '',
        enabled: true,
        isDefault: false
    };

    onLazyLoad(event: any) {
        this.loading = true;

        const page = event.first / event.rows;
        const limit = event.rows;
        const sortField = event.sortField || 'name';
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

        this.acmeCaService.getAllCAs(page, limit, sortField, sortOrder, filters).subscribe({
            next: (response) => {
                this.cas = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('acmeCa.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    showCreateDialog() {
        this.isNewCa = true;
        this.caForm = {
            name: '',
            server: '',
            enabled: true,
            isDefault: false
        };
        this.displayDialog = true;
    }

    showEditDialog(ca: any) {
        this.isNewCa = false;
        this.caForm = { ...ca };
        this.displayDialog = true;
    }

    hideDialog() {
        this.displayDialog = false;
    }

    saveCa() {
        this.saving = true;
        const operation = this.isNewCa
            ? this.acmeCaService.createCA(this.caForm)
            : this.acmeCaService.updateCA(this.caForm._id, this.caForm);

        operation.subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.isNewCa
                        ? this.translateService.instant('acmeCa.success.created')
                        : this.translateService.instant('acmeCa.success.updated')
                });
                this.hideDialog();
                this.reloadTableData();
                this.saving = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant('acmeCa.errors.saveFailed')
                });
                this.saving = false;
            }
        });
    }

    deleteCa(ca: any) {
        this.confirmationService.confirm({
            message: this.translateService.instant('acmeCa.confirmDelete'),
            header: this.translateService.instant('common.confirmDelete'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.acmeCaService.deleteCA(ca._id).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('acmeCa.success.deleted')
                        });
                        this.reloadTableData();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('acmeCa.errors.deleteFailed')
                        });
                    }
                });
            }
        });
    }

    getStatusOptions() {
        return [{ label: this.translateService.instant('common.enabled'), value: true },
        { label: this.translateService.instant('common.disabled'), value: false }];
    }

    setAsDefault(ca: any) {
        this.confirmationService.confirm({
            message: this.translateService.instant('acmeCa.confirmSetDefault'),
            header: this.translateService.instant('acmeCa.setAsDefault'),
            icon: 'pi pi-info-circle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.acmeCaService.setAsDefault(ca._id).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('acmeCa.success.defaultSet')
                        });
                        this.reloadTableData();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('acmeCa.errors.defaultSetFailed')
                        });
                    }
                });
            }
        });
    }

    testConnection(ca: any) {
        this.messageService.add({
            severity: 'info',
            summary: this.translateService.instant('acmeCa.testingConnection'),
            detail: this.translateService.instant('common.pleaseWait'),
        });

        this.acmeCaService.testConnection(ca._id).subscribe({
            next: (result) => {
                this.messageService.add({
                    severity: result.success ? 'success' : 'error',
                    summary: result.success
                        ? this.translateService.instant('acmeCa.success.connectionSuccess')
                        : this.translateService.instant('acmeCa.errors.connectionFailed'),
                    detail: result.message,
                    life: 5000
                });
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('acmeCa.errors.connectionFailed'),
                    detail: error.error?.message || this.translateService.instant('acmeCa.errors.connectionFailed'),
                    life: 5000
                });
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
