import { AuthService } from '@/services/auth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from '../app/guards/auth.guard';
import { createRouterSpy } from './test-helpers';

describe('authGuard', () => {
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(() => {
        routerSpy = createRouterSpy('/');

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: Router, useValue: routerSpy }
            ]
        });
    });

    afterEach(() => {
        // Pulisci localStorage dopo ogni test
        sessionStorage.clear();
    });

    it('should allow access when token exists', () => {
        // Arrange
        sessionStorage.setItem('auth_token', 'valid-token');

        const authService = TestBed.inject(AuthService);
        authService.isAuthenticated.set(true);
        // Act
        const result = TestBed.runInInjectionContext(() =>
            authGuard({} as any, {} as any)
        );

        // Assert
        expect(result).toBeTrue();
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should redirect to login when token is missing', () => {
        // Arrange: Nessun token in localStorage

        // Act
        const result = TestBed.runInInjectionContext(() =>
            authGuard({} as any, {} as any)
        );

        // Assert
        expect(result).toBeFalse();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { returnUrl: undefined } });
    });
});
