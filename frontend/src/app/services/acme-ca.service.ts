import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AcmeCa {
    _id?: string;
    name: string;
    server: string;
    enabled: boolean;
    isDefault: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

@Injectable({
    providedIn: 'root'
})
export class AcmeCaService {
    private readonly API_URL = `${environment.apiUrl}/acme-ca`;

    constructor(private http: HttpClient) { }

    getAllCAs(page = 0, limit = 0, sortField = 'name', sortOrder = 1, filters: any = {}): Observable<{ data: AcmeCa[], totalRecords: number }> {
        let params: any = {
            page: page.toString(),
            limit: limit.toString(),
            sortField,
            sortOrder: sortOrder.toString()
        };

        Object.keys(filters).forEach(key => {
            params[`filters[${key}]`] = JSON.stringify(filters[key]);
        });

        return this.http.get<{ data: AcmeCa[], totalRecords: number }>(this.API_URL, { params });
    }

    getCAById(id: string): Observable<AcmeCa> {
        return this.http.get<AcmeCa>(`${this.API_URL}/${id}`);
    }

    createCA(ca: Partial<AcmeCa>): Observable<AcmeCa> {
        return this.http.post<AcmeCa>(this.API_URL, ca);
    }

    updateCA(id: string, ca: Partial<AcmeCa>): Observable<AcmeCa> {
        return this.http.put<AcmeCa>(`${this.API_URL}/${id}`, ca);
    }

    deleteCA(id: string): Observable<void> {
        return this.http.delete<void>(`${this.API_URL}/${id}`);
    }

    setAsDefault(id: string): Observable<AcmeCa> {
        return this.http.patch<AcmeCa>(`${this.API_URL}/${id}/set-default`, {});
    }

    testConnection(id: string): Observable<{ success: boolean; message: string; server: string }> {
        return this.http.post<{ success: boolean; message: string; server: string }>(
            `${this.API_URL}/${id}/test-connection`,
            {}
        );
    }
}
