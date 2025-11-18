import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


export interface ActivityLog {
    _id: string;
    type: string;
    message?: string;
    timestamp: Date;
    userId?: string;
    username?: string;
    metadata?: {
        resourceType?: string;
        resourceId?: string;
        resourceName?: string;
        oldValue?: any;
        newValue?: any;
        errorMessage?: string;
        errorStack?: string;
        ipAddress?: string;
        userAgent?: string;
        [key: string]: any;
    };
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ActivityLogResponse {
    logs: ActivityLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface ActivityLogConfig {
    enabled: boolean;
    retentionDays: number;
    housekeepingSchedule: string;
}

@Injectable({
    providedIn: 'root'
})
export class ActivityLogService {
    private readonly apiUrl = `${environment.apiUrl}/activity-logs`;
    private http = inject(HttpClient);

    /**
     * Get paginated activity logs with filters
     */
    getActivityLogs(
        page = 0, limit = 0, sortField = 'createdAt', sortOrder = -1, filters: any = {}
    ): Observable<{ data: ActivityLog[], totalRecords: number }> {
        let params: any = {
            page: page.toString(),
            limit: limit.toString(),
            sortField,
            sortOrder: sortOrder.toString()
        };

        Object.keys(filters).forEach(key => {
            params[`filters[${key}]`] = JSON.stringify(filters[key]);
        });

        return this.http.get<{ data: ActivityLog[], totalRecords: number }>(this.apiUrl, { params });

    }

    /**
     * Get recent activity logs for dashboard widget
     */
    getRecentActivityLogs(limit: number = 15): Observable<ActivityLog[]> {
        const params = new HttpParams().set('limit', limit.toString());
        return this.http.get<ActivityLog[]>(`${this.apiUrl}/recent`, { params });
    }

    /**
     * Get activity log configuration
     */
    getConfig(): Observable<ActivityLogConfig> {
        return this.http.get<ActivityLogConfig>(`${this.apiUrl}/config`);
    }

    /**
     * Update activity log configuration
     */
    updateConfig(config: Partial<ActivityLogConfig>): Observable<{ message: string; config: ActivityLogConfig }> {
        return this.http.post<{ message: string; config: ActivityLogConfig }>(`${this.apiUrl}/config`, config);
    }

    /**
     * Manually trigger housekeeping cleanup
     */
    cleanupOldLogs(): Observable<{ message: string; deletedCount: number; cutoffDate: Date }> {
        return this.http.delete<{ message: string; deletedCount: number; cutoffDate: Date }>(`${this.apiUrl}/cleanup`);
    }
}
