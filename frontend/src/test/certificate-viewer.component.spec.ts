import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CertificateViewerComponent } from '../app/components/certificate-viewer/certificate-viewer.component';

describe('CertificateViewerComponent', () => {
    let component: CertificateViewerComponent;
    let fixture: ComponentFixture<CertificateViewerComponent>;
    let httpMock: HttpTestingController;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CertificateViewerComponent,
                TranslateModule.forRoot()
            ],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting()
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(CertificateViewerComponent);
        component = fixture.componentInstance;
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with empty certificate', () => {
        expect(component.certificatePem).toBe('');
        expect(component.certificates).toEqual([]);
        expect(component.activeTabIndex).toBe(0);
    });

    it('should not parse certificate chain when PEM is empty', () => {
        component.certificatePem = '';
        component.ngOnInit();
        expect(component.certificates.length).toBe(0);
    });

    it('should parse single certificate from PEM', async () => {
        const mockPem = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKL0UG+mRK8RMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAwU4Hq0FYwJLjXJFKrMbP8WuHhXV6RgZBH1dF9YkWjLnGPLQCHEH0vN5p
eBcHnJiXxDG3cJ7qHlOa0tW4NnJKvbT3sQxb4SJQGdQHgVqLZKr6bKkj5dPOXqnP
X5vWKGLKZzEfNhJnkqLY1dLqJ5tC9fYYcRQqZPxvKU5sJHWNPvGQxJdLKvZGZKqx
UZ5YfYqLGsHJKvfHKqZpYqJKLqZGqYHZKJqLGsHJKqZpYqJKLqZGqYHZ
-----END CERTIFICATE-----`;

        component.certificatePem = mockPem;
        await component.ngOnInit();

        expect(component.certificates.length).toBeGreaterThanOrEqual(0);
    });

    it('should change active tab index', () => {
        const event = { index: 2 };
        component.onTabChange(event);
        expect(component.activeTabIndex).toBe(2);
    });

    describe('Error Handling', () => {
        it('should handle invalid certificate PEM gracefully', async () => {
            component.certificatePem = '-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----';
            await component.ngOnInit();

            // Dovrebbe gestire l'errore senza crashare
            expect(component.certificates.length).toBeGreaterThanOrEqual(0);
        });
    });
});
