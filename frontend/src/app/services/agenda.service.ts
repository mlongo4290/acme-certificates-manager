import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RenewalCalendarEvent {
    certificateId: string;
    domain: string;
    scheduledAt: string; // ISO date string
}

@Injectable({
    providedIn: 'root'
})
export class AgendaService {
    private apiUrl = `${environment.apiUrl}/agenda`;

    constructor(private http: HttpClient) { }

    /**
     * Get renewal jobs scheduled within a date range
     */
    getRenewalCalendar(startDate: Date, endDate: Date): Observable<RenewalCalendarEvent[]> {
        const params = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        };
        return this.http.get<RenewalCalendarEvent[]>(`${this.apiUrl}/renewal-calendar`, { params });
    }
}
