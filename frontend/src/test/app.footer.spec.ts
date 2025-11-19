import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslatePipe } from '@ngx-translate/core';
import { AppFooter } from '../app/layout/component/app.footer';
import { VERSION } from '../app/version';

describe('AppFooter', () => {
    let component: AppFooter;
    let fixture: ComponentFixture<AppFooter>;

    beforeEach(async () => {
        const translatePipeSpy = jasmine.createSpyObj('TranslatePipe', ['transform']);
        translatePipeSpy.transform.and.returnValue('translated');

        await TestBed.configureTestingModule({
            imports: [AppFooter],
            providers: [
                { provide: TranslatePipe, useValue: translatePipeSpy }
            ]
        }).overrideComponent(AppFooter, {
            remove: { imports: [TranslatePipe] },
            add: { providers: [{ provide: TranslatePipe, useValue: translatePipeSpy }] }
        }).compileComponents();

        fixture = TestBed.createComponent(AppFooter);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have version property from VERSION constant', () => {
        expect(component.version).toBe(VERSION);
    });

    it('should have correct GitHub URL', () => {
        expect(component.githubUrl).toBe('https://github.com/mlongo4290/acme-certificates-manager');
    });
});
