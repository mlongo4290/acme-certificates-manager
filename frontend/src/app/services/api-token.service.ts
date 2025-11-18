import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ApiToken {
    _id: string;
    name: string;
    expiresAt?: Date;
    lastUsedAt?: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateTokenRequest {
    name: string;
    expiresInDays?: number;
}

export interface CreateTokenResponse extends ApiToken {
    token: string;
    warning: string;
}

@Injectable({
    providedIn: 'root'
})
export class ApiTokenService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getTokens(): Observable<ApiToken[]> {
        return this.http.get<ApiToken[]>(`${this.apiUrl}/api-tokens`);
    }

    createToken(request: CreateTokenRequest): Observable<CreateTokenResponse> {
        return this.http.post<CreateTokenResponse>(`${this.apiUrl}/api-tokens`, request);
    }

    deleteToken(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/api-tokens/${id}`);
    }
}
