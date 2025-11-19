import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppLanguageSelector } from '../app/layout/component/app.languageselector';
import { LanguageService } from '../app/services/language.service';

describe('AppLanguageSelector', () => {
    let component: AppLanguageSelector;
    let fixture: ComponentFixture<AppLanguageSelector>;
    let languageServiceSpy: jasmine.SpyObj<LanguageService>;

    beforeEach(async () => {
        const currentLangSignal = signal('en');
        languageServiceSpy = jasmine.createSpyObj('LanguageService', ['changeLanguage', 'isFollowingSystemLanguage', 'currentLang']);
        languageServiceSpy.isFollowingSystemLanguage.and.returnValue(false);
        Object.assign(languageServiceSpy.currentLang, currentLangSignal);

        await TestBed.configureTestingModule({
            imports: [AppLanguageSelector],
            providers: [
                { provide: LanguageService, useValue: languageServiceSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(AppLanguageSelector);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have language options', () => {
        expect(component.languages).toEqual([
            { label: 'System', value: 'system' },
            { label: 'English', value: 'en' },
            { label: 'Italiano', value: 'it' }
        ]);
    });

    it('should return current language when not following system', () => {
        languageServiceSpy.isFollowingSystemLanguage.and.returnValue(false);

        expect(component.selectedLanguage()).toBe('en');
    });

    it('should return "system" when following system language', () => {
        languageServiceSpy.isFollowingSystemLanguage.and.returnValue(true);

        expect(component.selectedLanguage()).toBe('system');
    });

    it('should change language when changeLanguage is called', () => {
        component.changeLanguage('it');

        expect(languageServiceSpy.changeLanguage).toHaveBeenCalledWith('it');
    });
});
