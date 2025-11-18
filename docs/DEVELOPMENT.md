# Development Guide

Guide for developers contributing to ACME Certificate Manager.

## Table of Contents

- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Debugging](#debugging)
- [Contributing](#contributing)

## Development Environment

### Prerequisites

- **Node.js**: >= 18.x LTS
- **npm**: >= 9.x
- **MongoDB**: >= 5.x
- **Git**: Latest version
- **IDE**: VS Code (recommended)

### Recommended VS Code Extensions

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Angular Language Service**: Angular template support
- **MongoDB for VS Code**: Database management
- **Thunder Client**: API testing
- **GitLens**: Git integration

### System Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 2GB for dependencies and build artifacts
- **OS**: Windows, macOS, or Linux

## Project Structure

```
acme-certificates-manager/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── controllers/    # HTTP request handlers
│   │   ├── models/         # Mongoose data models
│   │   ├── services/       # Business logic
│   │   │   ├── dns-providers/  # DNS provider implementations
│   │   │   ├── acme.service.ts # ACME protocol logic
│   │   │   └── ...
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API route definitions
│   │   ├── utils/          # Utility functions
│   │   ├── jobs/           # Scheduled jobs (Agenda)
│   │   └── app.ts          # Express app setup
│   ├── tests/              # Backend tests
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/               # Angular 18 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/      # Page components
│   │   │   ├── components/ # Shared components
│   │   │   ├── services/   # Angular services
│   │   │   ├── guards/     # Route guards
│   │   │   ├── models/     # TypeScript interfaces
│   │   │   └── app.component.ts
│   │   ├── assets/
│   │   │   ├── i18n/       # Translation files (en.json, it.json)
│   │   │   └── images/
│   │   ├── environments/   # Environment configs
│   │   └── index.html
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                   # Documentation
│   ├── USER_GUIDE.md
│   ├── DNS_PROVIDERS.md
│   ├── CONFIGURATION.md
│   ├── DEVELOPMENT.md (this file)
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── DNS_PROVIDER_PLUGINS.md
│
├── certificates/           # Certificate storage (runtime)
├── logs/                   # Application logs
├── docker-compose.yml
└── README.md
```

## Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Job Scheduler**: Agenda
- **ACME Client**: acme-client
- **Authentication**: JWT (jsonwebtoken), Passport.js
- **Email**: Nodemailer
- **Validation**: express-validator

### Frontend

- **Framework**: Angular 18
- **Language**: TypeScript
- **UI Library**: PrimeNG 18
- **Icons**: PrimeIcons
- **HTTP Client**: Angular HttpClient
- **Routing**: Angular Router
- **Forms**: Angular Reactive Forms
- **i18n**: ngx-translate

### DevOps

- **Containerization**: Docker, Docker Compose
- **Build**: TypeScript Compiler, Angular CLI
- **Linting**: ESLint
- **Formatting**: Prettier

## Getting Started

### Initial Setup

```bash
# Clone repository
git clone https://github.com/yourusername/acme-certificates-manager.git
cd acme-certificates-manager

# Install all dependencies (backend + frontend)
npm run install:all

# Or install separately
cd backend && npm install
cd ../frontend && npm install
```

### MongoDB Setup

**Local MongoDB:**
```bash
# Ubuntu/Debian
sudo apt-get install mongodb-org
sudo systemctl start mongod

# macOS
brew services start mongodb-community

# Windows
# Download and install MongoDB Community Server
```

**Docker MongoDB:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:7
```

### Environment Configuration

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

Minimum `.env`:
```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager
JWT_SECRET=dev-secret-change-in-production
FRONTEND_URL=http://localhost:4200
```

**Frontend:**
```typescript
// frontend/src/environments/environment.ts (already configured for development)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  googleAuthEnabled: false,
  allowRegistration: true
};
```

### Running Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
# App runs on http://localhost:4200
```

**Or run both with:**
```bash
npm run dev:all
```

### Creating Admin User

First run automatically creates default admin user:
- Email: `admin`
- Password: `admin`

**Change password immediately after first login!**

## Development Workflow

### Feature Development

1. **Create Feature Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes:**
   - Follow code standards
   - Write tests for new features
   - Update documentation

3. **Test Changes:**
   ```bash
   # Backend tests
   cd backend
   npm test

   # Frontend tests
   cd frontend
   npm test

   # E2E tests
   npm run e2e
   ```

4. **Commit Changes:**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR:**
   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new DNS provider support
fix: resolve certificate renewal issue
docs: update user guide
style: format code with prettier
refactor: reorganize ACME service
test: add unit tests for DNS providers
chore: update dependencies
```

### Code Review Process

1. All PRs require review before merge
2. Ensure CI/CD checks pass
3. Address review comments
4. Squash commits if needed
5. Merge when approved

## Code Standards

### TypeScript

**Use strict type checking:**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Prefer interfaces over types:**
```typescript
// Good
interface Certificate {
  domain: string;
  expiryDate: Date;
}

// Avoid
type Certificate = {
  domain: string;
  expiryDate: Date;
};
```

**Use async/await over promises:**
```typescript
// Good
async function issueCertificate(domain: string) {
  const certificate = await acmeClient.issueCertificate(domain);
  return certificate;
}

// Avoid
function issueCertificate(domain: string) {
  return acmeClient.issueCertificate(domain).then(cert => cert);
}
```

### Naming Conventions

**Files:**
- Controllers: `certificate.controller.ts`
- Services: `acme.service.ts`
- Models: `user.model.ts`
- Interfaces: `certificate.interface.ts`

**Classes:**
```typescript
class AcmeService { }
class CloudflareDnsProvider { }
```

**Interfaces:**
```typescript
interface IDnsProvider { }
interface Certificate { }
```

**Variables/Functions:**
```typescript
const certificateId = '123';
function issueCertificate() { }
async function validateDnsRecord() { }
```

**Constants:**
```typescript
const MAX_RETRY_ATTEMPTS = 3;
const DNS_PROPAGATION_TIME = 60000;
```

### Angular Components

**Component structure:**
```typescript
@Component({
  selector: 'app-certificate-list',
  templateUrl: './certificate-list.component.html',
  styleUrls: ['./certificate-list.component.scss']
})
export class CertificateListComponent implements OnInit, OnDestroy {
  // Public properties
  certificates: Certificate[] = [];
  loading = false;

  // Private properties
  private destroy$ = new Subject<void>();

  constructor(
    private certificateService: CertificateService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadCertificates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCertificates(): void {
    this.loading = true;
    this.certificateService.getCertificates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (certs) => {
          this.certificates = certs;
          this.loading = false;
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message
          });
          this.loading = false;
        }
      });
  }
}
```

### Error Handling

**Backend:**
```typescript
// Use try-catch with async functions
async function issueCertificate(domain: string): Promise<Certificate> {
  try {
    const cert = await acmeClient.issue(domain);
    return cert;
  } catch (error) {
    logger.error(`Failed to issue certificate for ${domain}:`, error);
    throw new Error(`Certificate issuance failed: ${error.message}`);
  }
}

