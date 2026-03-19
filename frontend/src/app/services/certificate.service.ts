import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PostIssueScript } from './post-issue-scripts.service';

export type ChallengeType = 'http-01' | 'dns-01' | 'tls-alpn-01';

export interface Certificate {
    _id?: string;
    domain: string;
    additionalDomains?: string[]; // SAN - Subject Alternative Names
    status: 'valid' | 'expired' | 'pending' | 'error';
    issueDate?: Date;
    expiryDate?: Date;
    certificate?: string; // PEM format
    privateKey?: string; // PEM format (encrypted)
    fullChain?: string; // PEM format
    challengeType: ChallengeType;
    certificateAuthority: string; // ObjectId reference to CertificateAuthority
    acmeAccount: string; // ObjectId reference to AcmeAccount
    dnsProvider?: string; // ObjectId, only required if challengeType is 'dns-01'
    tags?: string[];
    autoRenewal: boolean;
    renewalSchedule: {
        daysBeforeExpiry: number;
        time: string; // HH:mm format (24h)
        timeShiftMinutes: number; // Random shift window in minutes
    };
    postIssueScripts?: Array<{
        script: string | PostIssueScript; // ObjectId reference or populated script
        vars: { [key: string]: string }; // User-provided values for required/optional vars
        sshKey?: string; // ObjectId reference to SSH key
    }>;
    lastRenewalAttempt?: Date;
    lastRenewalStatus?: 'success' | 'failed';
    modified?: boolean; // True if certificate configuration was modified after issuance
    enabled?: boolean; // False to disable renewal scheduling without changing configuration
    nextRenewalDate?: Date; // Calculated field from Agenda
    createdAt?: Date;
    updatedAt?: Date;
}

export interface RenewResult {
    success: boolean;
    message: string;
}

export interface TestScriptResult {
    success: boolean;
    output: string;
    error?: string;
}

export interface CertificatesStats {
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
}

export interface SchedulingConflict {
    conflictCount: number;
    conflictingCertificates: {
        _id: string;
        domain: string;
        time: string;
        timeShiftMinutes: number;
    }[];
    warning: 'none' | 'medium' | 'high';
}

@Injectable({
    providedIn: 'root'
})
export class CertificateService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/certificates`;

    getAllCertificates(page: number = 0, limit: number = 0, sortField: string = 'createdAt', sortOrder: number = -1, filters: any = {}): Observable<{ data: Certificate[], totalRecords: number }> {
        let params: any = {
            page: page.toString(),
            limit: limit.toString(),
            sortField,
            sortOrder: sortOrder.toString()
        };

        // Add filters to params
        Object.keys(filters).forEach(key => {
            params[`filters[${key}]`] = JSON.stringify(filters[key]);
        });

        return this.http.get<{ data: Certificate[], totalRecords: number }>(this.apiUrl, { params });
    }

    getCertificatesStats(): Observable<CertificatesStats> {
        return this.http.get<CertificatesStats>(`${this.apiUrl}/stats`);
    }

    getCertificateById(id: string): Observable<Certificate> {
        return this.http.get<Certificate>(`${this.apiUrl}/${id}`);
    }

    createCertificate(certificate: Partial<Certificate>): Observable<Certificate> {
        return this.http.post<Certificate>(this.apiUrl, certificate);
    }

    updateCertificate(id: string, certificate: Partial<Certificate>): Observable<Certificate> {
        return this.http.patch<Certificate>(`${this.apiUrl}/${id}`, certificate);
    }

    deleteCertificate(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }

    renewCertificate(id: string): Observable<{ jobId: string }> {
        return this.http.post<{ jobId: string }>(`${this.apiUrl}/${id}/renew`, {});
    }

    issueCertificate(id: string): Observable<{ jobId: string }> {
        return this.http.post<{ jobId: string }>(`${this.apiUrl}/${id}/issue`, {});
    }

    reissueCertificate(id: string, domain: string, additionalDomains: string[]): Observable<{ jobId: string }> {
        return this.http.post<{ jobId: string }>(`${this.apiUrl}/${id}/reissue`, { domain, additionalDomains });
    }

    dryRunCertificate(id: string): Observable<{ jobId: string }> {
        return this.http.post<{ jobId: string }>(`${this.apiUrl}/${id}/dry-run`, {});
    }

    testPostIssueScript(id: string): Observable<TestScriptResult> {
        return this.http.post<TestScriptResult>(`${this.apiUrl}/${id}/test-script`, {});
    }

    checkSchedulingConflicts(time: string, timeShiftMinutes: number, excludeCertificateId?: string): Observable<SchedulingConflict> {
        let params: any = {
            time,
            timeShiftMinutes: timeShiftMinutes.toString()
        };

        if (excludeCertificateId) {
            params.excludeCertificateId = excludeCertificateId;
        }

        return this.http.get<SchedulingConflict>(`${this.apiUrl}/check-scheduling-conflicts`, { params });
    }

    getCertificateLogs(id: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/${id}/logs`);
    }

    getRenewalConfig(): Observable<{ blackoutWindows: { start: number; end: number }[] }> {
        return this.http.get<{ blackoutWindows: { start: number; end: number }[] }>(`${this.apiUrl}/renewal-config`);
    }

    getAllTags(): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/tags`);
    }

    bulkAction(ids: string[], action: string): Observable<{ count: number; action: string }> {
        return this.http.post<{ count: number; action: string }>(`${this.apiUrl}/bulk`, { ids, action });
    }

    exportZip(ids: string[]): Observable<Blob> {
        return this.http.post(`${this.apiUrl}/export-zip`, { ids }, { responseType: 'blob' });
    }
}
