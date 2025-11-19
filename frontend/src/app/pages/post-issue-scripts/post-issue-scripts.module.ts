import { PostIssueScript, PostIssueScriptsService } from '@/services/post-issue-scripts.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-post-issue-scripts',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        ConfirmDialogModule,
        ToastModule,
        CheckboxModule,
        TranslateModule,
        InputGroupModule,
        InputGroupAddonModule,
        TooltipModule,
        TranslatePipe
    ],
    templateUrl: './post-issue-scripts.html'
})
export class PostIssueScriptsComponent implements OnInit {
    private postIssueScriptsService = inject(PostIssueScriptsService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private translateService = inject(TranslateService);

    // Expose Object to template
    Object = Object;

    scripts: PostIssueScript[] = [];
    totalRecords = 0;
    loading = false;
    saving = false;
    displayDialog = false;
    isNewScript = false;
    basePath = "";

    scriptForm: Partial<PostIssueScript> = {
        name: '',
        path: '',
        entrypoint: 'script.sh',
        description: '',
        requiresSshKey: false,
        envVars: []
    };

    // Temporary fields for adding variables
    newEnvVarKey = '';
    newEnvVarDescription = '';
    newEnvVarSensitive = false;
    editingVarIndex: number | null = null;

    @ViewChild('dt') table: any;

    ngOnInit() {
        this.postIssueScriptsService.getBasePath().subscribe({
            next: (response) => {
                this.basePath = response;
            }
        });
    }

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

        this.postIssueScriptsService.getAllPostIssueScripts(page, limit, sortField, sortOrder, filters).subscribe({
            next: (response) => {
                this.scripts = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('scripts.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    showCreateDialog() {
        this.isNewScript = true;
        this.scriptForm = {
            name: '',
            path: '',
            description: '',
            envVars: []
        };

        // Reset temporary fields
        this.newEnvVarKey = '';
        this.newEnvVarDescription = '';
        this.newEnvVarSensitive = false;
        this.editingVarIndex = null;

        this.displayDialog = true;
    }

    editScript(script: PostIssueScript) {
        this.isNewScript = false;
        this.scriptForm = JSON.parse(JSON.stringify(script));

        // Reset temporary fields
        this.newEnvVarKey = '';
        this.newEnvVarDescription = '';
        this.newEnvVarSensitive = false;
        this.editingVarIndex = null;

        this.displayDialog = true;
    }

    saveScript() {
        if (!this.scriptForm.name || !this.scriptForm.path) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('scripts.errors.namePathRequired')
            });
            return;
        }

        this.saving = true;

        if (this.isNewScript) {
            this.postIssueScriptsService.createScript(this.scriptForm).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('scripts.success.created')
                    });
                    this.displayDialog = false;
                    this.reloadTableData();
                    this.saving = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('scripts.errors.createFailed')
                    });
                    this.saving = false;
                }
            });
        } else {
            this.postIssueScriptsService.updateScript(this.scriptForm._id!, this.scriptForm).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translateService.instant('common.success'),
                        detail: this.translateService.instant('scripts.success.updated')
                    });
                    this.displayDialog = false;
                    this.reloadTableData();
                    this.saving = false;
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translateService.instant('common.error'),
                        detail: error.error?.message || this.translateService.instant('scripts.errors.updateFailed')
                    });
                    this.saving = false;
                }
            });
        }
    }

    reloadTableData() {
        if (this.table) {
            // Get current lazy load event state from table
            const lazyLoadEvent = this.table.createLazyLoadMetadata();
            // Trigger lazy load with current state
            this.onLazyLoad(lazyLoadEvent);
        }
    }

    deleteScript(script: PostIssueScript) {
        this.confirmationService.confirm({
            message: this.translateService.instant('scripts.confirmDelete', { name: script.name }),
            header: this.translateService.instant('common.confirm'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.postIssueScriptsService.deleteScript(script._id!).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translateService.instant('common.success'),
                            detail: this.translateService.instant('scripts.success.deleted')
                        });
                        this.reloadTableData();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('scripts.errors.deleteFailed')
                        });
                    }
                });
            }
        });
    }

    exportScript(script: PostIssueScript) {
        this.postIssueScriptsService.exportScript(script._id!).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `script-${script.name}.zip`;
                link.click();
                window.URL.revokeObjectURL(url);

                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('scripts.success.exported')
                });
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant('scripts.errors.exportFailed')
                });
            }
        });
    }

    importScript(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        this.postIssueScriptsService.importScript(file).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('scripts.success.imported')
                });
                this.reloadTableData();
                // Reset file input
                event.target.value = '';
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant('scripts.errors.importFailed')
                });
                // Reset file input
                event.target.value = '';
            }
        });
    }

    addEnvVar() {
        if (!this.newEnvVarKey || !this.newEnvVarDescription) {
            return;
        }

        if (!this.scriptForm.envVars) {
            this.scriptForm.envVars = [];
        }

        if (this.editingVarIndex !== null) {
            // Update existing variable
            this.scriptForm.envVars[this.editingVarIndex] = {
                key: this.newEnvVarKey,
                description: this.newEnvVarDescription,
                sensitive: this.newEnvVarSensitive
            };
            this.editingVarIndex = null;
        } else {
            // Add new variable
            this.scriptForm.envVars.push({
                key: this.newEnvVarKey,
                description: this.newEnvVarDescription,
                sensitive: this.newEnvVarSensitive
            });
        }

        // Reset input fields
        this.newEnvVarKey = '';
        this.newEnvVarDescription = '';
        this.newEnvVarSensitive = false;
    }

    editEnvVar(index: number) {
        const envVar = this.scriptForm.envVars![index];
        this.newEnvVarKey = envVar.key;
        this.newEnvVarDescription = envVar.description || '';
        this.newEnvVarSensitive = envVar.sensitive || false;
        this.editingVarIndex = index;
    }

    cancelEditEnvVar() {
        this.newEnvVarKey = '';
        this.newEnvVarDescription = '';
        this.newEnvVarSensitive = false;
        this.editingVarIndex = null;
    }

    removeEnvVar(index: number) {
        this.scriptForm.envVars?.splice(index, 1);
    }

    runInit(script: PostIssueScript) {
        this.confirmationService.confirm({
            message: this.translateService.instant('scripts.confirmRunInit', { name: script.name }),
            header: this.translateService.instant('common.confirm'),
            icon: 'pi pi-question-circle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.loading = true;
                this.postIssueScriptsService.runInit(script._id!).subscribe({
                    next: (result) => {
                        this.loading = false;
                        if (result.success) {
                            this.messageService.add({
                                severity: 'success',
                                summary: this.translateService.instant('common.success'),
                                detail: this.translateService.instant('scripts.success.initSuccess'),
                                life: 5000
                            });
                        } else {
                            this.messageService.add({
                                severity: 'error',
                                summary: this.translateService.instant('common.error'),
                                detail: this.translateService.instant('scripts.errors.initFailed'),
                                life: 10000
                            });
                        }

                        // Show log in console for debugging
                        console.log('Init script output:', result.log);

                        // Show detailed log in a separate toast
                        this.messageService.add({
                            severity: 'info',
                            summary: this.translateService.instant('scripts.initLog'),
                            detail: result.log,
                            life: 15000,
                            styleClass: 'whitespace-pre-wrap font-mono text-xs'
                        });
                    },
                    error: (error) => {
                        this.loading = false;
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translateService.instant('common.error'),
                            detail: error.error?.message || this.translateService.instant('scripts.errors.initFailed'),
                        });
                    }
                });
            }
        });
    }
}
