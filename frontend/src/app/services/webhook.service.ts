import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Webhook {
    _id?: string;
    name: string;
    url: string;
    events: string[];
    secret?: string;
    hasSecret?: boolean;
    headers?: Record<string, string>;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface WebhookLog {
    _id: string;
    alertType: string;
    webhookId: string;
    channel: string;
    recipient: string;
    status: 'sent' | 'failed' | 'pending';
    sentAt?: string;
    error?: string;
    metadata?: any;
    createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class WebhookService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/webhooks`;

    getAll(): Observable<Webhook[]> {
        return this.http.get<Webhook[]>(this.apiUrl);
    }

    getById(id: string): Observable<Webhook> {
        return this.http.get<Webhook>(`${this.apiUrl}/${id}`);
    }

    create(webhook: Partial<Webhook>): Observable<Webhook> {
        return this.http.post<Webhook>(this.apiUrl, webhook);
    }

    update(id: string, webhook: Partial<Webhook>): Observable<Webhook> {
        return this.http.put<Webhook>(`${this.apiUrl}/${id}`, webhook);
    }

    delete(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }

    test(id: string): Observable<{ success: boolean; statusCode?: number; statusText?: string; error?: string }> {
        return this.http.post<any>(`${this.apiUrl}/${id}/test`, {});
    }

    getValidEvents(): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/events`);
    }

    getLogs(id: string, page = 0, limit = 50): Observable<{ data: WebhookLog[]; totalRecords: number }> {
        return this.http.get<{ data: WebhookLog[]; totalRecords: number }>(`${this.apiUrl}/${id}/logs`, {
            params: { page: page.toString(), limit: limit.toString() }
        });
    }
}
