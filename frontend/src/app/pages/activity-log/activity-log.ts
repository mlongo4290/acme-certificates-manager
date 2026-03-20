import { AdminUserService } from '@/services/admin-user.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { ButtonModule } from 'primeng/button';
import { ButtonGroupModule } from 'primeng/buttongroup';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerModule } from 'primeng/divider';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ActivityLog, ActivityLogService } from '../../services/activity-log.service';

@Component({
    selector: 'app-activity-log',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        TableModule,
        ButtonModule,
        SelectModule,
        DatePickerModule,
        InputTextModule,
        TagModule,
        TooltipModule,
        ConfirmDialogModule,
        ButtonGroupModule,
        IconFieldModule,
        InputIconModule,
        TranslatePipe,
        DividerModule,
        DatePickerModule,
        MultiSelectModule
    ],
    templateUrl: './activity-log.html'
})
export class ActivityLogComponent implements OnInit {
    private activityLogService = inject(ActivityLogService);
    private confirmationService = inject(ConfirmationService);
    private messageService = inject(MessageService);
    public translateService = inject(TranslateService);
    private adminUserService = inject(AdminUserService);
    private authService = inject(AuthService);
    isAdmin = () => this.authService.isAdmin();
    hasPermission = (resource: string, level: 'read' | 'write') => this.authService.hasPermission(resource, level);

    activities: ActivityLog[] = [];
    loading = false;
    totalRecords = 0;
    users: { label: string; value: string }[] = [];

    @ViewChild('dt') table: any;

    get dateFormat(): string {
        const formatter = new Intl.DateTimeFormat(this.translateService.getCurrentLang(), { year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = formatter.formatToParts(new Date(2023, 11, 25));

        // Build format string from parts order
        let format = '';
        for (const part of parts) {
            if (part.type === 'day') format += 'dd';
            else if (part.type === 'month') format += 'mm';
            else if (part.type === 'year') format += 'yy';
            else if (part.type === 'literal') format += part.value;
        }
        return format;
    }

    get hourFormat(): string {
        const formatter = new Intl.DateTimeFormat(this.translateService.getCurrentLang(), { hour: 'numeric' });
        const options = formatter.resolvedOptions();
        return options.hour12 ? '12' : '24';
    }

    ngOnInit() {
        if (this.isAdmin()) {
            this.loadUsers();
        }
    }

    onLazyLoad(event: any) {
        this.loading = true;

        const page = event.first / event.rows;
        const limit = event.rows;
        const sortField = event.sortField || 'timestamp';
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

        this.activityLogService
            .getActivityLogs(
                page, limit, sortField, sortOrder, filters
            )
            .subscribe({
                next: (response) => {
                    this.activities = response.data;
                    this.totalRecords = response.totalRecords;
                    this.loading = false;
                },
                error: () => {
                    this.loading = false;
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: this.translateService.instant('activityLog.errors.loadFailed')
                    });
                }
            });
    }

    clear(table: Table) {
        table.clear();
    }

    getActivityTypeColor(type: string): 'danger' | 'success' | 'info' | 'warn' | 'contrast' | null {
        const t = type.toLowerCase();
        if (['error', 'failed', 'deleted'].some(keyword => t.includes(keyword))) {
            return 'danger';
        }
        if (['success', 'created', 'issued', 'added', 'registered', 'executed'].some(keyword => t.includes(keyword))) {
            return 'success';
        }
        if (['updated', 'renewed', 'login', 'changed', 'default'].some(keyword => t.includes(keyword))) {
            return 'info';
        }
        return 'contrast';
    }



    getActivityIcon(type: string): string {
        const t = type.toLowerCase();
        if (t.startsWith('certificate')) return 'pi pi-shield';
        if (t.startsWith('dnsProvider')) return 'pi pi-cloud';
        if (t.startsWith('ca')) return 'pi pi-globe';
        if (t.startsWith('acmeAccount')) return 'pi pi-user-edit';
        if (t.startsWith('user')) return 'pi pi-user';
        if (t.startsWith('authProvider')) return 'pi pi-lock';
        if (t.startsWith('postscript')) return 'pi pi-code';
        if (t === 'configChanged') return 'pi pi-cog';
        if (t === 'systemError') return 'pi pi-exclamation-triangle';
        return 'pi pi-info-circle';
    }

    getActivityTypes(): { label: string; value: string }[] {
        const activityTypes: string[] = [
            'certificateIssued',
            'certificateRenewed',
            'certificateCreated',
            'certificateUpdated',
            'certificateDeleted',
            'certificateError',
            'dnsProviderAdded',
            'dnsProviderUpdated',
            'dnsProviderDeleted',
            'dnsProviderTestSuccess',
            'dnsProviderTestFailed',
            'caAdded',
            'caUpdated',
            'caDeleted',
            'caSetDefault',
            'acmeAccountCreated',
            'acmeAccountRegistered',
            'acmeAccountDeleted',
            'userCreated',
            'userUpdated',
            'userDeleted',
            'userLogin',
            'authProviderAdded',
            'authProviderUpdated',
            'authProviderDeleted',
            'configChanged',
            'systemError',
            'postScriptExecuted',
            'postScriptFailed',
            'postScriptCreated',
            'postScriptUpdated',
            'postScriptDeleted'
        ];
        return activityTypes.map(type => ({
            label: this.translateService.instant(`activityLog.types.${type}`),
            value: type
        })).sort((a, b) => a.label.localeCompare(b.label));
    }

    loadUsers() {
        this.adminUserService.getUsers().subscribe({
            next: (response) => {
                this.users = response.data.map((user: any) => ({ label: user.username, value: user.username }));
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.message || this.translateService.instant('users.errors.loadFailed')
                });
            }
        });
    }

    getMetadataEntries(metadata: any): { key: string; value: any }[] {
        return Object.entries(metadata).map(([key, value]) => ({
            key,
            value: typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : value
        }));
    }

    cleanupOldLogs() {
        this.confirmationService.confirm({
            message: this.translateService.instant('activityLog.confirmCleanup'),
            header: this.translateService.instant('activityLog.cleanup'),
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.activityLogService.cleanupOldLogs().subscribe({
                    next: (result) => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('activityLog.cleanupSuccess')
                        });
                        this.reloadTableData();
                    },
                    error: () => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: this.translateService.instant('activityLog.cleanupFailed')
                        });
                    }
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
