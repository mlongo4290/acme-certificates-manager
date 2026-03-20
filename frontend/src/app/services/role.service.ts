import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const PERMISSION_RESOURCES = [
    'certificates',
    'acmeCa',
    'acmeAccounts',
    'dnsProviders',
    'sshKeys',
    'scripts',
    'webhooks',
    'activityLogs',
    'settings',
    'jobs',
    'renewalCalendar'
] as const;

export type ResourceName = typeof PERMISSION_RESOURCES[number];
export type PermissionLevel = 'none' | 'read' | 'write';
export type RolePermissions = { [K in ResourceName]: PermissionLevel };

export interface Role {
    _id?: string;
    name: string;
    description?: string;
    isAdmin?: boolean;
    permissions: RolePermissions;
    createdAt?: string;
    updatedAt?: string;
}

export const RESOURCE_LABELS: Record<ResourceName, string> = {
    certificates: 'roles.resources.certificates',
    acmeCa: 'roles.resources.acmeCa',
    acmeAccounts: 'roles.resources.acmeAccounts',
    dnsProviders: 'roles.resources.dnsProviders',
    sshKeys: 'roles.resources.sshKeys',
    scripts: 'roles.resources.scripts',
    webhooks: 'roles.resources.webhooks',
    activityLogs: 'roles.resources.activityLogs',
    settings: 'roles.resources.settings',
    jobs: 'roles.resources.jobs',
    renewalCalendar: 'roles.resources.renewalCalendar'
};

@Injectable({
    providedIn: 'root'
})
export class RoleService {
    private readonly API_URL = `${environment.apiUrl}/roles`;

    constructor(private http: HttpClient) { }

    getRoles(page = 0, limit = 0, sortField = 'name', sortOrder = 1): Observable<{ data: Role[], totalRecords: number }> {
        const params: any = {
            page: page.toString(),
            limit: limit.toString(),
            sortField,
            sortOrder: sortOrder.toString()
        };
        return this.http.get<{ data: Role[], totalRecords: number }>(this.API_URL, { params });
    }

    getRoleById(id: string): Observable<Role> {
        return this.http.get<Role>(`${this.API_URL}/${id}`);
    }

    createRole(role: Partial<Role>): Observable<Role> {
        return this.http.post<Role>(this.API_URL, role);
    }

    updateRole(id: string, role: Partial<Role>): Observable<Role> {
        return this.http.put<Role>(`${this.API_URL}/${id}`, role);
    }

    deleteRole(id: string): Observable<void> {
        return this.http.delete<void>(`${this.API_URL}/${id}`);
    }
}
