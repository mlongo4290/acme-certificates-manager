import { NO_ERRORS_SCHEMA, PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { of } from 'rxjs';
import { AppConfigurator } from '../app/layout/component/app.configurator';
import { LayoutService } from '../app/layout/service/layout.service';
import { createRouterSpy } from './test-helpers';

describe('AppConfigurator', () => {
    let component: AppConfigurator;
    let fixture: ComponentFixture<AppConfigurator>;
    let layoutServiceSpy: jasmine.SpyObj<LayoutService>;
    let translateServiceSpy: jasmine.SpyObj<TranslateService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        const layoutConfigSignal = signal({
            darkTheme: false,
            menuMode: 'static',
            preset: 'Aura',
            primary: 'blue',
            surface: 'slate',
            followSystemTheme: false
        });

        const followingSystemThemeSignal = signal(false);

        layoutServiceSpy = jasmine.createSpyObj('LayoutService', ['setDarkModeToSystem', 'isFollowingSystemTheme'], {
            layoutConfig: layoutConfigSignal,
            followingSystemTheme: followingSystemThemeSignal
        });
        layoutServiceSpy.isFollowingSystemTheme.and.returnValue(false);

        translateServiceSpy = jasmine.createSpyObj('TranslateService', ['instant'], {
            onLangChange: of({})
        });
        translateServiceSpy.instant.and.returnValue('translated');

        routerSpy = createRouterSpy();
        Object.defineProperty(routerSpy, 'url', { get: () => '/dashboard' });

        await TestBed.configureTestingModule({
            imports: [AppConfigurator],
            providers: [
                { provide: LayoutService, useValue: layoutServiceSpy },
                { provide: TranslateService, useValue: translateServiceSpy },
                { provide: Router, useValue: routerSpy },
                { provide: PrimeNG, useValue: {} },
                { provide: PLATFORM_ID, useValue: 'browser' }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(AppConfigurator);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with preset options', () => {
        expect(component.presets).toContain('Aura');
        expect(component.presets).toContain('Lara');
        expect(component.presets).toContain('Nora');
    });

    it('should hide menu mode button when on auth page', () => {
        Object.defineProperty(routerSpy, 'url', { get: () => '/auth/login' });
        const newComponent = new AppConfigurator();
        (newComponent as any).router = routerSpy;

        expect(newComponent.showMenuModeButton()).toBeFalse();
    });

    it('should show menu mode button when not on auth page', () => {
        expect(component.showMenuModeButton()).toBeTrue();
    });

    it('should have theme options with correct icons', () => {
        expect(component.themeOptions.length).toBe(3);
        expect(component.themeOptions[0].value).toBe('system');
        expect(component.themeOptions[1].value).toBe('light');
        expect(component.themeOptions[2].value).toBe('dark');
    });

    it('should return "system" when following system theme', () => {
        layoutServiceSpy.isFollowingSystemTheme.and.returnValue(true);

        expect(component.selectedTheme()).toBe('system');
    });

    it('should return current theme when not following system', () => {
        layoutServiceSpy.isFollowingSystemTheme.and.returnValue(false);
        component.layoutService.layoutConfig().darkTheme = false;

        expect(component.selectedTheme()).toBe('light');
    });

    it('should update primary color', () => {
        const updateSpy = jasmine.createSpy('update');
        Object.defineProperty(layoutServiceSpy.layoutConfig, 'update', { value: updateSpy, writable: true });

        const event = { stopPropagation: jasmine.createSpy() };
        component.updateColors(event, 'primary', { name: 'green' });

        expect(updateSpy).toHaveBeenCalledWith(jasmine.any(Function));
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should update surface color', () => {
        const updateSpy = jasmine.createSpy('update');
        Object.defineProperty(layoutServiceSpy.layoutConfig, 'update', { value: updateSpy, writable: true });

        const event = { stopPropagation: jasmine.createSpy() };
        component.updateColors(event, 'surface', { name: 'zinc', palette: {} });

        expect(updateSpy).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('should change menu mode', () => {
        const updateSpy = jasmine.createSpy('update');
        Object.defineProperty(layoutServiceSpy.layoutConfig, 'update', { value: updateSpy, writable: true });

        component.onMenuModeChange('overlay');

        expect(updateSpy).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('should set theme to system', () => {
        component.onThemeChange('system');

        expect(layoutServiceSpy.setDarkModeToSystem).toHaveBeenCalled();
    });

    it('should set theme to dark manually', () => {
        const updateSpy = jasmine.createSpy('update');
        Object.defineProperty(layoutServiceSpy.layoutConfig, 'update', { value: updateSpy, writable: true });
        const setSpy = jasmine.createSpy('set');
        Object.defineProperty(layoutServiceSpy.followingSystemTheme, 'set', { value: setSpy, writable: true });

        component.onThemeChange('dark');

        expect(setSpy).toHaveBeenCalledWith(false);
        expect(updateSpy).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('should set theme to light manually', () => {
        const updateSpy = jasmine.createSpy('update');
        Object.defineProperty(layoutServiceSpy.layoutConfig, 'update', { value: updateSpy, writable: true });
        const setSpy = jasmine.createSpy('set');
        Object.defineProperty(layoutServiceSpy.followingSystemTheme, 'set', { value: setSpy, writable: true });

        component.onThemeChange('light');

        expect(setSpy).toHaveBeenCalledWith(false);
        expect(updateSpy).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('should have surface palette options', () => {
        expect(component.surfaces.length).toBeGreaterThan(5);
        expect(component.surfaces[0].name).toBe('slate');
    });

    it('should generate primary colors from preset', () => {
        const colors = component.primaryColors();

        expect(colors.length).toBeGreaterThan(10);
        expect(colors[0].name).toBe('noir');
    });

    it('should update translations on language change', () => {
        component.ngOnInit();

        expect(component.themeOptions[0].label).toBe('translated');
        expect(component.menuModeOptions[0].label).toBe('translated');
    });

    it('should get preset extension for noir color', () => {
        component.layoutService.layoutConfig().primary = 'noir';

        const ext = component.getPresetExt();

        expect(ext.semantic.primary).toBeDefined();
        expect((ext.semantic.primary as any)[50]).toBe('{surface.50}');
    }); it('should get preset extension for Nora preset', () => {
        component.layoutService.layoutConfig().preset = 'Nora';
        component.layoutService.layoutConfig().primary = 'blue';

        const ext = component.getPresetExt();

        expect(ext.semantic.colorScheme.light.primary.color).toBe('{primary.600}');
    });

    it('should get preset extension for standard preset', () => {
        component.layoutService.layoutConfig().preset = 'Aura';
        component.layoutService.layoutConfig().primary = 'green';

        const ext = component.getPresetExt();

        expect(ext.semantic.colorScheme.light.primary.color).toBe('{primary.500}');
    });
});
