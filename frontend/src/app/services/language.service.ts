import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private translate = inject(TranslateService);
    private primeNG = inject(PrimeNG);

    currentLang = signal<string>('en');
    followingSystemLanguage = signal<boolean>(this.checkIfFollowingSystem());

    constructor() {
        this.translate.addLangs(['en', 'it']);

        // Load language from storage or use browser default
        const loadedLang = this.loadLanguageFromStorage();

        this.translate.use(loadedLang).subscribe(() => {
            this.setPrimeNGTranslations(loadedLang);
        });
        this.currentLang.set(loadedLang);

        // Save language changes to localStorage
        effect(() => {
            const lang = this.currentLang();
            if (lang) {
                this.saveLanguageToStorage(lang);
            }
        });
    }

    private checkIfFollowingSystem(): boolean {
        const saved = localStorage.getItem('language');
        if (!saved) return true; // No saved language = follow system
        try {
            const parsed = JSON.parse(saved);
            return parsed.followSystemLanguage === true;
        } catch (e) {
            // Old format (just string) - not following system
            return false;
        }
    }

    private loadLanguageFromStorage(): string {
        try {
            const saved = localStorage.getItem('language');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // If it's an object with language property
                    if (parsed.language) {
                        return parsed.language;
                    }
                } catch {
                    // Old format: just a string
                    return saved;
                }
            } else {
                // First load - save default with followSystemLanguage flag
                const browserLang = this.translate.getBrowserLang();
                const systemLang = browserLang?.match(/en|it/) ? browserLang : 'en';
                localStorage.setItem('language', JSON.stringify({
                    followSystemLanguage: true,
                    language: systemLang
                }));
                return systemLang;
            }
        } catch (e) {
            console.error('Failed to load language from storage', e);
        }
        // Use browser language as default
        const browserLang = this.translate.getBrowserLang();
        return browserLang?.match(/en|it/) ? browserLang : 'en';
    }

    private saveLanguageToStorage(lang: string): void {
        try {
            let toSave: any = {
                language: lang
            };

            // Add followSystemLanguage flag only if currently following system
            if (this.followingSystemLanguage()) {
                toSave.followSystemLanguage = true;
            }

            localStorage.setItem('language', JSON.stringify(toSave));
        } catch (e) {
            console.error('Failed to save language to storage', e);
        }
    }

    changeLanguage(lang: string) {
        if (lang === 'system') {
            this.setLanguageToSystem();
            return;
        }

        // Manual selection - not following system
        this.followingSystemLanguage.set(false);

        this.translate.use(lang).subscribe(() => {
            this.setPrimeNGTranslations(lang);
        });
        this.currentLang.set(lang);
    }

    setLanguageToSystem() {
        this.followingSystemLanguage.set(true);

        const browserLang = this.translate.getBrowserLang();
        const systemLang = browserLang?.match(/en|it/) ? browserLang : 'en';

        this.translate.use(systemLang).subscribe(() => {
            this.setPrimeNGTranslations(systemLang);
        });
        this.currentLang.set(systemLang);
    }

    resetToSystem() {
        this.setLanguageToSystem();
    }

    isFollowingSystemLanguage(): boolean {
        return this.followingSystemLanguage();
    }

    getCurrentLang(): string {
        return this.translate.getCurrentLang();
    }

    private setPrimeNGTranslations(lang: string): void {
        this.translate.get('primeng').subscribe((translations: any) => {
            this.primeNG.setTranslation(translations);
        });
    }
}
