import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
    selector: 'app-email-required-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        DialogModule,
        InputTextModule,
        ButtonModule,
    ],
    templateUrl: './email-required-dialog.html'
})
export class EmailRequiredDialogComponent implements OnInit {
    private authService = inject(AuthService);
    private userService = inject(UserService)
    private messageService = inject(MessageService);
    private translateService = inject(TranslateService);

    displayDialog: boolean = false;
    email: string = '';
    isLoading: boolean = false;

    ngOnInit() {
        // Check if user is local and doesn't have email
        const user = this.authService.currentUser();
        if (user && user.authProvider === 'local') {
            this.userService.getCurrentUser().subscribe({
                next: (userData: any) => {
                    if (!userData.email) {
                        this.displayDialog = true;
                    }
                },
                error: (error: any) => {
                }
            });
        }
    }

    saveEmail(): void {
        if (!this.email) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('auth.errors.emailRequired')
            });
            return;
        }

        const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
        if (!emailRegex.test(this.email)) {
            this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant('common.error'),
                detail: this.translateService.instant('auth.errors.invalidEmailFormat')
            });
            return;
        }

        this.isLoading = true;

        this.userService.updateEmail(this.email, this.translateService.getCurrentLang()).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translateService.instant('common.success'),
                    detail: this.translateService.instant('auth.success.emailUpdated')
                });
                this.displayDialog = false;
                this.isLoading = false;
            },
            error: (error: any) => {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translateService.instant('common.error'),
                    detail: error.error?.message || this.translateService.instant('auth.errors.emailUpdateFailed')
                });
                this.isLoading = false;
            }
        });
    }
}
