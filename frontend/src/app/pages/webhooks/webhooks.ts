import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Webhook, WebhookLog, WebhookService } from '../../services/webhook.service';

@Component({
    selector: 'app-webhooks',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        CheckboxModule,
        MultiSelectModule,
        TagModule,
        ToastModule,
        TooltipModule,
        ConfirmDialogModule,
        TranslateModule,
        TranslatePipe,
    ],
    templateUrl: './webhooks.html'
})
export class WebhooksComponent implements OnInit {
    private webhookService = inject(WebhookService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    public translateService = inject(TranslateService);

    webhooks: Webhook[] = [];
    loading = false;
    saving = false;

    displayDialog = false;
    isNew = true;
    form: Partial<Webhook> & { secret?: string } = { name: '', url: '', events: [], enabled: true };

    displayLogsDialog = false;
    selectedWebhook: Webhook | null = null;
    logs: WebhookLog[] = [];
    logsLoading = false;

    eventOptions: { label: string; value: string }[] = [];

    private readonly allEvents = [
        'certificate_renewed_success',
        'certificate_renewed_failed',
        'certificate_issued_success',
        'certificate_issued_failed',
        'post_script_success',
        'post_script_failed',
    ];

    ngOnInit() {
        this.loadEventOptions();
        this.load();
    }

    loadEventOptions() {
        this.eventOptions = this.allEvents.map(e => ({
            label: this.translateService.instant(`webhooks.eventTypes.${e}`),
            value: e
        }));
        this.translateService.onLangChange.subscribe(() => {
            this.eventOptions = this.allEvents.map(e => ({
                label: this.translateService.instant(`webhooks.eventTypes.${e}`),
                value: e
            }));
        });
    }

    load() {
        this.loading = true;
        this.webhookService.getAll().subscribe({
            next: (data) => { this.webhooks = data; this.loading = false; },
            error: () => {
                this.loading = false;
                this.messageService.add({ severity: 'error', summary: this.translateService.instant('common.error'), detail: this.translateService.instant('webhooks.errors.loadFailed') });
            }
        });
    }

    showCreateDialog() {
        this.isNew = true;
        this.form = { name: '', url: '', events: [], enabled: true, secret: '' };
        this.displayDialog = true;
    }

    editWebhook(webhook: Webhook) {
        this.isNew = false;
        this.form = { ...webhook, secret: '' };
        this.displayDialog = true;
    }

    save() {
        if (!this.form.name || !this.form.url || !this.form.events?.length) return;
        this.saving = true;

        const payload: any = {
            name: this.form.name,
            url: this.form.url,
            events: this.form.events,
            enabled: this.form.enabled,
            headers: this.form.headers || {},
        };
        // Only send secret if it has a value
        if (this.form.secret !== undefined && this.form.secret !== '') {
            payload.secret = this.form.secret;
        } else if (!this.isNew && this.form.secret === '') {
            payload.secret = ''; // empty string = remove secret
        }

        const request = this.isNew
            ? this.webhookService.create(payload)
            : this.webhookService.update(this.form._id!, payload);

        request.subscribe({
            next: () => {
                this.saving = false;
                this.displayDialog = false;
                this.load();
                this.messageService.add({ severity: 'success', summary: this.translateService.instant('common.success'), detail: this.translateService.instant(this.isNew ? 'webhooks.success.created' : 'webhooks.success.updated') });
            },
            error: (err) => {
                this.saving = false;
                this.messageService.add({ severity: 'error', summary: this.translateService.instant('common.error'), detail: err.error?.message || this.translateService.instant('webhooks.errors.saveFailed') });
            }
        });
    }

    deleteWebhook(webhook: Webhook) {
        this.confirmationService.confirm({
            message: this.translateService.instant('webhooks.confirmDelete', { name: webhook.name }),
            header: this.translateService.instant('common.confirm'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translateService.instant('yes'),
            rejectLabel: this.translateService.instant('no'),
            accept: () => {
                this.webhookService.delete(webhook._id!).subscribe({
                    next: () => {
                        this.load();
                        this.messageService.add({ severity: 'success', summary: this.translateService.instant('common.success'), detail: this.translateService.instant('webhooks.success.deleted') });
                    },
                    error: (err) => {
                        this.messageService.add({ severity: 'error', summary: this.translateService.instant('common.error'), detail: err.error?.message || this.translateService.instant('webhooks.errors.deleteFailed') });
                    }
                });
            }
        });
    }

    testWebhook(webhook: Webhook) {
        this.messageService.add({ severity: 'info', summary: this.translateService.instant('webhooks.testing'), detail: webhook.url, life: 3000 });
        this.webhookService.test(webhook._id!).subscribe({
            next: (result) => {
                if (result.success) {
                    this.messageService.add({ severity: 'success', summary: this.translateService.instant('webhooks.testSuccess'), detail: `HTTP ${result.statusCode}`, life: 5000 });
                } else {
                    this.messageService.add({ severity: 'error', summary: this.translateService.instant('webhooks.testFailed'), detail: result.error || `HTTP ${result.statusCode} ${result.statusText}`, life: 8000 });
                }
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: this.translateService.instant('common.error'), detail: err.error?.message || this.translateService.instant('webhooks.errors.testFailed') });
            }
        });
    }

    showLogs(webhook: Webhook) {
        this.selectedWebhook = webhook;
        this.displayLogsDialog = true;
        this.logsLoading = true;
        this.webhookService.getLogs(webhook._id!).subscribe({
            next: (res) => { this.logs = res.data; this.logsLoading = false; },
            error: () => { this.logsLoading = false; }
        });
    }

    getEventSeverity(event: string): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
        if (event.includes('failed') || event === 'test') return 'danger';
        if (event.includes('success')) return 'success';
        return 'info';
    }
}
