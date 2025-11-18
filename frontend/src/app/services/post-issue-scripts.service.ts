import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EnvVarDef {
    key: string;
    description?: string;
    sensitive?: boolean;
}

export interface PostIssueScript {
    _id?: string;
    name: string;
    path: string;
    entrypoint: string;
    description?: string;
    requiresSshKey?: boolean;
    envVars: EnvVarDef[];
    hasInit?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class PostIssueScriptsService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/post-issue-scripts`;

    getAllPostIssueScripts(page: number = 0, limit: number = 10, sortField: string = 'name', sortOrder: number = 1, filters: any = {}): Observable<{ data: PostIssueScript[], totalRecords: number }> {
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

        return this.http.get<{ data: PostIssueScript[], totalRecords: number }>(this.apiUrl, { params });
    }

    getScriptById(id: string): Observable<PostIssueScript> {
        return this.http.get<PostIssueScript>(`${this.apiUrl}/${id}`);
    }

    createScript(script: Partial<PostIssueScript>): Observable<PostIssueScript> {
        return this.http.post<PostIssueScript>(this.apiUrl, script);
    }

    updateScript(id: string, script: Partial<PostIssueScript>): Observable<PostIssueScript> {
        return this.http.put<PostIssueScript>(`${this.apiUrl}/${id}`, script);
    }

    deleteScript(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }

    exportScript(id: string): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/${id}/export`, { responseType: 'blob' });
    }

    importScript(file: File): Observable<PostIssueScript> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<PostIssueScript>(`${this.apiUrl}/import`, formData);
    }

    getBasePath(): Observable<string> {
        return this.http.get(`${this.apiUrl}/base_path`, { responseType: 'text' });
    }

    runInit(id: string): Observable<{ success: boolean, log: string }> {
        return this.http.post<{ success: boolean, log: string }>(`${this.apiUrl}/${id}/run-init`, {});
    }
}

