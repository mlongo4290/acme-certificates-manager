import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AppTopbar } from '../app/layout/component/app.topbar';
import { LayoutService } from '../app/layout/service/layout.service';
import { AuthService } from '../app/services/auth.service';
import { createRouterSpy } from './test-helpers';

fdescribe('AppTopbar', () => {
    let component: AppTopbar;
    let fixture: ComponentFixture<AppTopbar>;
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let layoutServiceSpy: jasmine.SpyObj<LayoutService>;

    let translateServiceSpy: jasmine.SpyObj<TranslateService>;

    beforeEach(async () => {
        authServiceSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'logout']);
        routerSpy = createRouterSpy();

        const layoutConfigSignal = signal({ darkTheme: false, menuMode: 'static', preset: 'Aura', primary: 'blue', surface: 'slate' });
        layoutServiceSpy = jasmine.createSpyObj('LayoutService', [], {
            layoutConfig: layoutConfigSignal
        });

        translateServiceSpy = jasmine.createSpyObj('TranslateService', ['instant', 'addLangs', 'use'], {
            onLangChange: of({})
        });
        translateServiceSpy.instant.and.returnValue('translated');

        await TestBed.configureTestingModule({
            imports: [AppTopbar],
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: routerSpy },
                { provide: LayoutService, useValue: layoutServiceSpy },
                { provide: TranslateService, useValue: translateServiceSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(AppTopbar);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should return authentication status', () => {
        authServiceSpy.isAuthenticated.and.returnValue(true);

        expect(component.isAuthenticated).toBeTrue();
        expect(authServiceSpy.isAuthenticated).toHaveBeenCalled();
    });

    it('should toggle dark mode', () => {
        const initialDarkTheme = component.layoutService.layoutConfig().darkTheme;

        component.toggleDarkMode();

        expect(component.layoutService.layoutConfig().darkTheme).toBe(!initialDarkTheme);
    });

    it('should navigate to profile', () => {
        component.goToProfile();

        expect(routerSpy.navigate).toHaveBeenCalledWith(['/profile']);
    });

    it('should call logout', () => {
        component.logout();

        expect(authServiceSpy.logout).toHaveBeenCalled();
    });
});
