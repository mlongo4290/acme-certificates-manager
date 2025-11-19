import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService, LoginRequest, LoginResponse } from '../app/services/auth.service';
import { environment } from '../environments/environment';
import { createRouterSpy } from './test-helpers';

describe('AuthService', () => {
    let service: AuthService;
    let httpMock: HttpTestingController;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(() => {
        routerSpy = createRouterSpy('/');

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: Router, useValue: routerSpy },
                AuthService
            ]
        });

        service = TestBed.inject(AuthService);
        httpMock = TestBed.inject(HttpTestingController);

        // Clear sessionStorage before each test
        sessionStorage.clear();
    });

    afterEach(() => {
        httpMock.verify(); // Verify no outstanding HTTP requests
        sessionStorage.clear();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
        expect(service.isAuthenticated()).toBeFalse();
    });

    describe('login', () => {
        it('should login successfully and store token', () => {
            const credentials: LoginRequest = {
                username: 'user',
                password: 'password'
            };

            const mockResponse: LoginResponse = {
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImF1dGhQcm92aWRlciI6ImxvY2FsIiwicm9sZSI6IkFETUlOIn0.test',
                user: {
                    id: '1',
                    username: 'user',
                    authProvider: 'local',
                    role: 'ADMIN'
                }
            };

            service.login(credentials).subscribe(response => {
                expect(response.token).toBeTruthy();
                expect(service.isAuthenticated()).toBeTrue();
                expect(service.currentUser()?.username).toBe('user');
                expect(sessionStorage.getItem('auth_token')).toBeTruthy();
            });

            const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual(credentials);
            req.flush(mockResponse);
        });

        it('should handle MFA required response', () => {
            const credentials: LoginRequest = {
                username: 'mfauser',
                password: 'password123'
            };

            const mockResponse: LoginResponse = {
                requiresMfa: true,
                tempUserId: 'temp-123',
                username: 'mfauser'
            };

            service.login(credentials).subscribe(response => {
                expect(response.requiresMfa).toBeTrue();
                expect(response.tempUserId).toBe('temp-123');
                expect(service.isAuthenticated()).toBeFalse();
                expect(sessionStorage.getItem('auth_token')).toBeNull();
            });

            const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
            req.flush(mockResponse);
        });

        it('should handle login error', () => {
            const credentials: LoginRequest = {
                username: 'wronguser',
                password: 'wrongpass'
            };

            service.login(credentials).subscribe({
                next: () => fail('should have failed with 401 error'),
                error: (error) => {
                    expect(error.status).toBe(401);
                    expect(service.isAuthenticated()).toBeFalse();
                }
            });

            const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
            req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
        });
    });

    describe('verifyMfaToken', () => {
        it('should verify MFA and store token', () => {
            const mockResponse: LoginResponse = {
                token: 'mfa-token-123',
                user: {
                    id: '1',
                    username: 'mfauser',
                    authProvider: 'local',
                    role: 'CERT_MANAGER'
                }
            };

            service.verifyMfaToken('temp-123', '123456', true, 'device-123').subscribe(response => {
                expect(response.token).toBe('mfa-token-123');
                expect(service.isAuthenticated()).toBeTrue();
                expect(sessionStorage.getItem('auth_token')).toBe('mfa-token-123');
            });

            const req = httpMock.expectOne(`${environment.apiUrl}/auth/verify-mfa`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual({
                tempUserId: 'temp-123',
                token: '123456',
                trustDevice: true,
                deviceId: 'device-123'
            });
            req.flush(mockResponse);
        });
    });

    describe('logout', () => {
        it('should clear token and navigate to login', () => {
            // Setup: simulate logged in state
            sessionStorage.setItem('auth_token', 'test-token');
            service.isAuthenticated.set(true);
            service.currentUser.set({
                id: '1',
                username: 'testuser',
                authProvider: 'local',
                role: 'ADMIN'
            });

            // Act
            service.logout();

            // Assert
            expect(sessionStorage.getItem('auth_token')).toBeNull();
            expect(service.isAuthenticated()).toBeFalse();
            expect(service.currentUser()).toBeNull();
            expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/auth/login', { replaceUrl: true });
        });
    });

    describe('hasRole', () => {
        it('should return true for matching role', () => {
            service.currentUser.set({
                id: '1',
                username: 'admin',
                authProvider: 'local',
                role: 'ADMIN'
            });

            expect(service.hasRole('ADMIN')).toBeTrue();
            expect(service.hasRole('CERT_MANAGER')).toBeFalse();
        });

        it('should return false when no user', () => {
            service.currentUser.set(null);
            expect(service.hasRole('ADMIN')).toBeFalse();
        });
    });

    describe('getToken', () => {
        it('should return token from sessionStorage', () => {
            sessionStorage.setItem('auth_token', 'test-token-456');
            expect(service.getToken()).toBe('test-token-456');
        });

        it('should return null when no token', () => {
            expect(service.getToken()).toBeNull();
        });
    });
});
