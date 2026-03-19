import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SshKey {
    _id?: string;
    name: string;
    description?: string;
    publicKey: string;
    keyType: string;
    keySize?: number;
    username: string;
    port: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface SshKeyCreate {
    name: string;
    description?: string;
    privateKey: string;
    publicKey: string;
    keyType: string;
    keySize?: number;
    username?: string;
    port?: number;
}

export interface SshKeyUpdate {
    name?: string;
    description?: string;
    privateKey?: string;
    publicKey?: string;
    keyType?: string;
    keySize?: number;
    username?: string;
    port?: number;
}

export interface GenerateKeyPairResult {
    privateKey: string;
    publicKey: string;
    keyType: string;
    keySize?: number;
}

@Injectable({
    providedIn: 'root'
})
export class SshKeyService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/ssh-keys`;

    getAllKeys(page: number = 0, limit: number = 0, sortField: string = 'name', sortOrder: number = 1, filters: any = {}): Observable<{ data: SshKey[], totalRecords: number }> {
        return this.http.get<{ data: SshKey[], totalRecords: number }>(this.apiUrl);
    }

    getKey(id: string): Observable<SshKey> {
        return this.http.get<SshKey>(`${this.apiUrl}/${id}`);
    }

    createKey(key: SshKeyCreate): Observable<SshKey> {
        return this.http.post<SshKey>(this.apiUrl, key);
    }

    updateKey(id: string, key: SshKeyUpdate): Observable<SshKey> {
        return this.http.put<SshKey>(`${this.apiUrl}/${id}`, key);
    }

    deleteKey(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }

    generateKeyPair(keyType: string = 'ed25519', bits?: number): Observable<GenerateKeyPairResult> {
        return this.http.post<GenerateKeyPairResult>(`${this.apiUrl}/generate`, { keyType, bits });
    }
}
