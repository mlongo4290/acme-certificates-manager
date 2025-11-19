import { NO_ERRORS_SCHEMA, Renderer2, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AppLayout } from '../app/layout/component/app.layout';
import { LayoutService } from '../app/layout/service/layout.service';
import { createRouterSpy } from './test-helpers';

describe('AppLayout', () => {
    let component: AppLayout;
    let fixture: ComponentFixture<AppLayout>;
    let layoutServiceSpy: jasmine.SpyObj<LayoutService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let rendererSpy: jasmine.SpyObj<Renderer2>;
    let overlayOpenSubject: Subject<void>;
    let routerEventsSubject: Subject<any>;

    beforeEach(async () => {
        overlayOpenSubject = new Subject();
        routerEventsSubject = new Subject();

        const layoutStateSignal = signal({
            staticMenuMobileActive: false,
            overlayMenuActive: false,
            menuHoverActive: false,
            staticMenuDesktopInactive: false
        });

        layoutServiceSpy = jasmine.createSpyObj('LayoutService', [], {
            overlayOpen$: overlayOpenSubject.asObservable(),
            layoutState: layoutStateSignal,
            layoutConfig: jasmine.createSpy().and.returnValue({ menuMode: 'static' })
        });

        routerSpy = createRouterSpy();
        Object.defineProperty(routerSpy, 'events', { get: () => routerEventsSubject.asObservable() });

        rendererSpy = jasmine.createSpyObj('Renderer2', ['listen', 'removeClass', 'addClass']);
        rendererSpy.listen.and.returnValue(() => { });

        await TestBed.configureTestingModule({
            imports: [AppLayout],
            providers: [
                { provide: LayoutService, useValue: layoutServiceSpy },
                { provide: Router, useValue: routerSpy },
                { provide: Renderer2, useValue: rendererSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(AppLayout);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should subscribe to overlay open events on init', () => {
        component.ngOnInit();

        overlayOpenSubject.next();

        expect(rendererSpy.listen).toHaveBeenCalledWith('document', 'click', jasmine.any(Function) as any);
    });

    it('should hide menu on navigation end', () => {
        spyOn(component, 'hideMenu');

        component.ngOnInit();
        routerEventsSubject.next(new NavigationEnd(1, '/test', '/test'));

        expect(component.hideMenu).toHaveBeenCalled();
    });

    it('should detect outside clicks correctly', () => {
        const sidebar = document.createElement('div');
        sidebar.className = 'layout-sidebar';
        const topbar = document.createElement('button');
        topbar.className = 'layout-menu-button';
        document.body.appendChild(sidebar);
        document.body.appendChild(topbar);

        const outsideElement = document.createElement('div');
        document.body.appendChild(outsideElement);

        const outsideEvent = { target: outsideElement } as any;
        const insideEvent = { target: sidebar } as any;

        expect(component.isOutsideClicked(outsideEvent)).toBeTrue();
        expect(component.isOutsideClicked(insideEvent)).toBeFalse();

        document.body.removeChild(sidebar);
        document.body.removeChild(topbar);
        document.body.removeChild(outsideElement);
    });

    it('should update layout state when hiding menu', () => {
        const updateSpy = jasmine.createSpy('update');
        Object.defineProperty(layoutServiceSpy.layoutState, 'update', { value: updateSpy, writable: true });

        component.hideMenu();

        expect(updateSpy).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('should block body scroll', () => {
        component.blockBodyScroll();

        expect(document.body.classList.contains('blocked-scroll')).toBeTrue();

        component.unblockBodyScroll();
    });

    it('should unblock body scroll', () => {
        document.body.classList.add('blocked-scroll');

        component.unblockBodyScroll();

        expect(document.body.classList.contains('blocked-scroll')).toBeFalse();
    });

    it('should compute container classes correctly', () => {
        const layoutConfigSpy = jasmine.createSpy().and.returnValue({ menuMode: 'overlay' });
        Object.defineProperty(layoutServiceSpy, 'layoutConfig', { value: layoutConfigSpy });

        const classes = component.containerClass;

        expect(classes['layout-overlay']).toBeTrue();
    });

    it('should unsubscribe on destroy', () => {
        component.ngOnInit();
        const subscription = (component as any).overlayMenuOpenSubscription;
        spyOn(subscription, 'unsubscribe');

        component.ngOnDestroy();

        expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    it('should remove click listener on destroy if exists', () => {
        component.ngOnInit();
        overlayOpenSubject.next();

        const listener = component.menuOutsideClickListener;
        expect(listener).toBeDefined();

        component.ngOnDestroy();

        expect(component.menuOutsideClickListener).toBeNull();
    });
});
