# Testing Guide

Complete testing strategies and best practices for ACME Certificate Manager.

## Table of Contents

- [Overview](#overview)
- [Testing Philosophy](#testing-philosophy)
- [Test Environment Setup](#test-environment-setup)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Manual Testing](#manual-testing)
- [DNS Provider Testing](#dns-provider-testing)
- [Performance Testing](#performance-testing)
- [Security Testing](#security-testing)

## Overview

Testing is crucial for maintaining code quality and ensuring the certificate management system works reliably. This guide covers various testing strategies and best practices.

### Test Coverage Goals

- **Backend**: 80%+ code coverage
- **Frontend**: 70%+ code coverage
- **Critical Paths**: 100% coverage (certificate issuance, renewal)

### Test Types

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test API endpoints and service interactions
3. **E2E Tests**: Test complete user workflows
4. **Manual Tests**: Verify real-world scenarios

## Testing Philosophy

### Test Pyramid

```
           /\
          /  \    E2E Tests (Few, Slow, High Value)
         /────\
        /      \  Integration Tests (Some, Medium Speed)
       /────────\
      /          \ Unit Tests (Many, Fast, Low-Level)
     /────────────\
```

**Principles:**
- Write many fast unit tests
- Write some integration tests for API endpoints
- Write few E2E tests for critical user journeys
- Favor deterministic tests over flaky tests
- Mock external dependencies

## Test Environment Setup

### Backend Test Environment

**Install dependencies:**
```bash
cd backend
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

**Configure Jest:**
```javascript
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/app.ts',
    '!src/server.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

**Test setup file:**
```typescript
// backend/tests/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

// Cleanup after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
```

### Frontend Test Environment

**Karma configuration (default Angular setup):**
```javascript
// frontend/karma.conf.js
module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    client: {
      jasmine: {},
      clearContext: false
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
    restartOnFileChange: true
  });
};
```

## Backend Testing

### Unit Tests

#### Testing Services

**Example: ACME Service**
```typescript
// backend/tests/services/acme.service.test.ts
import { AcmeService } from '../../src/services/acme.service';
import { DnsProviderFactory } from '../../src/services/dns-providers';
import { Certificate } from '../../src/models/certificate.model';

jest.mock('../../src/services/dns-providers');

describe('AcmeService', () => {
  let acmeService: AcmeService;
  let mockDnsProvider: any;

  beforeEach(() => {
    acmeService = new AcmeService();
    mockDnsProvider = {
      createTxtRecord: jest.fn().mockResolvedValue(undefined),
      deleteTxtRecord: jest.fn().mockResolvedValue(undefined),
      verifyTxtRecord: jest.fn().mockResolvedValue(true)
    };
    (DnsProviderFactory.getProvider as jest.Mock).mockReturnValue(mockDnsProvider);
  });

  describe('createDnsChallenge', () => {
    it('should create DNS challenge record', async () => {
      const domain = 'example.com';
      const value = 'challenge-value';
      
      await acmeService.createDnsChallenge(domain, value, mockDnsProvider, {});
      
      expect(mockDnsProvider.createTxtRecord).toHaveBeenCalledWith(
        domain,
        `_acme-challenge.${domain}`,
        value,
        {}
      );
    });

    it('should throw error if DNS record creation fails', async () => {
      mockDnsProvider.createTxtRecord.mockRejectedValue(new Error('API Error'));
      
      await expect(
        acmeService.createDnsChallenge('example.com', 'value', mockDnsProvider, {})
      ).rejects.toThrow('API Error');
    });
  });

  describe('verifyDnsChallenge', () => {
    it('should verify DNS record exists', async () => {
      const result = await acmeService.verifyDnsChallenge(
        'example.com',
        'challenge-value',
        mockDnsProvider,
        {}
      );
      
      expect(result).toBe(true);
      expect(mockDnsProvider.verifyTxtRecord).toHaveBeenCalled();
    });

    it('should return false if verification fails', async () => {
      mockDnsProvider.verifyTxtRecord.mockResolvedValue(false);
      
      const result = await acmeService.verifyDnsChallenge(
        'example.com',
        'challenge-value',
        mockDnsProvider,
        {}
      );
      
      expect(result).toBe(false);
    });
  });
});
```

#### Testing Models

**Example: Certificate Model**
```typescript
// backend/tests/models/certificate.model.test.ts
import { Certificate } from '../../src/models/certificate.model';

describe('Certificate Model', () => {
  it('should create a valid certificate', async () => {
    const certData = {
      domain: 'example.com',
      additionalDomains: ['www.example.com'],
      challengeType: 'dns-01',
      certificateAuthorityId: 'ca123',
      acmeAccountId: 'account123',
      dnsProviderId: 'provider123',
      autoRenew: true,
      daysBeforeRenewal: 30
    };

    const cert = new Certificate(certData);
    await cert.validate();

    expect(cert.domain).toBe('example.com');
    expect(cert.status).toBe('pending'); // Default status
  });

  it('should reject invalid domain format', async () => {
    const cert = new Certificate({
      domain: 'invalid_domain',
      challengeType: 'dns-01'
    });

    await expect(cert.validate()).rejects.toThrow();
  });

  it('should calculate expiration correctly', () => {
    const cert = new Certificate({
      domain: 'example.com',
      issueDate: new Date('2024-10-01'),
      expiryDate: new Date('2024-12-30')
    });

    expect(cert.daysUntilExpiry()).toBe(90);
  });
});
```

#### Testing DNS Providers

**Example: Cloudflare Provider**
```typescript
// backend/tests/services/dns-providers/cloudflare.test.ts
import { CloudflareDnsProvider } from '../../../src/services/dns-providers/cloudflare-dns-provider';

global.fetch = jest.fn();

describe('CloudflareDnsProvider', () => {
  let provider: CloudflareDnsProvider;
  const mockCredentials = {
    apiToken: 'test-token',
    zoneId: 'test-zone-id'
  };

  beforeEach(() => {
    provider = new CloudflareDnsProvider();
    (fetch as jest.Mock).mockClear();
  });

  describe('createTxtRecord', () => {
    it('should create TXT record successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: { id: 'record123' } })
      });

      await provider.createTxtRecord(
        'example.com',
        '_acme-challenge.example.com',
        'test-value',
        mockCredentials
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/dns_records'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should throw error on API failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, errors: [{ message: 'Invalid token' }] })
      });

      await expect(
        provider.createTxtRecord('example.com', '_acme-challenge.example.com', 'value', mockCredentials)
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('validateCredentials', () => {
    it('should validate correct credentials', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: { name: 'example.com' } })
      });

      const result = await provider.validateCredentials(mockCredentials);

      expect(result.valid).toBe(true);
      expect(result.message).toContain('Connected');
    });

    it('should reject invalid credentials', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      });

      const result = await provider.validateCredentials({ apiToken: 'invalid' });

      expect(result.valid).toBe(false);
    });
  });
});
```

### Integration Tests

#### Testing API Endpoints

**Example: Certificate Endpoints**
```typescript
// backend/tests/integration/certificate.test.ts
import request from 'supertest';
import app from '../../src/app';
import { Certificate } from '../../src/models/certificate.model';
import { User } from '../../src/models/user.model';

describe('Certificate API', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    // Create test user and login
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    });
    userId = user._id.toString();

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    authToken = loginResponse.body.data.token;
  });

  describe('GET /api/certificates', () => {
    it('should return list of certificates', async () => {
      // Create test certificates
      await Certificate.create([
        { domain: 'example1.com', challengeType: 'dns-01' },
        { domain: 'example2.com', challengeType: 'dns-01' }
      ]);

      const response = await request(app)
        .get('/api/certificates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/certificates')
        .expect(401);
    });
  });

  describe('POST /api/certificates', () => {
    it('should create new certificate', async () => {
      const certData = {
        domain: 'newdomain.com',
        additionalDomains: ['www.newdomain.com'],
        challengeType: 'dns-01',
        certificateAuthorityId: 'ca123',
        acmeAccountId: 'account123',
        dnsProviderId: 'provider123'
      };

      const response = await request(app)
        .post('/api/certificates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(certData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.domain).toBe('newdomain.com');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/certificates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ domain: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/certificates/:id/issue', () => {
    it('should issue certificate (mocked)', async () => {
      // Mock ACME service
      jest.mock('../../src/services/acme.service');
      
      const cert = await Certificate.create({
        domain: 'test.com',
        challengeType: 'dns-01'
      });

      const response = await request(app)
        .post(`/api/certificates/${cert._id}/issue`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
```

### Running Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- certificate.test.ts

# Run in watch mode
npm test -- --watch

# Run with verbose output
npm test -- --verbose
```

## Frontend Testing

### Unit Tests

#### Testing Components

**Example: Certificate List Component**
```typescript
// frontend/src/app/pages/certificates/certificates.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CertificatesComponent } from './certificates.component';
import { CertificateService } from '../../services/certificate.service';
import { of, throwError } from 'rxjs';

describe('CertificatesComponent', () => {
  let component: CertificatesComponent;
  let fixture: ComponentFixture<CertificatesComponent>;
  let certificateService: jasmine.SpyObj<CertificateService>;

  beforeEach(async () => {
    const certServiceSpy = jasmine.createSpyObj('CertificateService', [
      'getCertificates',
      'issueCertificate',
      'deleteCertificate'
    ]);

    await TestBed.configureTestingModule({
      declarations: [CertificatesComponent],
      imports: [HttpClientTestingModule],
      providers: [
        { provide: CertificateService, useValue: certServiceSpy }
      ]
    }).compileComponents();

    certificateService = TestBed.inject(CertificateService) as jasmine.SpyObj<CertificateService>;
    fixture = TestBed.createComponent(CertificatesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load certificates on init', () => {
    const mockCerts = [
      { _id: '1', domain: 'example.com', status: 'valid' },
      { _id: '2', domain: 'test.com', status: 'pending' }
    ];
    certificateService.getCertificates.and.returnValue(of(mockCerts));

    component.ngOnInit();

    expect(certificateService.getCertificates).toHaveBeenCalled();
    expect(component.certificates.length).toBe(2);
  });

  it('should handle error when loading certificates', () => {
    certificateService.getCertificates.and.returnValue(
      throwError(() => new Error('Network error'))
    );

    component.ngOnInit();

    expect(component.loading).toBe(false);
    // Verify error message displayed
  });

  it('should issue certificate', () => {
    const cert = { _id: '1', domain: 'example.com' };
    certificateService.issueCertificate.and.returnValue(of({ success: true }));

    component.issueCertificate(cert);

    expect(certificateService.issueCertificate).toHaveBeenCalledWith('1');
  });
});
```

#### Testing Services

**Example: Certificate Service**
```typescript
// frontend/src/app/services/certificate.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CertificateService } from './certificate.service';

describe('CertificateService', () => {
  let service: CertificateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CertificateService]
    });
    service = TestBed.inject(CertificateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch certificates', () => {
    const mockCerts = [
      { _id: '1', domain: 'example.com' }
    ];

    service.getCertificates().subscribe(certs => {
      expect(certs.length).toBe(1);
      expect(certs[0].domain).toBe('example.com');
    });

    const req = httpMock.expectOne('/api/certificates');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockCerts });
  });

  it('should create certificate', () => {
    const newCert = {
      domain: 'newdomain.com',
      challengeType: 'dns-01'
    };

    service.createCertificate(newCert).subscribe(result => {
      expect(result.success).toBe(true);
    });

    const req = httpMock.expectOne('/api/certificates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newCert);
    req.flush({ success: true, data: { ...newCert, _id: '123' } });
  });
});
```

### Running Frontend Tests

```bash
cd frontend

# Run tests once
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
ng test

# Run headless (CI)
ng test --browsers=ChromeHeadless --watch=false
```

## Integration Testing

### API Integration Tests

Test complete API workflows:

```typescript
// backend/tests/integration/certificate-workflow.test.ts
describe('Certificate Issuance Workflow', () => {
  it('should complete full certificate lifecycle', async () => {
    // 1. Register ACME account
    const accountResponse = await request(app)
      .post('/api/acme-accounts/register')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'test@example.com',
        certificateAuthorityId: caId,
        termsOfServiceAgreed: true
      });

    expect(accountResponse.status).toBe(201);
    const accountId = accountResponse.body.data._id;

    // 2. Create DNS provider
    const providerResponse = await request(app)
      .post('/api/dns-providers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Provider',
        type: 'manual',
        enabled: true
      });

    const providerId = providerResponse.body.data._id;

    // 3. Create certificate
    const certResponse = await request(app)
      .post('/api/certificates')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        domain: 'test.example.com',
        challengeType: 'dns-01',
        certificateAuthorityId: caId,
        acmeAccountId: accountId,
        dnsProviderId: providerId
      });

    expect(certResponse.status).toBe(201);
    const certId = certResponse.body.data._id;

    // 4. Issue certificate (would be mocked in test)
    // 5. Verify certificate status
    // 6. Test renewal
    // 7. Delete certificate
  });
});
```

## End-to-End Testing

### E2E Test Setup

**Install Cypress:**
```bash
cd frontend
npm install --save-dev cypress
```

**Configure Cypress:**
```javascript
// frontend/cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    setupNodeEvents(on, config) {},
  },
});
```

### E2E Test Examples

**Example: Login Flow**
```typescript
// frontend/cypress/e2e/login.cy.ts
describe('Login Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should login with valid credentials', () => {
    cy.get('input').type('admin');
    cy.get('input[name="password"]').type('admin');
    cy.get('button[type="submit"]').click();

    cy.url().should('include', '/dashboard');
    cy.contains('Dashboard').should('be.visible');
  });

  it('should show error with invalid credentials', () => {
    cy.get('input[name="email"]').type('invalid@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.contains('Invalid credentials').should('be.visible');
  });
});
```

**Example: Certificate Creation**
```typescript
// frontend/cypress/e2e/certificate.cy.ts
describe('Certificate Management', () => {
  beforeEach(() => {
    // Login first
    cy.visit('/login');
    cy.get('input[name="email"]').type('admin@example.com');
    cy.get('input[name="password"]').type('admin123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });

  it('should create new certificate', () => {
    cy.visit('/certificates');
    cy.contains('New Certificate').click();

    cy.get('input[name="domain"]').type('test.example.com');
    cy.get('select[name="challengeType"]').select('dns-01');
    cy.get('select[name="certificateAuthority"]').select('Let\'s Encrypt Staging');
    cy.get('select[name="dnsProvider"]').select('Manual');

    cy.get('button[type="submit"]').click();

    cy.contains('Certificate created successfully').should('be.visible');
    cy.contains('test.example.com').should('be.visible');
  });
});
```

### Running E2E Tests

```bash
cd frontend

# Open Cypress UI
npx cypress open

# Run headless
npx cypress run

# Run specific spec
npx cypress run --spec "cypress/e2e/login.cy.ts"
```

## Manual Testing

### Certificate Issuance Testing

**Using Let's Encrypt Staging:**

1. Configure CA: Let's Encrypt Staging
2. Register ACME account
3. Configure DNS provider (Cloudflare recommended)
4. Create certificate for test domain
5. Issue certificate
6. Monitor logs for errors
7. Verify certificate details
8. Test renewal
9. Test post-issuance scripts

**Checklist:**
- [ ] DNS record created successfully
- [ ] DNS propagation waited
- [ ] Challenge validated by ACME server
- [ ] Certificate downloaded
- [ ] DNS record cleaned up
- [ ] Certificate saved to database
- [ ] Post-issuance scripts executed
- [ ] Auto-renewal scheduled

### DNS Provider Testing

For each DNS provider:

1. **Credential Validation:**
   - Test with valid credentials
   - Test with invalid credentials
   - Test with missing permissions

2. **Record Operations:**
   - Create TXT record
   - Verify record exists (via provider API)
   - Delete TXT record
   - Verify cleanup

3. **Error Handling:**
   - Test API rate limits
   - Test network failures
   - Test invalid zone/domain

## DNS Provider Testing

### Testing New Provider

**Test Checklist:**

```typescript
// tests/dns-providers/my-provider.manual.test.ts
describe('MyDnsProvider Manual Tests', () => {
  const provider = new MyDnsProvider();
  const credentials = {
    apiKey: process.env.MYDNS_API_KEY!,
    apiSecret: process.env.MYDNS_API_SECRET!
  };

  it('should validate credentials', async () => {
    const result = await provider.validateCredentials(credentials);
    expect(result.valid).toBe(true);
  });

  it('should create TXT record', async () => {
    await provider.createTxtRecord(
      'example.com',
      '_acme-challenge.test.example.com',
      'test-value',
      credentials
    );
    // Manually verify in DNS provider dashboard
  });

  it('should verify TXT record', async () => {
    const exists = await provider.verifyTxtRecord(
      'example.com',
      '_acme-challenge.test.example.com',
      'test-value',
      credentials
    );
    expect(exists).toBe(true);
  });

  it('should delete TXT record', async () => {
    await provider.deleteTxtRecord(
      'example.com',
      '_acme-challenge.test.example.com',
      credentials
    );
    // Manually verify cleanup in dashboard
  });
});
```

Run with real credentials:
```bash
export MYDNS_API_KEY="your-key"
export MYDNS_API_SECRET="your-secret"
npm test -- my-provider.manual.test.ts
```

## Performance Testing

### Load Testing with Artillery

**Install:**
```bash
npm install --save-dev artillery
```

**Test configuration:**
```yaml
# artillery-config.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
  http:
    timeout: 30
scenarios:
  - name: "List certificates"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "admin@example.com"
            password: "admin123"
          capture:
            - json: "$.data.token"
              as: "token"
      - get:
          url: "/api/certificates"
          headers:
            Authorization: "Bearer {{ token }}"
```

**Run load test:**
```bash
npx artillery run artillery-config.yml
```

## Security Testing

### Authentication Testing

```typescript
describe('Security Tests', () => {
  it('should reject requests without token', async () => {
    await request(app)
      .get('/api/certificates')
      .expect(401);
  });

  it('should reject invalid token', async () => {
    await request(app)
      .get('/api/certificates')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('should reject expired token', async () => {
    const expiredToken = jwt.sign({ userId: 'test' }, process.env.JWT_SECRET!, {
      expiresIn: '-1h'
    });

    await request(app)
      .get('/api/certificates')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
});
```

### SQL Injection Testing

```typescript
it('should sanitize user input', async () => {
  const response = await request(app)
    .get('/api/certificates')
    .query({ domain: "'; DROP TABLE certificates; --" })
    .set('Authorization', `Bearer ${authToken}`)
    .expect(200);

  // Should not execute malicious query
  expect(response.body.data).toBeDefined();
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm ci
      - name: Run tests
        run: cd backend && npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run tests
        run: cd frontend && npm test -- --browsers=ChromeHeadless --watch=false
```

## Best Practices

1. **Write Testable Code:**
   - Use dependency injection
   - Separate concerns
   - Avoid tight coupling

2. **Mock External Dependencies:**
   - ACME servers
   - DNS provider APIs
   - Email services

3. **Use Test Data Builders:**
   - Create factory functions for test data
   - Maintain consistency

4. **Test Edge Cases:**
   - Empty inputs
   - Large datasets
   - Network failures
   - Race conditions

5. **Keep Tests Fast:**
   - Use in-memory database (mongo-memory-server)
   - Mock slow operations
   - Run tests in parallel

6. **Maintain Tests:**
   - Update tests when features change
   - Remove obsolete tests
   - Keep coverage high

## Next Steps

- [Development Guide](DEVELOPMENT.md) - Developer setup
- [User Guide](USER_GUIDE.md) - End-user documentation
- [API Documentation](API.md) - REST API reference
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
