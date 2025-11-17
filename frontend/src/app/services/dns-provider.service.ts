import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DnsProvider {
    _id?: string;
    name: string;
    type?: string;
    enabled: boolean;
    credentials?: { [key: string]: string };
    description?: string;
    dnsPropagationTime?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TestProviderResult {
    success: boolean;
    message: string;
}

export interface ProviderTypeMetadata {
    type: string;
    label: string;
    requiredCredentials: string[];
    optionalCredentials: string[];
}

@Injectable({
    providedIn: 'root'
})
export class DnsProviderService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/dns-providers`;

    getAvailableProviderTypes(): Observable<ProviderTypeMetadata[]> {
        return this.http.get<ProviderTypeMetadata[]>(`${this.apiUrl}/types`);
    }

    getAllProviders(page = 0, limit = 0, sortField = 'name', sortOrder = 1, filters: any = {}): Observable<{ data: DnsProvider[], totalRecords: number }> {
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

        return this.http.get<{ data: DnsProvider[], totalRecords: number }>(this.apiUrl, { params });
    }

    getProviderById(id: string): Observable<DnsProvider> {
        return this.http.get<DnsProvider>(`${this.apiUrl}/${id}`);
    }

    createProvider(provider: Partial<DnsProvider>): Observable<DnsProvider> {
        return this.http.post<DnsProvider>(this.apiUrl, provider);
    }

    updateProvider(id: string, provider: Partial<DnsProvider>): Observable<DnsProvider> {
        return this.http.patch<DnsProvider>(`${this.apiUrl}/${id}`, provider);
    }

    deleteProvider(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }

    testProvider(id: string): Observable<TestProviderResult> {
        return this.http.post<TestProviderResult>(`${this.apiUrl}/${id}/test`, {});
    }
}
