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

        authServiceSpy = jasmine.createSpyObj('AuthService', ['hasPermission']);

        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });
    });

    it('should allow access when user has certificates write permission', () => {
        authServiceSpy.hasPermission.and.returnValue(true);

        const result = TestBed.runInInjectionContext(() =>
            certManagerGuard({} as any, {} as any)
        );

        expect(result).toBeTrue();
        expect(authServiceSpy.hasPermission).toHaveBeenCalledWith('certificates', 'write');
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should redirect to access denied when user lacks certificates write permission', () => {
        authServiceSpy.hasPermission.and.returnValue(false);

        const result = TestBed.runInInjectionContext(() =>
            certManagerGuard({} as any, {} as any)
        );

        expect(result).toBeFalse();
        expect(authServiceSpy.hasPermission).toHaveBeenCalledWith('certificates', 'write');
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/access']);
    });
});
