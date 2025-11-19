import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AppMenuitem } from '../app/layout/component/app.menuitem';
import { LayoutService } from '../app/layout/service/layout.service';
import { createRouterSpy } from './test-helpers';

describe('AppMenuitem', () => {
    let component: AppMenuitem;
    let fixture: ComponentFixture<AppMenuitem>;
    let layoutServiceSpy: jasmine.SpyObj<LayoutService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let menuSourceSubject: Subject<any>;
    let resetSourceSubject: Subject<void>;

    beforeEach(async () => {
        menuSourceSubject = new Subject();
        resetSourceSubject = new Subject();

        layoutServiceSpy = jasmine.createSpyObj('LayoutService', ['onMenuStateChange'], {
            menuSource$: menuSourceSubject.asObservable(),
            resetSource$: resetSourceSubject.asObservable()
        });

        routerSpy = createRouterSpy();
        routerSpy.isActive = jasmine.createSpy('isActive').and.returnValue(false);

        await TestBed.configureTestingModule({
            imports: [AppMenuitem],
            providers: [
                { provide: LayoutService, useValue: layoutServiceSpy },
                { provide: Router, useValue: routerSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(AppMenuitem);
        component = fixture.componentInstance;
        component.item = { label: 'Test Item' };
        component.index = 0;
        component.root = false;
        component.parentKey = '';
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with correct key', () => {
        component.ngOnInit();

        expect(component.key).toBe('0');
    });

    it('should build nested key when parentKey exists', () => {
        component.parentKey = 'parent';
        component.index = 2;

        component.ngOnInit();

        expect(component.key).toBe('parent-2');
    });

    it('should set active state when menuSource matches key', (done) => {
        component.ngOnInit();

        menuSourceSubject.next({ key: '0', routeEvent: true });

        setTimeout(() => {
            expect(component.active).toBeTrue();
            done();
        }, 10);
    });

    it('should deactivate when menuSource has different key', (done) => {
        component.active = true;
        component.ngOnInit();

        menuSourceSubject.next({ key: '1', routeEvent: false });

        setTimeout(() => {
            expect(component.active).toBeFalse();
            done();
        }, 10);
    });

    it('should reset active state on reset signal', () => {
        component.active = true;
        component.ngOnInit();

        resetSourceSubject.next();

        expect(component.active).toBeFalse();
    });

    it('should update active state from route when routerLink exists', () => {
        component.item = { label: 'Test', routerLink: ['/test'] };
        routerSpy.isActive = jasmine.createSpy('isActive').and.returnValue(true);

        component.ngOnInit();
        component.updateActiveStateFromRoute();

        expect(routerSpy.isActive).toHaveBeenCalledWith('/test', {
            paths: 'exact',
            queryParams: 'ignored',
            matrixParams: 'ignored',
            fragment: 'ignored'
        });
        expect(layoutServiceSpy.onMenuStateChange).toHaveBeenCalledWith({ key: '0', routeEvent: true });
    });

    it('should toggle active state when item has children', () => {
        component.item = { label: 'Parent', items: [{ label: 'Child' }] };
        component.active = false;

        const event = new Event('click');
        component.itemClick(event);

        expect(component.active).toBeTrue();
    });

    it('should execute command when item has command', () => {
        const commandSpy = jasmine.createSpy('command');
        component.item = { label: 'Test', command: commandSpy };

        const event = new Event('click');
        component.itemClick(event);

        expect(commandSpy).toHaveBeenCalledWith({ originalEvent: event, item: component.item });
    });

    it('should prevent default when item is disabled', () => {
        component.item = { label: 'Test', disabled: true };

        const event = jasmine.createSpyObj('Event', ['preventDefault']);
        component.itemClick(event);

        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should notify layout service on item click', () => {
        component.item = { label: 'Test' };
        component.ngOnInit();

        const event = new Event('click');
        component.itemClick(event);

        expect(layoutServiceSpy.onMenuStateChange).toHaveBeenCalledWith({ key: '0' });
    });

    it('should return correct activeClass value', () => {
        component.active = true;
        component.root = false;

        expect(component.activeClass).toBeTrue();

        component.root = true;
        expect(component.activeClass).toBeFalse();

        component.active = false;
        component.root = false;
        expect(component.activeClass).toBeFalse();
    });

    it('should unsubscribe on destroy', () => {
        component.ngOnInit();
        const subscription = (component as any).menuSourceSubscription;
        spyOn(subscription, 'unsubscribe');

        component.ngOnDestroy();

        expect(subscription.unsubscribe).toHaveBeenCalled();
    });
});
