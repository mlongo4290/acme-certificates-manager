import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { errorInterceptor } from '../app/interceptors/error.interceptor';
import { AuthService } from '../app/services/auth.service';

describe('errorInterceptor', () => {
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let mockNext: jasmine.Spy<HttpHandlerFn>;

    beforeEach(() => {
        authServiceSpy = jasmine.createSpyObj('AuthService', ['logout']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate'], { url: '/dashboard' });

        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });
    });

    it('should call logout and navigate to login on 401 error', (done) => {
        const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
        mockNext = jasmine.createSpy('next').and.returnValue(throwError(() => error));

        const req = new HttpRequest('GET', '/api/test');

        TestBed.runInInjectionContext(() => {
            errorInterceptor(req, mockNext).subscribe({
                error: () => {
                    expect(authServiceSpy.logout).toHaveBeenCalled();
                    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login'], {
                        queryParams: { expired: 'true' }
                    });
                    done();
                }
            });
        });
    });

    it('should not redirect to login if already on login page', (done) => {
        const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
        mockNext = jasmine.createSpy('next').and.returnValue(throwError(() => error));
        Object.defineProperty(routerSpy, 'url', { get: () => '/auth/login' });

        const req = new HttpRequest('GET', '/api/test');

        TestBed.runInInjectionContext(() => {
            errorInterceptor(req, mockNext).subscribe({
                error: () => {
                    expect(authServiceSpy.logout).toHaveBeenCalled();
                    expect(routerSpy.navigate).not.toHaveBeenCalled();
                    done();
                }
            });
        });
    });

    it('should navigate to access page on 403 error', (done) => {
        const error = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
        mockNext = jasmine.createSpy('next').and.returnValue(throwError(() => error));

        const req = new HttpRequest('GET', '/api/test');

        TestBed.runInInjectionContext(() => {
            errorInterceptor(req, mockNext).subscribe({
                error: () => {
                    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/access']);
                    expect(authServiceSpy.logout).not.toHaveBeenCalled();
                    done();
                }
            });
        });
    });

    it('should propagate error after handling 401', (done) => {
        const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
        mockNext = jasmine.createSpy('next').and.returnValue(throwError(() => error));

        const req = new HttpRequest('GET', '/api/test');

        TestBed.runInInjectionContext(() => {
            errorInterceptor(req, mockNext).subscribe({
                error: (err) => {
                    expect(err.status).toBe(401);
                    done();
                }
            });
        });
    });

    it('should propagate error after handling 403', (done) => {
        const error = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
        mockNext = jasmine.createSpy('next').and.returnValue(throwError(() => error));

        const req = new HttpRequest('GET', '/api/test');

        TestBed.runInInjectionContext(() => {
            errorInterceptor(req, mockNext).subscribe({
                error: (err) => {
                    expect(err.status).toBe(403);
                    done();
                }
            });
        });
    });

    it('should propagate non-401/403 errors without handling', (done) => {
        const error = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });
        mockNext = jasmine.createSpy('next').and.returnValue(throwError(() => error));

        const req = new HttpRequest('GET', '/api/test');

        TestBed.runInInjectionContext(() => {
            errorInterceptor(req, mockNext).subscribe({
                error: (err) => {
                    expect(err.status).toBe(500);
                    expect(authServiceSpy.logout).not.toHaveBeenCalled();
                    expect(routerSpy.navigate).not.toHaveBeenCalled();
                    done();
                }
            });
        });
    });
});
