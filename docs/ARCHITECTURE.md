# Architecture Overview

Complete system architecture documentation for ACME Certificate Manager.

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Component Overview](#component-overview)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Security Architecture](#security-architecture)
- [Scalability Considerations](#scalability-considerations)
- [Deployment Architecture](#deployment-architecture)

## System Overview

ACME Certificate Manager is a full-stack web application built with a modern microservices-inspired architecture. The system automates SSL/TLS certificate issuance and renewal using the ACME protocol (RFC 8555), supporting multiple Certificate Authorities and DNS providers.

### Key Characteristics

- **Architecture Pattern**: Client-Server with RESTful API
- **Frontend**: Single Page Application (SPA)
- **Backend**: RESTful API with job scheduling
- **Database**: Document-oriented (MongoDB)
- **Communication**: HTTP/HTTPS with JWT authentication
- **Deployment**: Monolithic or containerized (Docker)

### Core Features

1. **Certificate Lifecycle Management**: Automated issuance, renewal, and revocation
2. **Multi-CA Support**: Let's Encrypt, ZeroSSL, Buypass, Google Trust Services
3. **DNS Provider Integration**: Pluggable architecture for 9+ DNS providers
4. **Job Scheduling**: Background tasks for automated renewals
5. **User Management**: Role-based access control (Admin/User)
6. **Post-Issuance Scripts**: Automated certificate deployment

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Angular 18)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │ Certificates │  │ DNS Providers│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ACME Accounts│  │     Users    │  │   Settings   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│                    HTTP/HTTPS + JWT Auth                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js + Express)                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    API Layer (Express)                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │
│  │  │  Auth    │  │   Cert   │  │   DNS    │  │  User  │  │   │
│  │  │  Routes  │  │  Routes  │  │  Routes  │  │ Routes │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Business Logic Layer                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │    ACME     │  │ Certificate │  │  DNS Provider│     │   │
│  │  │   Service   │  │   Service   │  │   Factory    │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │         DNS Provider Plugins (9+ providers)     │   │   │
│  │  │  Cloudflare | DigitalOcean | GoDaddy | Route53 │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Job Scheduler (Agenda)                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  Certificate │  │  Certificate │  │  DNS Cleanup │  │   │
│  │  │   Renewal    │  │    Check     │  │              │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Data Access Layer (Mongoose)              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │
│  │  │   User   │  │   Cert   │  │   DNS    │  │  ACME  │  │   │
│  │  │  Model   │  │  Model   │  │  Model   │  │ Model  │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MongoDB Database                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  users   │  │  certs   │  │   dns    │  │  acme    │        │
│  │          │  │          │  │ providers│  │ accounts │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐                                     │
│  │   cas    │  │   jobs   │  (Agenda scheduler)                 │
│  └──────────┘  └──────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ACME Servers │  │ DNS Provider │  │ SMTP Server  │          │
│  │ (Let's Encrypt│ │    APIs      │  │ (Email)      │          │
│  │  ZeroSSL)    │  │ (Cloudflare) │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Overview

### Frontend Layer

#### Angular 18 SPA

**Responsibilities:**
- User interface rendering
- User interaction handling
- State management (services)
- API communication (HTTP)
- Real-time updates (polling/SSE)

**Key Components:**

1. **Pages**
   - `DashboardComponent`: Overview and statistics
   - `CertificatesComponent`: Certificate CRUD and management
   - `DnsProvidersComponent`: DNS provider configuration
   - `AcmeAccountsComponent`: ACME account registration
   - `UsersComponent`: User management (admin only)

2. **Services**
   - `AuthService`: Authentication and JWT management
   - `CertificateService`: Certificate API calls
   - `DnsProviderService`: DNS provider API calls
   - `AcmeAccountService`: ACME account operations

3. **Guards**
   - `AuthGuard`: Route protection
   - `AdminGuard`: Admin-only routes

4. **UI Library**
   - PrimeNG: Component library
   - PrimeIcons: Icon set
   - PrimeFlex: Utility CSS

### Backend Layer

#### API Layer (Express.js)

**Responsibilities:**
- HTTP request handling
- Request validation
- Response formatting
- Error handling
- CORS management

**Route Structure:**
```
/api
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /forgot-password
│   └── POST /reset-password
├── /certificates
│   ├── GET /
│   ├── GET /:id
│   ├── POST /
│   ├── PUT /:id
│   ├── DELETE /:id
│   ├── POST /:id/issue
│   ├── POST /:id/renew
│   └── POST /:id/run-scripts
├── /dns-providers
│   ├── GET /
│   ├── GET /:id
│   ├── POST /
│   ├── PUT /:id
│   ├── DELETE /:id
│   └── POST /:id/test
├── /acme-accounts
│   ├── GET /
│   ├── GET /:id
│   ├── POST /register
│   └── DELETE /:id
├── /certificate-authorities
│   ├── GET /
│   ├── POST /
│   ├── PUT /:id
│   └── DELETE /:id
└── /users
    ├── GET /
    ├── POST /
    ├── PUT /:id
    └── DELETE /:id
```

#### Business Logic Layer

**ACME Service**
- ACME protocol implementation
- Certificate issuance workflow
- DNS-01 challenge handling
- Certificate download and storage

**Certificate Service**
- Certificate CRUD operations
- Renewal logic
- Post-issuance script execution
- Certificate validation

**DNS Provider Factory**
- Provider registration
- Provider instantiation
- Credential management
- DNS record operations

**DNS Providers (9+ implementations)**
- `CloudflareDnsProvider`
- `DigitalOceanDnsProvider`
- `GoDaddyDnsProvider`
- `NamecheapDnsProvider`
- `ManualDnsProvider`
- `Route53DnsProvider` (SDK)
- `GoogleDnsProvider` (SDK)
- `AzureDnsProvider` (SDK)
- `OvhDnsProvider` (SDK)

#### Job Scheduler (Agenda)

**Jobs:**
- **Certificate Renewal**: Automatic renewal before expiry
- **Certificate Check**: Periodic expiration monitoring
- **DNS Cleanup**: Remove stale DNS records

**Configuration:**
- Cron-like scheduling
- Job persistence in MongoDB
- Retry logic for failures
- Concurrent job execution

### Data Layer

#### MongoDB Collections

**users**
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (admin|user),
  createdAt: Date,
  updatedAt: Date
}
```

**certificates**
```javascript
{
  _id: ObjectId,
  domain: String,
  additionalDomains: [String],
  challengeType: String (dns-01|http-01),
  certificateAuthorityId: ObjectId,
  acmeAccountId: ObjectId,
  dnsProviderId: ObjectId,
  autoRenew: Boolean,
  daysBeforeRenewal: Number,
  renewalTime: String,
  renewalTimeRandomization: Number,
  postIssuanceScripts: [String],
  certificate: String (PEM),
  privateKey: String (PEM),
  fullChain: String (PEM),
  issueDate: Date,
  expiryDate: Date,
  status: String (pending|valid|expired|error),
  lastError: String,
  createdAt: Date,
  updatedAt: Date
}
```

**dnsproviders**
```javascript
{
  _id: ObjectId,
  name: String,
  type: String (cloudflare|digitalocean|...),
  credentials: Map<String, String>,
  dnsPropagationTime: Number,
  enabled: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**acmeaccounts**
```javascript
{
  _id: ObjectId,
  email: String,
  certificateAuthorityId: ObjectId,
  accountUrl: String,
  privateKey: String (PEM, encrypted),
  registrationDate: Date,
  status: String (registered|deactivated),
  createdAt: Date,
  updatedAt: Date
}
```

**certificateauthorities**
```javascript
{
  _id: ObjectId,
  name: String,
  directoryUrl: String,
  isDefault: Boolean,
  enabled: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**jobs** (Agenda)
```javascript
{
  _id: ObjectId,
  name: String,
  data: Object,
  priority: Number,
  nextRunAt: Date,
  lastRunAt: Date,
  failCount: Number,
  failReason: String
}
```

## Data Flow

### Certificate Issuance Flow

```
User Request (Frontend)
    │
    ▼
POST /api/certificates/:id/issue
    │
    ▼
Certificate Controller
    │
    ▼
ACME Service.issueCertificate()
    │
    ├─► Get Certificate from DB
    ├─► Get DNS Provider from DB
    ├─► Get ACME Account from DB
    │
    ▼
Create ACME Client
    │
    ▼
Request Challenge from ACME Server
    │
    ▼
DNS Provider.createTxtRecord()
    │   └─► API call to DNS provider (Cloudflare, etc.)
    │
    ▼
Wait for DNS Propagation (configurable)
    │
    ▼
DNS Provider.verifyTxtRecord()
    │   └─► Check record via provider API
    │
    ▼
ACME Server validates challenge
    │
    ▼
Download Certificate
    │
    ├─► Save certificate to DB
    ├─► Update certificate status
    │
    ▼
DNS Provider.deleteTxtRecord()
    │   └─► Clean up DNS records
    │
    ▼
Execute Post-Issuance Scripts (if configured)
    │
    ▼
Return success response to Frontend
```

### Authentication Flow

```
User Login (Frontend)
    │
    ▼
POST /api/auth/login
    │   {email, password}
    │
    ▼
Auth Controller
    │
    ├─► Find user by email
    ├─► Verify password (bcrypt)
    │
    ▼
Generate JWT Token
    │   {userId, email, role}
    │
    ▼
Return {token, user}
    │
    ▼
Frontend stores token
    │
    ▼
Subsequent Requests
    │
    ├─► Include Authorization: Bearer <token>
    │
    ▼
Auth Middleware validates JWT
    │
    ├─► Verify signature
    ├─► Check expiration
    ├─► Attach user to request
    │
    ▼
Route Handler processes request
```

### Job Scheduling Flow

```
Application Startup
    │
    ▼
Agenda initializes
    │
    ├─► Connect to MongoDB
    ├─► Load job definitions
    │
    ▼
Certificate auto-renewal enabled
    │
    ▼
Schedule renewal job
    │   {certificateId, time, randomization}
    │
    ▼
Job persisted to MongoDB (jobs collection)
    │
    ▼
At scheduled time
    │
    ▼
Agenda executes job
    │
    ▼
Certificate Service.renewCertificate()
    │
    ▼
ACME Service.issueCertificate()
    │   (same flow as manual issuance)
    │
    ▼
On Success:
    │   ├─► Update lastRunAt
    │   ├─► Schedule next run
    │   └─► Send success notification
    │
On Failure:
    │   ├─► Increment failCount
    │   ├─► Schedule retry (5min, 15min, 1hr)
    │   └─► Send failure alert
```

## Technology Stack

### Frontend

- **Framework**: Angular 18
- **Language**: TypeScript 5
- **UI Library**: PrimeNG 18
- **State Management**: Services + RxJS
- **HTTP Client**: Angular HttpClient
- **Routing**: Angular Router
- **Forms**: Reactive Forms
- **i18n**: ngx-translate
- **Build Tool**: Angular CLI + esbuild

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4
- **Language**: TypeScript 5
- **ORM**: Mongoose 8
- **Authentication**: Passport.js + JWT
- **Job Scheduler**: Agenda
- **ACME Client**: acme-client
- **Email**: Nodemailer
- **Validation**: express-validator
- **Logging**: Winston

### Database

- **Database**: MongoDB 5+
- **ODM**: Mongoose
- **Connection**: Native MongoDB driver
- **Indexing**: Compound indexes for performance

### DevOps

- **Containerization**: Docker + Docker Compose
- **Process Manager**: PM2 (production)
- **Reverse Proxy**: nginx (recommended)
- **Monitoring**: Logs + External monitoring

## Security Architecture

### Authentication & Authorization

**JWT-Based Authentication:**
- Stateless authentication
- Token expiration: 7 days (configurable)
- Refresh tokens: Not implemented (re-login required)
- Role-based access control (RBAC)

**Password Security:**
- Hashing: bcrypt (10 rounds)
- Minimum length: 8 characters
- No password complexity requirements (configurable)

**Token Storage:**
- Frontend: localStorage (consider httpOnly cookies for production)
- Backend: No token storage (stateless)

### Data Security

**Sensitive Data Encryption:**
- ACME account private keys: Encrypted at rest
- DNS provider credentials: Encrypted in MongoDB
- Certificates: Plain text (PEM format)

**Database Security:**
- MongoDB authentication enabled
- Network isolation (localhost or private network)
- Regular backups
- Connection string with auth credentials

### Network Security

**HTTPS/TLS:**
- Production deployment requires HTTPS
- Certificate validation for external APIs
- Secure WebSocket connections (if implemented)

**CORS:**
- Whitelist frontend origin
- Credentials allowed
- Preflight request handling

**Rate Limiting:**
- Not implemented by default
- Recommended for production (express-rate-limit)

### API Security

**Input Validation:**
- express-validator for request validation
- Mongoose schema validation
- Sanitization of user inputs

**Error Handling:**
- No sensitive data in error messages
- Detailed errors in logs only
- Generic error responses to clients

## Scalability Considerations

### Current Limitations

- **Single Instance**: Monolithic deployment
- **Job Scheduler**: Single Agenda instance (no distributed locking)
- **Database**: Single MongoDB instance

### Horizontal Scaling

**Frontend:**
- Static files can be served by CDN
- Multiple instances behind load balancer
- No server-side state

**Backend:**
- Stateless API (JWT auth)
- Can run multiple instances
- **Job Scheduler Issue**: Agenda needs distributed locking for multiple instances

**Database:**
- MongoDB replica set for high availability
- Read replicas for read-heavy workloads
- Sharding for large datasets

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Optimize database indexes
- Enable MongoDB connection pooling

### Performance Optimization

**Caching:**
- Not implemented (potential: Redis for session data)
- Browser caching for static assets

**Database:**
- Indexes on frequently queried fields
- Aggregation pipelines for complex queries
- Limit query result sizes

**API:**
- Pagination for list endpoints
- Compression middleware (gzip)
- Connection pooling

## Deployment Architecture

### Development Environment

```
Developer Machine
├── Frontend: localhost:4200 (Angular dev server)
├── Backend: localhost:3000 (ts-node-dev)
└── MongoDB: localhost:27017 (local instance)
```

### Docker Deployment

```
Docker Host
├── mongodb container (mongo:7)
├── backend container (Node.js app)
└── frontend container (nginx + static files)

Docker Network: bridge
Volumes:
├── mongodb_data (persistent)
├── certificates (persistent)
└── logs (persistent)
```

### Production Deployment

```
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │  Load Balancer  │
              │   (HTTPS/443)   │
              └────────┬─────────┘
                       │
        ┌──────────────┼──────────────┐
        │                             │
        ▼                             ▼
┌────────────────┐          ┌────────────────┐
│  nginx Proxy   │          │  nginx Proxy   │
│  (Reverse)     │          │  (Reverse)     │
└────────┬───────┘          └────────┬───────┘
         │                           │
    ┌────┴────┐                 ┌────┴────┐
    │         │                 │         │
    ▼         ▼                 ▼         ▼
Frontend  Backend          Frontend  Backend
(Static)  (Node.js)        (Static)  (Node.js)
          │                          │
          └──────────┬───────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  MongoDB Replica│
            │       Set       │
            │  (Primary +     │
            │   Secondaries)  │
            └─────────────────┘
```

**Components:**
- **Load Balancer**: Distributes traffic, SSL termination
- **nginx**: Reverse proxy, static file serving
- **Frontend Instances**: Multiple static file servers
- **Backend Instances**: Multiple Node.js processes (PM2)
- **MongoDB Replica Set**: High availability database

### Environment-Specific Configuration

**Development:**
- Hot reload enabled
- Debug logging
- CORS allow all
- No HTTPS required

**Staging:**
- Production-like environment
- Test data
- Let's Encrypt Staging CA
- HTTPS recommended

**Production:**
- Optimized builds
- Error logging only
- Strict CORS
- HTTPS required
- Rate limiting enabled
- Regular backups

## Next Steps

- [User Guide](USER_GUIDE.md) - End-user documentation
- [Development Guide](DEVELOPMENT.md) - Developer setup
- [Configuration Guide](CONFIGURATION.md) - Environment configuration
- [API Documentation](API.md) - REST API reference
- [DNS Provider Plugins](DNS_PROVIDER_PLUGINS.md) - Creating custom providers
