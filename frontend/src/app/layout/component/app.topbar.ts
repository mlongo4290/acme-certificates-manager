import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { StyleClassModule } from 'primeng/styleclass';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { JobService, RunningJob } from '../../services/job.service';
import { LayoutService } from '../service/layout.service';
import { AppConfigurator } from './app.configurator';
import { AppLanguageSelector } from './app.languageselector';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, StyleClassModule, AppConfigurator, AppLanguageSelector, TranslateModule, FormsModule],
    templateUrl: './app.topbar.html'
})
export class AppTopbar implements OnInit, OnDestroy {
    runningJobs: RunningJob[] = [];
    private jobSub?: Subscription;

    get runningJobCount() { return this.runningJobs.length; }

    constructor(
        public layoutService: LayoutService,
        private authService: AuthService,
        private jobService: JobService,
        private router: Router
    ) {}

    ngOnInit() {
        this.jobSub = this.jobService.runningJobs$.subscribe(jobs => this.runningJobs = jobs);
        this.jobService.syncFromBackend();
    }

    ngOnDestroy() {
        this.jobSub?.unsubscribe();
    }

    get isAuthenticated(): boolean {
        return this.authService.isAuthenticated();
    }

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({ ...state, darkTheme: !state.darkTheme }));
    }

    goToProfile() {
        this.router.navigate(['/profile']);
    }

    goToJobs() {
        this.router.navigate(['/jobs']);
    }

    logout() {
        this.authService.logout();
    }
}