// Use middleware for error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});
```

**Frontend:**
```typescript
// Handle errors in service subscriptions
this.certificateService.issueCertificate(certId).subscribe({
  next: (result) => {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Certificate issued successfully'
    });
  },
  error: (err) => {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: err.error?.message || 'Failed to issue certificate'
    });
  }
});
```

### Logging

**Use structured logging:**
```typescript
import { logger } from './utils/logger';

// Info
logger.info('Certificate issued', { domain: 'example.com', certId: '123' });

// Warning
logger.warn('DNS propagation taking longer than expected', { domain: 'example.com', elapsed: 120 });

// Error
logger.error('Certificate issuance failed', { domain: 'example.com', error: error.message });

// Debug
logger.debug('ACME challenge created', { domain: 'example.com', challenge: challengeData });
```

## Testing

### Backend Testing

**Unit Tests (Jest):**
```bash
cd backend
npm test
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Example test:**
```typescript
// backend/tests/services/acme.service.test.ts
import { AcmeService } from '../../src/services/acme.service';

describe('AcmeService', () => {
  let acmeService: AcmeService;

  beforeEach(() => {
    acmeService = new AcmeService();
  });

  it('should create DNS challenge', async () => {
    const domain = 'example.com';
    const challenge = await acmeService.createDnsChallenge(domain);
    
    expect(challenge).toBeDefined();
    expect(challenge.domain).toBe(domain);
    expect(challenge.recordName).toBe('_acme-challenge.example.com');
  });
});
```

