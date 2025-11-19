import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { adminGuard } from '../app/guards/admin.guard';
import { AuthService } from '../app/services/auth.service';
import { createRouterSpy } from './test-helpers';

describe('adminGuard', () => {
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

    it('should allow access when user is authenticated and has ADMIN role', () => {
        authServiceSpy.isAuthenticated.and.returnValue(true);
        authServiceSpy.hasRole.and.returnValue(true);

        const result = TestBed.runInInjectionContext(() =>
            adminGuard({} as any, {} as any)
        );

        expect(result).toBeTrue();
        expect(authServiceSpy.hasRole).toHaveBeenCalledWith('ADMIN');
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should redirect to access denied when user is not authenticated', () => {
        authServiceSpy.isAuthenticated.and.returnValue(false);
        authServiceSpy.hasRole.and.returnValue(false);

        const result = TestBed.runInInjectionContext(() =>
            adminGuard({} as any, {} as any)
        );

        expect(result).toBeFalse();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/access']);
    });

    it('should redirect to access denied when user is authenticated but not ADMIN', () => {
        authServiceSpy.isAuthenticated.and.returnValue(true);
        authServiceSpy.hasRole.and.returnValue(false);

        const result = TestBed.runInInjectionContext(() =>
            adminGuard({} as any, {} as any)
        );

        expect(result).toBeFalse();
        expect(authServiceSpy.hasRole).toHaveBeenCalledWith('ADMIN');
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/access']);
    });

    it('should check for ADMIN role specifically', () => {
        authServiceSpy.isAuthenticated.and.returnValue(true);
        authServiceSpy.hasRole.and.returnValue(false);

        TestBed.runInInjectionContext(() =>
            adminGuard({} as any, {} as any)
        );

        expect(authServiceSpy.hasRole).toHaveBeenCalledWith('ADMIN');
    });
});
