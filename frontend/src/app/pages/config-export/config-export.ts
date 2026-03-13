import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfigExportService, ImportResult } from '../../services/config-export.service';

@Component({
    selector: 'app-config-export',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        ButtonModule,
        FileUploadModule,
        TableModule,
        TagModule,
        MessageModule,
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
    importData: any = null;
    selectedFileName = '';
    importResult: ImportResult | null = null;

    exportIncludes = [
        'configExport.export.includesList.cas',
        'configExport.export.includesList.dnsProviders',
        'configExport.export.includesList.acmeAccounts',
        'configExport.export.includesList.scripts',
        'configExport.export.includesList.webhooks',
        'configExport.export.includesList.certificates'
    ];

    exportExcludes = [
        'configExport.export.excludesList.certMaterial',
        'configExport.export.excludesList.acmeKeys',
        'configExport.export.excludesList.webhookSecrets',
        'configExport.export.excludesList.users'
    ];

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
        this.exporting = true;
        this.configExportService.exportConfig().subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `acme-config-${new Date().toISOString().split('T')[0]}.json`;
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

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.importData = JSON.parse(e.target?.result as string);
            } catch {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('configExport.import.invalidFile')
                });
                this.importData = null;
                this.selectedFileName = '';
            }
        };
        reader.readAsText(file);
    }

    importConfig() {
        if (!this.importData) return;
        this.importing = true;
        this.importResult = null;

        this.configExportService.importConfig(this.importData).subscribe({
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
