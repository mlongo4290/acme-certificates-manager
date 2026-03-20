import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { EventInput, EventSourceFunc } from '@fullcalendar/core/index.js';
import itLocale from '@fullcalendar/core/locales/it';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import multiMonthPlugin from '@fullcalendar/multimonth';
import timeGridPlugin from '@fullcalendar/timegrid';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AgendaService } from '../../services/agenda.service';

@Component({
    selector: 'app-renewal-calendar',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        FullCalendarModule,
        ButtonModule,
        
        ProgressSpinnerModule
    ],
    templateUrl: './renewal-calendar.html'
})
export class RenewalCalendarComponent implements OnInit {
    private agendaService = inject(AgendaService);
    private messageService = inject(MessageService);
    public translateService = inject(TranslateService);

    loading = false;
    calendarOptions = {
        plugins: [dayGridPlugin, timeGridPlugin, listPlugin, multiMonthPlugin, interactionPlugin],
        initialView: 'dayGridMonth',
        views: {
            listWeek: { buttonText: this.translateService.instant('renewalCalendar.listWeek') },
            listMonth: { buttonText: this.translateService.instant('renewalCalendar.listMonth') }
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridDay,timeGridWeek,dayGridMonth,listWeek,listMonth,multiMonthYear'
        },
        weekends: true,
        editable: false,
        selectable: false,
        selectMirror: true,
        dayMaxEvents: true,
        events: this.loadEvents.bind(this) as EventSourceFunc,
        locales: [itLocale],
        locale: this.translateService.getCurrentLang() || 'en'
    };

    ngOnInit() {
        this.updateLocale();

        // Listen for language changes
        this.translateService.onLangChange.subscribe(() => {
            this.updateLocale();
        });
    }

    updateLocale() {
        const locale = this.translateService.getCurrentLang() || 'en';
        this.calendarOptions.locale = locale;

        this.calendarOptions.views.listWeek.buttonText = this.translateService.instant('renewalCalendar.listWeek');
        this.calendarOptions.views.listMonth.buttonText = this.translateService.instant('renewalCalendar.listMonth');
    }

    loadEvents(fetchInfo: any, successCallback: (events: EventInput[]) => void, failureCallback: (error: Error) => void) {
        this.loading = true;

        this.agendaService.getRenewalCalendar(fetchInfo.start, fetchInfo.end).subscribe({
            next: (events) => {
                const calendarEvents: EventInput[] = events.map(event => {
                    const scheduledDate = new Date(event.scheduledAt);

                    return {
                        id: event.certificateId,
                        title: event.domain,
                        start: scheduledDate,
                        end: new Date(scheduledDate.getTime() + 30 * 1000),
                        extendedProps: {
                            certificateId: event.certificateId
                        }
                    };
                });

                this.loading = false;
                successCallback(calendarEvents);
            },
            error: (error) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: this.translateService.instant('renewalCalendar.errors.loadFailed')
                });
                this.loading = false;
                failureCallback(error);
            }
        });
    }
}
