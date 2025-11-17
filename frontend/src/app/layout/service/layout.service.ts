import { Injectable, computed, effect, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface layoutConfig {
    preset?: string;
    primary?: string;
    surface?: string | undefined | null;
    darkTheme?: boolean;
    menuMode?: string;
}

interface LayoutState {
    staticMenuDesktopInactive?: boolean;
    overlayMenuActive?: boolean;
    configSidebarVisible?: boolean;
    staticMenuMobileActive?: boolean;
    menuHoverActive?: boolean;
}

interface MenuChangeEvent {
    key: string;
    routeEvent?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    _config: layoutConfig = {
        preset: 'Aura',
        primary: 'emerald',
        surface: null,
        darkTheme: false,
        menuMode: 'static'
    };

    _state: LayoutState = {
        staticMenuDesktopInactive: false,
        overlayMenuActive: false,
        configSidebarVisible: false,
        staticMenuMobileActive: false,
        menuHoverActive: false
    };

    layoutConfig = signal<layoutConfig>(this.loadConfigFromStorage());

    layoutState = signal<LayoutState>(this._state);

    followingSystemTheme = signal<boolean>(this.checkIfFollowingSystem());

    private configUpdate = new Subject<layoutConfig>();

    private overlayOpen = new Subject<any>();

    private menuSource = new Subject<MenuChangeEvent>();

    private resetSource = new Subject();

    menuSource$ = this.menuSource.asObservable();

    resetSource$ = this.resetSource.asObservable();

    configUpdate$ = this.configUpdate.asObservable();

    overlayOpen$ = this.overlayOpen.asObservable();

    theme = computed(() => (this.layoutConfig()?.darkTheme ? 'light' : 'dark'));

    isSidebarActive = computed(() => this.layoutState().overlayMenuActive || this.layoutState().staticMenuMobileActive);

    isDarkTheme = computed(() => this.layoutConfig().darkTheme);

    getPrimary = computed(() => this.layoutConfig().primary);

    getSurface = computed(() => this.layoutConfig().surface);

    isOverlay = computed(() => this.layoutConfig().menuMode === 'overlay');

    transitionComplete = signal<boolean>(false);

    private initialized = false;

    constructor() {
        // Apply saved theme immediately
        this.toggleDarkMode(this.layoutConfig());

        effect(() => {
            const config = this.layoutConfig();
            if (config) {
                this.onConfigUpdate();
                this.saveConfigToStorage(config);
            }
        });

        effect(() => {
            const config = this.layoutConfig();

            if (!this.initialized || !config) {
                this.initialized = true;
                return;
            }

            this.handleDarkModeTransition(config);
        });
    }

    private loadConfigFromStorage(): layoutConfig {
        try {
            const saved = localStorage.getItem('layoutConfig');
            if (saved) {
                const parsed = JSON.parse(saved);
                // If darkTheme is not explicitly set, use system preference
                if (parsed.darkTheme === undefined) {
                    parsed.darkTheme = this.getSystemDarkMode();
                }
                return { ...this._config, ...parsed };
            } else {
                // First load - save default config with followSystemTheme flag
                const systemDarkMode = this.getSystemDarkMode();
                const defaultConfig = {
                    ...this._config,
                    darkTheme: systemDarkMode,
                    followSystemTheme: true
                };
                localStorage.setItem('layoutConfig', JSON.stringify({
                    followSystemTheme: true,
                    darkTheme: systemDarkMode
                }));
                return defaultConfig;
            }
        } catch (e) {
            console.error('Failed to load layout config from storage', e);
        }
        // Use system preference as default
        return { ...this._config, darkTheme: this.getSystemDarkMode() };
    }

    private saveConfigToStorage(config: layoutConfig): void {
        try {
            let toSave: any = {
                darkTheme: config.darkTheme
            };

            // Add followSystemTheme flag only if currently following system
            if (this.followingSystemTheme()) {
                toSave.followSystemTheme = true;
            }

            localStorage.setItem('layoutConfig', JSON.stringify(toSave));
        } catch (e) {
            console.error('Failed to save layout config to storage', e);
        }
    } private getSystemDarkMode(): boolean {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    private checkIfFollowingSystem(): boolean {
        const saved = localStorage.getItem('layoutConfig');
        if (!saved) return true;
        try {
            const config = JSON.parse(saved);
            return config.followSystemTheme === true;
        } catch (e) {
            return true;
        }
    }

    setDarkModeToSystem(): void {
        const systemDarkMode = this.getSystemDarkMode();

        // Save a flag to indicate we're following system
        const saved = localStorage.getItem('layoutConfig');
        if (saved) {
            const config = JSON.parse(saved);
            delete config.darkTheme;
            config.followSystemTheme = true;
            localStorage.setItem('layoutConfig', JSON.stringify(config));
        } else {
            localStorage.setItem('layoutConfig', JSON.stringify({ followSystemTheme: true }));
        }

        // Update signal
        this.followingSystemTheme.set(true);

        // Update current state to match system
        this.layoutConfig.update((state) => ({ ...state, darkTheme: systemDarkMode }));

        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            // Remove old listener if exists
            if (this.systemThemeListener) {
                mediaQuery.removeEventListener('change', this.systemThemeListener);
            }
            // Add new listener
            this.systemThemeListener = (e: MediaQueryListEvent) => {
                this.layoutConfig.update((state) => ({ ...state, darkTheme: e.matches }));
            };
            mediaQuery.addEventListener('change', this.systemThemeListener);
        }
    }

    private systemThemeListener?: (e: MediaQueryListEvent) => void;

    isFollowingSystemTheme(): boolean {
        return this.followingSystemTheme();
    }

    resetColorScheme(): void {
        this.layoutConfig.update((state) => ({
            ...state,
            preset: 'Aura',
            primary: 'emerald',
            surface: null
        }));
    }

    resetAll(): void {
        localStorage.removeItem('layoutConfig');
        this.layoutConfig.set({
            ...this._config,
            darkTheme: this.getSystemDarkMode()
        });
    }

    private handleDarkModeTransition(config: layoutConfig): void {
        if ((document as any).startViewTransition) {
            this.startViewTransition(config);
        } else {
            this.toggleDarkMode(config);
            this.onTransitionEnd();
        }
    }

    private startViewTransition(config: layoutConfig): void {
        const transition = (document as any).startViewTransition(() => {
            this.toggleDarkMode(config);
        });

        transition.ready
            .then(() => {
                this.onTransitionEnd();
            })
            .catch(() => { });
    }

    toggleDarkMode(config?: layoutConfig): void {
        const _config = config || this.layoutConfig();
        if (_config.darkTheme) {
            document.documentElement.classList.add('app-dark');
        } else {
            document.documentElement.classList.remove('app-dark');
        }
    }

    private onTransitionEnd() {
        this.transitionComplete.set(true);
        setTimeout(() => {
            this.transitionComplete.set(false);
        });
    }

    onMenuToggle() {
        if (this.isOverlay()) {
            this.layoutState.update((prev) => ({ ...prev, overlayMenuActive: !this.layoutState().overlayMenuActive }));

            if (this.layoutState().overlayMenuActive) {
                this.overlayOpen.next(null);
            }
        }

        if (this.isDesktop()) {
            this.layoutState.update((prev) => ({ ...prev, staticMenuDesktopInactive: !this.layoutState().staticMenuDesktopInactive }));
        } else {
            this.layoutState.update((prev) => ({ ...prev, staticMenuMobileActive: !this.layoutState().staticMenuMobileActive }));

            if (this.layoutState().staticMenuMobileActive) {
                this.overlayOpen.next(null);
            }
        }
    }

    isDesktop() {
        return window.innerWidth > 991;
    }

    isMobile() {
        return !this.isDesktop();
    }

    onConfigUpdate() {
        this._config = { ...this.layoutConfig() };
        this.configUpdate.next(this.layoutConfig());
    }

    onMenuStateChange(event: MenuChangeEvent) {
        this.menuSource.next(event);
    }

    reset() {
        this.resetSource.next(true);
    }
}
