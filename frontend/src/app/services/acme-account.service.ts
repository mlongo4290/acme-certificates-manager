import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AcmeAccount {
    _id?: string;
    name: string;
    email: string;
    caId: {
        _id: string;
        name: string;
        server: string;
    } | string;
    eabKeyId?: string;
    eabHmacKey?: string;
    accountUrl?: string;
    registeredAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface RegisterAccountResponse {
    success: boolean;
    message: string;
    account: AcmeAccount;
}

@Injectable({
    providedIn: 'root'
})
export class AcmeAccountService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/acme-accounts`;

    getAllAccounts(page = 0, limit = 0, sortField = 'createdAt', sortOrder = -1, filters: any = {}): Observable<{ data: AcmeAccount[], totalRecords: number }> {
        let params: any = {
            page: page.toString(),
            limit: limit.toString(),
            sortField,
            sortOrder: sortOrder.toString()
        };

        Object.keys(filters).forEach(key => {
            params[`filters[${key}]`] = JSON.stringify(filters[key]);
        });

        return this.http.get<{ data: AcmeAccount[], totalRecords: number }>(this.apiUrl, { params });
    }

    getAccountById(id: string): Observable<AcmeAccount> {
        return this.http.get<AcmeAccount>(`${this.apiUrl}/${id}`);
    }

    createAccount(account: Partial<AcmeAccount>): Observable<AcmeAccount> {
        return this.http.post<AcmeAccount>(this.apiUrl, account);
    }

    updateAccount(id: string, account: Partial<AcmeAccount>): Observable<AcmeAccount> {
        return this.http.put<AcmeAccount>(`${this.apiUrl}/${id}`, account);
    }

    deleteAccount(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }

    registerWithCA(id: string): Observable<RegisterAccountResponse> {
        return this.http.post<RegisterAccountResponse>(`${this.apiUrl}/${id}/register`, {});
    }
}
