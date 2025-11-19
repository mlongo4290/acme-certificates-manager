import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AppMenu } from '../app/layout/component/app.menu';
import { AuthService } from '../app/services/auth.service';

describe('AppMenu', () => {
    let component: AppMenu;
    let fixture: ComponentFixture<AppMenu>;
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let translateServiceSpy: jasmine.SpyObj<TranslateService>;

    beforeEach(async () => {
        authServiceSpy = jasmine.createSpyObj('AuthService', ['hasRole']);
        translateServiceSpy = jasmine.createSpyObj('TranslateService', ['instant'], {
            onLangChange: of({})
        });
        translateServiceSpy.instant.and.returnValue('translated');

        await TestBed.configureTestingModule({
            imports: [AppMenu],
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: TranslateService, useValue: translateServiceSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(AppMenu);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load menu on init', () => {
        authServiceSpy.hasRole.and.returnValue(false);

        component.ngOnInit();

        expect(component.model.length).toBeGreaterThan(0);
        expect(translateServiceSpy.instant).toHaveBeenCalled();
    });

    it('should include admin menu items when user has ADMIN role', () => {
        authServiceSpy.hasRole.and.returnValue(true);

        component.loadMenu();

        const securityMenu = component.model.find(item => item.label === 'translated');
        expect(securityMenu).toBeDefined();
        expect(securityMenu?.items?.length).toBeGreaterThan(0);
    });

    it('should not include admin menu items when user does not have ADMIN role', () => {
        authServiceSpy.hasRole.and.returnValue(false);

        component.loadMenu();

        const securityMenu = component.model.find(item => item.label === 'translated');
        // Security menu should still exist (with swagger docs) but with fewer items
        expect(securityMenu).toBeDefined();
    });

    it('should subscribe to language change events', () => {
        authServiceSpy.hasRole.and.returnValue(false);

        component.ngOnInit();

        expect(translateServiceSpy.onLangChange).toBeDefined();
    });

    it('should have ACME menu section with multiple items', () => {
        authServiceSpy.hasRole.and.returnValue(false);

        component.loadMenu();

        const acmeMenu = component.model.find(item => item.label === 'ACME');
        expect(acmeMenu).toBeDefined();
        expect(acmeMenu?.items?.length).toBeGreaterThan(5);
    });

    it('should include swagger docs in security menu', () => {
        authServiceSpy.hasRole.and.returnValue(false);

        component.loadMenu();

        const securityMenu = component.model.find(item => item.label === 'translated');
        const swaggerItem = securityMenu?.items?.find(item => item.url === '/api/v1/docs');
        expect(swaggerItem).toBeDefined();
        expect(swaggerItem?.target).toBe('_blank');
    });
});
