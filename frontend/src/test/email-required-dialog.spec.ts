import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { EmailRequiredDialogComponent } from '../app/components/email-required-dialog/email-required-dialog';
import { AuthService } from '../app/services/auth.service';
import { UserService } from '../app/services/user.service';

describe('EmailRequiredDialogComponent', () => {
    let component: EmailRequiredDialogComponent;
    let fixture: ComponentFixture<EmailRequiredDialogComponent>;
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let userServiceSpy: jasmine.SpyObj<UserService>;
    let messageServiceSpy: jasmine.SpyObj<MessageService>;
    let translateServiceSpy: jasmine.SpyObj<TranslateService>;

    beforeEach(async () => {
        // Create signal spy for currentUser
        const currentUserSignal = jasmine.createSpy('currentUser').and.returnValue({
            id: '1',
            username: 'testuser',
            authProvider: 'local',
            isAdmin: true
        });

        authServiceSpy = jasmine.createSpyObj('AuthService', [], {
            currentUser: currentUserSignal
        });

        userServiceSpy = jasmine.createSpyObj('UserService', ['getCurrentUser', 'updateEmail']);
        messageServiceSpy = jasmine.createSpyObj('MessageService', ['add']);
        translateServiceSpy = jasmine.createSpyObj('TranslateService', ['instant', 'getCurrentLang']);

        translateServiceSpy.instant.and.returnValue('translated');
        translateServiceSpy.getCurrentLang.and.returnValue('en');

        await TestBed.configureTestingModule({
            imports: [
                EmailRequiredDialogComponent,
                FormsModule
            ],
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: UserService, useValue: userServiceSpy },
                { provide: MessageService, useValue: messageServiceSpy },
                { provide: TranslateService, useValue: translateServiceSpy }
            ]
        })
            .overrideComponent(EmailRequiredDialogComponent, {
                remove: { providers: [MessageService] },
                add: {}
            })
            .compileComponents();

        fixture = TestBed.createComponent(EmailRequiredDialogComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with dialog hidden', () => {
        expect(component.displayDialog).toBeFalse();
        expect(component.email).toBe('');
        expect(component.isLoading).toBeFalse();
    });

    describe('ngOnInit', () => {
        it('should show dialog when local user has no email', () => {
            userServiceSpy.getCurrentUser.and.returnValue(of({ email: null }));

            component.ngOnInit();

            expect(userServiceSpy.getCurrentUser).toHaveBeenCalled();
            expect(component.displayDialog).toBeTrue();
        });

        it('should not show dialog when user has email', () => {
            userServiceSpy.getCurrentUser.and.returnValue(of({ email: 'test@example.com' }));

            component.ngOnInit();

            expect(userServiceSpy.getCurrentUser).toHaveBeenCalled();
            expect(component.displayDialog).toBeFalse();
        });

        it('should not check email for non-local users', () => {
            authServiceSpy.currentUser.and.returnValue({
                id: '1',
                username: 'testuser',
                authProvider: 'ldap',
                isAdmin: true
            });

            component.ngOnInit();

            expect(userServiceSpy.getCurrentUser).not.toHaveBeenCalled();
            expect(component.displayDialog).toBeFalse();
        });

        it('should handle getCurrentUser error gracefully', () => {
            userServiceSpy.getCurrentUser.and.returnValue(
                throwError(() => new Error('Network error'))
            );

            component.ngOnInit();

            expect(component.displayDialog).toBeFalse();
        });

        it('should not show dialog when user is null', () => {
            authServiceSpy.currentUser.and.returnValue(null);

            component.ngOnInit();

            expect(userServiceSpy.getCurrentUser).not.toHaveBeenCalled();
            expect(component.displayDialog).toBeFalse();
        });
    });

    describe('saveEmail', () => {
        beforeEach(() => {
            messageServiceSpy.add.calls.reset();
        });

        it('should show error when email is empty', () => {
            component.email = '';
            component.saveEmail();

            expect(messageServiceSpy.add).toHaveBeenCalled();
            expect(userServiceSpy.updateEmail).not.toHaveBeenCalled();
        });

        it('should show error when email format is invalid', () => {
            component.email = 'invalid-email';
            component.saveEmail();

            expect(messageServiceSpy.add).toHaveBeenCalledWith({
                severity: 'error',
                summary: 'translated',
                detail: 'translated'
            });
            expect(userServiceSpy.updateEmail).not.toHaveBeenCalled();
        });

        it('should accept valid email formats', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'user+tag@example.org',
                'name123@test-domain.com'
            ];

            validEmails.forEach(email => {
                messageServiceSpy.add.calls.reset();
                userServiceSpy.updateEmail.calls.reset();
                userServiceSpy.updateEmail.and.returnValue(of({}));

                component.email = email;
                component.saveEmail();

                expect(userServiceSpy.updateEmail).toHaveBeenCalledWith(email, 'en');
            });
        });

        it('should reject invalid email formats', () => {
            const invalidEmails = [
                'notanemail',
                '@example.com',
                'user@',
                'user @example.com',
                'user@domain',
                'user..name@example.com'
            ];

            invalidEmails.forEach(email => {
                messageServiceSpy.add.calls.reset();
                userServiceSpy.updateEmail.calls.reset();
                userServiceSpy.updateEmail.and.returnValue(of({}));

                component.email = email;
                component.saveEmail();

                expect(userServiceSpy.updateEmail).not.toHaveBeenCalled();
                expect(messageServiceSpy.add).toHaveBeenCalledWith({
                    severity: 'error',
                    summary: 'translated',
                    detail: 'translated'
                });
            });
        });

        it('should update email successfully', () => {
            messageServiceSpy.add.calls.reset();
            userServiceSpy.updateEmail.calls.reset();
            userServiceSpy.updateEmail.and.returnValue(of({}));

            component.email = 'test@example.com';
            component.saveEmail();

            expect(userServiceSpy.updateEmail).toHaveBeenCalledWith('test@example.com', 'en');
            expect(messageServiceSpy.add).toHaveBeenCalledWith({
                severity: 'success',
                summary: 'translated',
                detail: 'translated'
            });
        });

        it('should handle update error with custom message', () => {
            const errorResponse = {
                error: { message: 'Email already exists' }
            };
            userServiceSpy.updateEmail.and.returnValue(
                throwError(() => errorResponse)
            );

            component.email = 'test@example.com';
            component.saveEmail();

            expect(messageServiceSpy.add).toHaveBeenCalledWith({
                severity: 'error',
                summary: 'translated',
                detail: 'Email already exists'
            });
        });

        it('should handle update error with default message', () => {
            userServiceSpy.updateEmail.and.returnValue(
                throwError(() => ({ error: {} }))
            );

            component.email = 'test@example.com';
            component.saveEmail();

            expect(messageServiceSpy.add).toHaveBeenCalledWith({
                severity: 'error',
                summary: 'translated',
                detail: 'translated'
            });
        });
    });
});
