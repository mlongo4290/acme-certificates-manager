import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AppSidebar } from '../app/layout/component/app.sidebar';

describe('AppSidebar', () => {
    let component: AppSidebar;
    let fixture: ComponentFixture<AppSidebar>;

    let translateServiceSpy: jasmine.SpyObj<TranslateService>;

    provideHttpClient();
    provideHttpClientTesting();

    beforeEach(async () => {
        translateServiceSpy = jasmine.createSpyObj('TranslateService', ['instant'], {
            onLangChange: of({})
        });
        translateServiceSpy.instant.and.returnValue('translated');

        await TestBed.configureTestingModule({
            imports: [AppSidebar],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: TranslateService, useValue: translateServiceSpy }
            ]
        }).compileComponents();


        fixture = TestBed.createComponent(AppSidebar);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have ElementRef injected', () => {
        expect(component.el).toBeDefined();
        expect(component.el.nativeElement).toBeDefined();
    });
});
