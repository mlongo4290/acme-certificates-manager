import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ImportSummaryItem {
    created: number;
    skipped: number;
}

export interface ImportResult {
    success: boolean;
    summary: {
        certificateAuthorities: ImportSummaryItem;
        dnsProviders: ImportSummaryItem;
        acmeAccounts: ImportSummaryItem;
        postIssueScripts: ImportSummaryItem;
        webhooks: ImportSummaryItem;
        certificates: ImportSummaryItem;
        errors: string[];
    };
}

export interface ExportOptions {
    includeSecrets: boolean;
    includeCertificates: boolean;
    password?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigExportService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/config`;

    exportConfig(options: ExportOptions): Observable<Blob> {
        return this.http.post(`${this.apiUrl}/export`, options, { responseType: 'blob' });
    }

    importConfig(zipData: string, password?: string): Observable<ImportResult> {
        return this.http.post<ImportResult>(`${this.apiUrl}/import`, { zipData, password });
    }
}
