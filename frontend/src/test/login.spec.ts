import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Login } from '../app/pages/auth/login';
import { AuthProvider, AuthProviderService } from '../app/services/auth-provider.service';
import { AuthService, LoginResponse } from '../app/services/auth.service';
import { createRouterSpy } from './test-helpers';

describe('Login Component', () => {
    let component: Login;
    let fixture: ComponentFixture<Login>;
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let authProviderServiceSpy: jasmine.SpyObj<AuthProviderService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let queryParamsSubject: BehaviorSubject<any>;

    beforeEach(async () => {
        routerSpy = createRouterSpy('/');

        // Create signals for AuthService
        const isAuthenticatedSignal = Object.assign(
            jasmine.createSpy('isAuthenticated').and.returnValue(false),
            { set: jasmine.createSpy('set') }
        );

        const currentUserSignal = Object.assign(
            jasmine.createSpy('currentUser').and.returnValue(null),
            { set: jasmine.createSpy('set') }
        );

        authServiceSpy = jasmine.createSpyObj('AuthService', ['login', 'verifyMfaToken'], {
            isAuthenticated: isAuthenticatedSignal,
            currentUser: currentUserSignal
        });

        authProviderServiceSpy = jasmine.createSpyObj('AuthProviderService', ['getEnabledProviders']);

        const mockProviders: AuthProvider[] = [
            { _id: '1', name: 'Local', type: 'local', enabled: true, priority: 1 },
            { _id: '2', name: 'LDAP', type: 'ldap', enabled: true, priority: 2 }
        ];

        authProviderServiceSpy.getEnabledProviders.and.returnValue(
            of(mockProviders)
        );

        // Create BehaviorSubject for queryParams
        queryParamsSubject = new BehaviorSubject<any>({});

        await TestBed.configureTestingModule({
            imports: [
                Login,
                FormsModule,
                TranslateModule.forRoot(),
            ],
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: AuthProviderService, useValue: authProviderServiceSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        queryParams: queryParamsSubject.asObservable(),
                        snapshot: { queryParams: {} }
                    }
                },
                { provide: Router, useValue: routerSpy },
                TranslateService
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(Login);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    xit('should initialize with empty credentials', () => {
        expect(component.username).toBe('');
        expect(component.password).toBe('');
        expect(component.isLoading).toBeFalse();
    });

    xdescribe('onLogin', () => {
        it('should login successfully', () => {
            const mockResponse: LoginResponse = {
                token: 'test-token',
                user: {
                    id: '1',
                    username: 'testuser',
                    authProvider: 'local',
                    role: 'ADMIN'
                }
            };

            authServiceSpy.login.and.returnValue(of(mockResponse));

            component.username = 'testuser';
            component.password = 'password123';
            component.onLogin();

            expect(authServiceSpy.login).toHaveBeenCalled();
            //expect(routerSpy.navigateByUrl).toHaveBeenCalled();
        });

        it('should handle MFA required', () => {
            const mockResponse: LoginResponse = {
                requiresMfa: true,
                tempUserId: 'temp-123',
                username: 'mfauser'
            };

            authServiceSpy.login.and.returnValue(of(mockResponse));

            component.username = 'mfauser';
            component.password = 'password123';
            component.onLogin();

            expect(component.showMfaDialog).toBeTrue();
            expect(component.tempUserId).toBe('temp-123');
        });

        it('should validate empty fields', () => {
            component.username = '';
            component.password = '';
            component.onLogin();

            expect(authServiceSpy.login).not.toHaveBeenCalled();
            expect(component.errorMessage).toBeTruthy();
        });

        it('should handle login error', () => {
            authServiceSpy.login.and.returnValue(
                throwError(() => ({ status: 401, error: { message: 'Invalid' } }))
            );

            component.username = 'test';
            component.password = 'test';
            component.onLogin();

            expect(component.errorMessage).toBeTruthy();
            expect(component.isLoading).toBeFalse();
        });
    });

    xdescribe('verifyMfa', () => {
        it('should verify MFA successfully', () => {
            const mockResponse: LoginResponse = {
                token: 'mfa-token',
                user: {
                    id: '1',
                    username: 'mfauser',
                    authProvider: 'local',
                    role: 'certManager'
                }
            };

            authServiceSpy.verifyMfaToken.and.returnValue(of(mockResponse));

            component.tempUserId = 'temp-123';
            component.mfaToken = '123456';
            component.verifyMfa();

            expect(authServiceSpy.verifyMfaToken).toHaveBeenCalled();
            //expect(routerSpy.navigateByUrl).toHaveBeenCalled();
        });

        it('should validate token length', () => {
            component.mfaToken = '123';
            component.verifyMfa();

            expect(authServiceSpy.verifyMfaToken).not.toHaveBeenCalled();
            expect(component.errorMessage).toBeTruthy();
        });
    });
});
