import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { authInterceptor } from '../app/interceptors/auth.interceptor';
import { AuthService } from '../app/services/auth.service';

describe('authInterceptor', () => {
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let mockNext: jasmine.Spy<HttpHandlerFn>;

    beforeEach(() => {
        authServiceSpy = jasmine.createSpyObj('AuthService', ['getToken']);
        mockNext = jasmine.createSpy('next').and.returnValue(of({}));

        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: authServiceSpy }
            ]
        });
    });

    it('should add Authorization header when token exists', () => {
        authServiceSpy.getToken.and.returnValue('test-token');

        const req = new HttpRequest('GET', '/api/test');

        TestBed.runInInjectionContext(() => {
            authInterceptor(req, mockNext);
        });

        const modifiedReq = mockNext.calls.mostRecent().args[0] as HttpRequest<any>;
        expect(modifiedReq.headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('should not add Authorization header when token is null', () => {
        authServiceSpy.getToken.and.returnValue(null);

        const req = new HttpRequest('GET', '/api/test');

        TestBed.runInInjectionContext(() => {
            authInterceptor(req, mockNext);
        });

        const modifiedReq = mockNext.calls.mostRecent().args[0] as HttpRequest<any>;
        expect(modifiedReq.headers.has('Authorization')).toBeFalse();
    });

    it('should skip adding token for login requests', () => {
        authServiceSpy.getToken.and.returnValue('test-token');

        const req = new HttpRequest('POST', '/auth/login', {});

        TestBed.runInInjectionContext(() => {
            authInterceptor(req, mockNext);
        });

        const modifiedReq = mockNext.calls.mostRecent().args[0] as HttpRequest<any>;
        expect(modifiedReq.headers.has('Authorization')).toBeFalse();
    });

    it('should skip adding token for login-related URLs', () => {
        authServiceSpy.getToken.and.returnValue('test-token');

        const req = new HttpRequest('POST', 'http://example.com/auth/login', {});

        TestBed.runInInjectionContext(() => {
            authInterceptor(req, mockNext);
        });

        const modifiedReq = mockNext.calls.mostRecent().args[0] as HttpRequest<any>;
        expect(modifiedReq.headers.has('Authorization')).toBeFalse();
    });

    it('should add token for non-login requests', () => {
        authServiceSpy.getToken.and.returnValue('valid-token');

        const req = new HttpRequest('GET', '/api/certificates');

        TestBed.runInInjectionContext(() => {
            authInterceptor(req, mockNext);
        });

        const modifiedReq = mockNext.calls.mostRecent().args[0] as HttpRequest<any>;
        expect(modifiedReq.headers.get('Authorization')).toBe('Bearer valid-token');
    });

    it('should pass request unchanged when no token and not login URL', () => {
        authServiceSpy.getToken.and.returnValue(null);

        const req = new HttpRequest('GET', '/api/public');

        TestBed.runInInjectionContext(() => {
            authInterceptor(req, mockNext);
        });

        const modifiedReq = mockNext.calls.mostRecent().args[0] as HttpRequest<any>;
        expect(modifiedReq).toBe(req);
    });
});
