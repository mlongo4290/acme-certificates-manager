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
        const isAdminSpy = jasmine.createSpy('isAdmin').and.returnValue(false);

        authServiceSpy = jasmine.createSpyObj('AuthService', ['isAdmin'], {
            isAuthenticated: isAuthenticatedSignal
        });
        authServiceSpy.isAdmin = isAdminSpy;

        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });
    });

    it('should allow access when user is authenticated and is admin', () => {
        authServiceSpy.isAuthenticated.and.returnValue(true);
        authServiceSpy.isAdmin.and.returnValue(true);

        const result = TestBed.runInInjectionContext(() =>
            adminGuard({} as any, {} as any)
        );

        expect(result).toBeTrue();
        expect(authServiceSpy.isAdmin).toHaveBeenCalled();
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should redirect to access denied when user is not authenticated', () => {
        authServiceSpy.isAuthenticated.and.returnValue(false);
        authServiceSpy.isAdmin.and.returnValue(false);

        const result = TestBed.runInInjectionContext(() =>
            adminGuard({} as any, {} as any)
        );

        expect(result).toBeFalse();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/access']);
    });

    it('should redirect to access denied when user is authenticated but not admin', () => {
        authServiceSpy.isAuthenticated.and.returnValue(true);
        authServiceSpy.isAdmin.and.returnValue(false);

        const result = TestBed.runInInjectionContext(() =>
            adminGuard({} as any, {} as any)
        );

        expect(result).toBeFalse();
        expect(authServiceSpy.isAdmin).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/access']);
    });

    it('should check isAdmin specifically', () => {
        authServiceSpy.isAuthenticated.and.returnValue(true);
        authServiceSpy.isAdmin.and.returnValue(false);

        TestBed.runInInjectionContext(() =>
            adminGuard({} as any, {} as any)
        );

        expect(authServiceSpy.isAdmin).toHaveBeenCalled();
    });
});
