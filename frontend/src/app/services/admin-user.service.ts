import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AdminUserService {
    private http = inject(HttpClient);
    private apiUrl = environment.apiUrl;

    getUsers(page = 0, limit = 0, sortField = 'createdAt', sortOrder = -1, filters: any = {}): Observable<{ data: any[], totalRecords: number }> {
        let params: any = {
            page: page.toString(),
            limit: limit.toString(),
            sortField,
            sortOrder: sortOrder.toString()
        };

        Object.keys(filters).forEach(key => {
            params[`filters[${key}]`] = JSON.stringify(filters[key]);
        });

        return this.http.get<{ data: any[], totalRecords: number }>(`${this.apiUrl}/admin/users`, { params });
    }

    createUser(user: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/admin/users`, user);
    }

    updateUser(id: string, user: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/admin/users/${id}`, user);
    }

    deleteUser(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/admin/users/${id}`);
    }
}
