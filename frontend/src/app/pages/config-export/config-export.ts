import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfigExportService, ImportResult } from '../../services/config-export.service';

@Component({
    selector: 'app-config-export',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        ButtonModule,
        CheckboxModule,
        FileUploadModule,
        MessageModule,
        PasswordModule,
        TableModule,
        TagModule,
        ToastModule
    ],
    templateUrl: './config-export.html'
})
export class ConfigExportComponent {
    private configExportService = inject(ConfigExportService);
    private messageService = inject(MessageService);
    private translateService = inject(TranslateService);

    exporting = false;
    importing = false;

    exportIncludes = [
        'configExport.export.includesList.cas',
        'configExport.export.includesList.dnsProviders',
        'configExport.export.includesList.acmeAccounts',
        'configExport.export.includesList.scripts',
        'configExport.export.includesList.webhooks',
        'configExport.export.includesList.certificates'
    ];

    // Export options
    includeSecrets = false;
    includeCertificates = false;
    exportPassword = '';

    // Import state
    importZipData: string | null = null;
    selectedFileName = '';
    importPassword = '';
    importResult: ImportResult | null = null;
    importHasEncrypted = false;

    get exportRequiresPassword(): boolean {
        return this.includeSecrets || this.includeCertificates;
    }

    get importResultRows() {
        if (!this.importResult) return [];
        const s = this.importResult.summary;
        return [
            { label: 'acmeCa.title', ...s.certificateAuthorities },
            { label: 'dnsProviders.title', ...s.dnsProviders },
            { label: 'acmeAccounts.title', ...s.acmeAccounts },
            { label: 'scripts.title', ...s.postIssueScripts },
            { label: 'webhooks.title', ...s.webhooks },
            { label: 'certificates.title', ...s.certificates }
        ];
    }

    exportConfig() {
        if (this.exportRequiresPassword && !this.exportPassword) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translateService.instant('common.warning'),
                detail: this.translateService.instant('configExport.export.passwordRequired')
            });
            return;
        }

        this.exporting = true;
        this.configExportService.exportConfig({
            includeSecrets: this.includeSecrets,
            includeCertificates: this.includeCertificates,
            password: this.exportRequiresPassword ? this.exportPassword : undefined
        }).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `acme-config-${new Date().toISOString().split('T')[0]}.zip`;
                a.click();
                window.URL.revokeObjectURL(url);
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('configExport.export.success')
                });
                this.exporting = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant('configExport.export.error')
                });
                this.exporting = false;
            }
        });
    }

    onFileSelect(event: any) {
        const file: File = event.files?.[0] || event.currentFiles?.[0];
        if (!file) return;
        this.selectedFileName = file.name;
        this.importResult = null;
        this.importZipData = null;
        this.importHasEncrypted = false;

        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            this.importZipData = btoa(binary);
        };
        reader.onerror = () => {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('configExport.import.invalidFile')
            });
            this.importZipData = null;
            this.selectedFileName = '';
        };
        reader.readAsArrayBuffer(file);
    }

    importConfig() {
        if (!this.importZipData) return;
        this.importing = true;
        this.importResult = null;

        this.configExportService.importConfig(this.importZipData, this.importPassword || undefined).subscribe({
            next: (result) => {
                this.importResult = result;
                const totalCreated = Object.values(result.summary)
                    .filter(v => typeof v === 'object' && 'created' in v)
                    .reduce((sum: number, v: any) => sum + v.created, 0);
                this.messageService.add({
                    severity: result.summary.errors.length > 0 ? 'warn' : 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('configExport.import.success', { count: totalCreated })
                });
                this.importing = false;
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant('configExport.import.error')
                });
                this.importing = false;
            }
        });
    }
}
