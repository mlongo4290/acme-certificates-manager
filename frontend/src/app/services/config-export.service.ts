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

@Injectable({ providedIn: 'root' })
export class ConfigExportService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/config`;

    exportConfig(): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/export`, { responseType: 'blob' });
    }

    importConfig(data: any): Observable<ImportResult> {
        return this.http.post<ImportResult>(`${this.apiUrl}/import`, data);
    }
}
