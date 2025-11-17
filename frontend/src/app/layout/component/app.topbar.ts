import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { StyleClassModule } from 'primeng/styleclass';
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../service/layout.service';
import { AppConfigurator } from './app.configurator';
import { AppLanguageSelector } from './app.languageselector';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, StyleClassModule, AppConfigurator, AppLanguageSelector, TranslateModule, FormsModule],
    templateUrl: './app.topbar.html'
})
export class AppTopbar {

    constructor(
        public layoutService: LayoutService,
        private authService: AuthService,
        private router: Router
    ) {
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

    logout() {
        this.authService.logout();
    }
}