### Frontend Testing

**Unit Tests (Karma + Jasmine):**
```bash
cd frontend
npm test
```

**Example test:**
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
    const mockCerts = [{ domain: 'example.com', status: 'valid' }];

    service.getCertificates().subscribe(certs => {
      expect(certs.length).toBe(1);
      expect(certs[0].domain).toBe('example.com');
    });

    const req = httpMock.expectOne('/api/certificates');
    expect(req.request.method).toBe('GET');
    req.flush(mockCerts);
  });
});
```

### Integration Testing

**Test API endpoints:**
```bash
cd backend
npm run test:integration
```

**Example:**
```typescript
import request from 'supertest';
import app from '../src/app';

describe('Certificate API', () => {
  it('GET /api/certificates should return certificates', async () => {
    const response = await request(app)
      .get('/api/certificates')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
  });

  it('POST /api/certificates should create certificate', async () => {
    const certData = {
      domain: 'test.example.com',
      challengeType: 'dns-01',
      dnsProviderId: 'provider-id'
    };

    const response = await request(app)
      .post('/api/certificates')
      .set('Authorization', `Bearer ${authToken}`)
      .send(certData)
      .expect(201);

    expect(response.body.domain).toBe(certData.domain);
  });
});
```

## Debugging

### Backend Debugging

**VS Code launch.json:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${workspaceFolder}/backend/src/app.ts"],
      "cwd": "${workspaceFolder}/backend",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

**Debugging tips:**
```typescript
// Add breakpoints in VS Code
// Use debugger statement
debugger;

// Console logging
console.log('Debug info:', variable);

// Winston logger with debug level
logger.debug('Detailed info', { data: complexObject });
```

### Frontend Debugging

**Browser DevTools:**
- Open browser DevTools (F12)
- Use Console, Network, and Sources tabs
- Set breakpoints in TypeScript source maps

**Angular DevTools Extension:**
- Install [Angular DevTools](https://angular.io/guide/devtools)
- Inspect component tree
- Monitor change detection
- Profile performance

**VS Code debugging:**
```json
{
  "type": "chrome",
  "request": "launch",
  "name": "Debug Frontend",
  "url": "http://localhost:4200",
  "webRoot": "${workspaceFolder}/frontend",
  "sourceMapPathOverrides": {
    "webpack:/*": "${webRoot}/*"
  }
}
```

### Database Debugging

**MongoDB Compass:**
- Connect to `mongodb://localhost:27017`
- Browse collections
- Run queries
- View indexes

**MongoDB Shell:**
```bash
mongosh

use acme-certificates-manager

# View certificates
db.certificates.find().pretty()

# View jobs
db.jobs.find({ name: "certificate-renewal" }).pretty()

# View users
db.users.find().pretty()
```

## Contributing

### Pull Request Guidelines

1. **Branch Naming:**
   - Feature: `feature/feature-name`
   - Bug fix: `fix/bug-description`
   - Documentation: `docs/doc-update`

2. **PR Description:**
   - Describe what changes were made
   - Explain why changes were needed
   - Reference related issues: `Closes #123`

3. **Before Submitting:**
   - Run tests: `npm test`
   - Run linter: `npm run lint`
   - Update documentation if needed
   - Add tests for new features

4. **Code Review:**
   - Respond to feedback promptly
   - Make requested changes
   - Keep discussion professional

### Reporting Issues

**Bug Reports:**
- Describe the bug clearly
- Include steps to reproduce
- Provide error messages/logs
- Specify environment (OS, Node version, etc.)

**Feature Requests:**
- Explain the use case
- Describe desired behavior
- Consider implementation complexity

### Community Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Give constructive feedback
- Celebrate contributions

## Additional Resources

- [API Documentation](API.md)
- [Architecture Overview](ARCHITECTURE.md)
- [User Guide](USER_GUIDE.md)
- [DNS Provider Plugin Development](DNS_PROVIDER_PLUGINS.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Getting Help

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Documentation**: Check docs/ folder
- **Code**: Read inline comments and JSDoc

Happy coding! 🚀
