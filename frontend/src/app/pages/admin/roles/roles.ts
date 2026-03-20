import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import {
    Role,
    RolePermissions,
    RoleService,
    PermissionLevel,
    PERMISSION_RESOURCES,
    RESOURCE_LABELS
} from '../../../services/role.service';

@Component({
    selector: 'app-roles',
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
        ConfirmDialogModule,
        
        TooltipModule,
        ToggleSwitchModule
    ],
    templateUrl: './roles.html'
})
export class RolesComponent implements OnInit {
    private roleService = inject(RoleService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private translate = inject(TranslateService);

    roles: Role[] = [];
    totalRecords = 0;
    loading = false;
    saving = false;
    displayDialog = false;
    isNewRole = false;

    readonly resources = PERMISSION_RESOURCES;
    readonly resourceLabels = RESOURCE_LABELS;

    get permissionOptions(): { label: string; value: PermissionLevel }[] {
        return [
            { label: this.translate.instant('roles.permissionOptions.none'), value: 'none' },
            { label: this.translate.instant('roles.permissionOptions.read'), value: 'read' },
            { label: this.translate.instant('roles.permissionOptions.write'), value: 'write' }
        ];
    }

    roleForm: Partial<Role> & { permissions: RolePermissions } = this.emptyForm();

    ngOnInit(): void {
        this.loadRoles();
    }

    private emptyForm(): Partial<Role> & { permissions: RolePermissions } {
        const permissions: any = {};
        for (const r of PERMISSION_RESOURCES) {
            permissions[r] = 'none';
        }
        return {
            name: '',
            description: '',
            isAdmin: false,
            permissions: permissions as RolePermissions
        };
    }

    loadRoles(): void {
        this.loading = true;
        this.roleService.getRoles(0, 0).subscribe({
            next: (response) => {
                this.roles = response.data;
                this.totalRecords = response.totalRecords;
                this.loading = false;
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('common.error'),
                    detail: this.translate.instant('roles.errors.loadFailed')
                });
                this.loading = false;
            }
        });
    }

    showCreateDialog(): void {
        this.isNewRole = true;
        this.roleForm = this.emptyForm();
        this.displayDialog = true;
    }

    showEditDialog(role: Role): void {
        this.isNewRole = false;
        this.roleForm = {
            id: (role as any)._id,
            name: role.name,
            description: role.description || '',
            isAdmin: role.isAdmin || false,
            permissions: { ...role.permissions }
        } as any;
        this.displayDialog = true;
    }

    hideDialog(): void {
        this.displayDialog = false;
    }

    saveRole(): void {
        if (!this.roleForm.name?.trim()) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('common.warning'),
                detail: this.translate.instant('common.name') + ' ' + this.translate.instant('validationError').toLowerCase()
            });
            return;
        }

        this.saving = true;
        const payload = {
            name: this.roleForm.name,
            description: this.roleForm.description,
            isAdmin: this.roleForm.isAdmin,
            permissions: this.roleForm.permissions
        };

        const op = this.isNewRole
            ? this.roleService.createRole(payload)
            : this.roleService.updateRole((this.roleForm as any).id, payload);

        op.subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('common.success'),
                    detail: this.translate.instant(this.isNewRole ? 'roles.success.created' : 'roles.success.updated')
                });
                this.hideDialog();
                this.loadRoles();
                this.saving = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('common.error'),
                    detail: error.error?.message || this.translate.instant('roles.errors.saveFailed')
                });
                this.saving = false;
            }
        });
    }

    deleteRole(role: Role): void {
        this.confirmationService.confirm({
            message: this.translate.instant('roles.confirmDelete', { name: role.name }),
            header: this.translate.instant('common.confirmDelete'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translate.instant('yes'),
            rejectLabel: this.translate.instant('no'),
            accept: () => {
                this.roleService.deleteRole(role._id!).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translate.instant('common.success'),
                            detail: this.translate.instant('roles.success.deleted')
                        });
                        this.loadRoles();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translate.instant('common.error'),
                            detail: error.error?.message || this.translate.instant('roles.errors.deleteFailed')
                        });
                    }
                });
            }
        });
    }

    getPermissionSeverity(level: PermissionLevel): 'success' | 'warn' | 'secondary' {
        if (level === 'write') return 'success';
        if (level === 'read') return 'warn';
        return 'secondary';
    }
}
