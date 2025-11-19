import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { certManagerGuard } from '../app/guards/cert-manager.guard';
import { AuthService } from '../app/services/auth.service';
import { createRouterSpy } from './test-helpers';

describe('certManagerGuard', () => {
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(() => {
        routerSpy = createRouterSpy('/');

        const isAuthenticatedSignal = jasmine.createSpy('isAuthenticated').and.returnValue(false);
        const hasRoleSpy = jasmine.createSpy('hasRole').and.returnValue(false);

        authServiceSpy = jasmine.createSpyObj('AuthService', ['hasRole'], {
            isAuthenticated: isAuthenticatedSignal
        });
        authServiceSpy.hasRole = hasRoleSpy;

        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });
    });

    it('should allow access when user has ADMIN role', () => {
        authServiceSpy.hasRole.and.callFake((role: string) => role === 'ADMIN');

        const result = TestBed.runInInjectionContext(() =>
            certManagerGuard({} as any, {} as any)
        );

        expect(result).toBeTrue();
        expect(authServiceSpy.hasRole).toHaveBeenCalledWith('ADMIN');
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should allow access when user has CERT_MANAGER role', () => {
        authServiceSpy.hasRole.and.callFake((role: string) => role === 'CERT_MANAGER');

        const result = TestBed.runInInjectionContext(() =>
            certManagerGuard({} as any, {} as any)
        );

        expect(result).toBeTrue();
        expect(authServiceSpy.hasRole).toHaveBeenCalledWith('ADMIN');
        expect(authServiceSpy.hasRole).toHaveBeenCalledWith('CERT_MANAGER');
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should redirect to access denied when user has neither ADMIN nor CERT_MANAGER role', () => {
        authServiceSpy.hasRole.and.returnValue(false);

        const result = TestBed.runInInjectionContext(() =>
            certManagerGuard({} as any, {} as any)
        );

        expect(result).toBeFalse();
        expect(authServiceSpy.hasRole).toHaveBeenCalledWith('ADMIN');
        expect(authServiceSpy.hasRole).toHaveBeenCalledWith('CERT_MANAGER');
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/access']);
    });

    it('should redirect to access denied when user is not authenticated', () => {
        authServiceSpy.isAuthenticated.and.returnValue(false);
        authServiceSpy.hasRole.and.returnValue(false);

        const result = TestBed.runInInjectionContext(() =>
            certManagerGuard({} as any, {} as any)
        );

        expect(result).toBeFalse();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/access']);
    });
});
