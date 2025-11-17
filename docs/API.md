# API Documentation

Complete REST API reference for ACME Certificate Manager.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Authentication](#authentication-endpoints)
  - [Certificates](#certificate-endpoints)
  - [DNS Providers](#dns-provider-endpoints)
  - [ACME Accounts](#acme-account-endpoints)
  - [Certificate Authorities](#certificate-authority-endpoints)
  - [Users](#user-endpoints)

## Overview

**Base URL**: `http://localhost:3000/api` (development)

**Content Type**: `application/json`

**Authentication**: JWT Bearer Token (except auth endpoints)

## Authentication

### JWT Token

Include JWT token in request header:

```http
Authorization: Bearer <your-jwt-token>
```

### Token Expiration

- Default: 7 days
- Configurable via `JWT_EXPIRES_IN` environment variable
- No refresh token (re-login required after expiration)

### Role-Based Access

- **Admin**: Full system access
- **User**: Limited access (cannot manage users)

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### List Response

```json
{
  "success": true,
  "data": [ ... ],
  "count": 10,
  "page": 1,
  "totalPages": 5
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ]  // Optional validation errors
}
```

## Error Handling

### HTTP Status Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 200  | OK - Request successful              |
| 201  | Created - Resource created           |
| 400  | Bad Request - Invalid input          |
| 401  | Unauthorized - Missing/invalid token |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource not found       |
| 409  | Conflict - Resource already exists   |
| 500  | Internal Server Error - Server error |

### Error Response Examples

**Validation Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

**Authentication Error:**
```json
{
  "success": false,
  "message": "Invalid token or token expired"
}
```

## Endpoints

## Authentication Endpoints

### Register User

```http
POST /api/auth/register
```

**Public**: Yes (if `allowRegistration: true`)

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Login

```http
POST /api/auth/login
```

**Public**: Yes

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Logout

```http
POST /api/auth/logout
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Note**: Logout is client-side (remove token from storage).

---

### Forgot Password

```http
POST /api/auth/forgot-password
```

**Public**: Yes

**Requires**: SMTP configured

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### Reset Password

```http
POST /api/auth/reset-password
```

**Public**: Yes

**Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newsecurepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### Google OAuth (if enabled)

```http
GET /api/auth/google
```

Redirects to Google OAuth consent screen.

```http
GET /api/auth/google/callback
```

Google OAuth callback (redirects to frontend with token).

---

## Certificate Endpoints

### List Certificates

```http
GET /api/certificates
```

**Auth Required**: Yes

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 10)
- `status` (string): Filter by status (pending|valid|expired|error)
- `domain` (string): Search by domain

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "domain": "example.com",
      "additionalDomains": ["www.example.com"],
      "challengeType": "dns-01",
      "status": "valid",
      "issueDate": "2024-10-01T00:00:00.000Z",
      "expiryDate": "2024-12-30T00:00:00.000Z",
      "autoRenew": true,
      "daysBeforeRenewal": 30,
      "certificateAuthority": { "name": "Let's Encrypt" },
      "dnsProvider": { "name": "Cloudflare Production" }
    }
  ],
  "count": 1,
  "page": 1,
  "totalPages": 1
}
```

---

### Get Certificate

```http
GET /api/certificates/:id
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "domain": "example.com",
    "additionalDomains": ["www.example.com"],
    "challengeType": "dns-01",
    "status": "valid",
    "certificate": "-----BEGIN CERTIFICATE-----\n...",
    "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
    "fullChain": "-----BEGIN CERTIFICATE-----\n...",
    "issueDate": "2024-10-01T00:00:00.000Z",
    "expiryDate": "2024-12-30T00:00:00.000Z",
    "autoRenew": true,
    "daysBeforeRenewal": 30,
    "renewalTime": "02:00",
    "renewalTimeRandomization": 30,
    "postIssuanceScripts": ["/opt/scripts/deploy.sh"],
    "certificateAuthorityId": "65a1...",
    "acmeAccountId": "65a2...",
    "dnsProviderId": "65a3..."
  }
}
```

---

### Create Certificate

```http
POST /api/certificates
```

**Auth Required**: Yes

**Body:**
```json
{
  "domain": "example.com",
  "additionalDomains": ["www.example.com", "api.example.com"],
  "challengeType": "dns-01",
  "certificateAuthorityId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "acmeAccountId": "65a2b3c4d5e6f7g8h9i0j1k2",
  "dnsProviderId": "65a3b4c5d6e7f8g9h0i1j2k3",
  "autoRenew": true,
  "daysBeforeRenewal": 30,
  "renewalTime": "02:00",
  "renewalTimeRandomization": 30,
  "postIssuanceScripts": ["/opt/scripts/deploy.sh"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Certificate created successfully",
  "data": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "domain": "example.com",
    "status": "pending",
    ...
  }
}
```

---

### Update Certificate

```http
PUT /api/certificates/:id
```

**Auth Required**: Yes

**Body:** (partial update)
```json
{
  "additionalDomains": ["www.example.com", "api.example.com", "blog.example.com"],
  "autoRenew": true,
  "daysBeforeRenewal": 45,
  "postIssuanceScripts": ["/opt/scripts/deploy.sh", "/opt/scripts/notify.sh"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Certificate updated successfully",
  "data": { ... }
}
```

**Note**: Changing domains marks certificate as "modified" and requires reissue.

---

### Delete Certificate

```http
DELETE /api/certificates/:id
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "message": "Certificate deleted successfully"
}
```

**Note**: Cancels scheduled renewal jobs automatically.

---

### Issue Certificate

```http
POST /api/certificates/:id/issue
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "message": "Certificate issued successfully",
  "data": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "domain": "example.com",
    "status": "valid",
    "certificate": "-----BEGIN CERTIFICATE-----\n...",
    "issueDate": "2024-10-31T12:00:00.000Z",
    "expiryDate": "2025-01-29T12:00:00.000Z"
  }
}
```

**Process:**
1. Creates ACME client
2. Requests DNS-01 challenge
3. Creates TXT record via DNS provider
4. Waits for DNS propagation
5. Verifies record via provider API
6. ACME server validates challenge
7. Downloads certificate
8. Deletes TXT record
9. Executes post-issuance scripts (if configured)

---

### Renew Certificate

```http
POST /api/certificates/:id/renew
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "message": "Certificate renewed successfully",
  "data": { ... }
}
```

**Note**: Same process as issuance.

---

### Run Post-Issuance Scripts

```http
POST /api/certificates/:id/run-scripts
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "output": "Certificate deployed successfully\nNginx reloaded\n",
  "message": "Scripts executed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "output": "",
  "error": "Script failed: Permission denied",
  "message": "Script execution failed"
}
```

---

## DNS Provider Endpoints

### List DNS Providers

```http
GET /api/dns-providers
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Cloudflare Production",
      "type": "cloudflare",
      "credentials": {
        "apiToken": "***hidden***",
        "zoneId": "zone123"
      },
      "dnsPropagationTime": 60,
      "enabled": true
    }
  ]
}
```

**Note**: Credentials are masked in responses.

---

### Get DNS Provider

```http
GET /api/dns-providers/:id
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "name": "Cloudflare Production",
    "type": "cloudflare",
    "credentials": {
      "apiToken": "actual-token-here",
      "zoneId": "zone123"
    },
    "dnsPropagationTime": 60,
    "enabled": true
  }
}
```

**Note**: Full credentials returned when fetching single provider.

---

### Create DNS Provider

```http
POST /api/dns-providers
```

**Auth Required**: Yes

**Body:**
```json
{
  "name": "Cloudflare Production",
  "type": "cloudflare",
  "credentials": {
    "apiToken": "your-cloudflare-api-token",
    "zoneId": "optional-zone-id"
  },
  "dnsPropagationTime": 60,
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "DNS provider created successfully",
  "data": { ... }
}
```

**Provider Types:**
- `cloudflare`
- `digitalocean`
- `godaddy`
- `namecheap`
- `route53`
- `google`
- `azure`
- `ovh`
- `manual`

---

### Update DNS Provider

```http
PUT /api/dns-providers/:id
```

**Auth Required**: Yes

**Body:** (partial update)
```json
{
  "name": "Cloudflare Staging",
  "dnsPropagationTime": 90,
  "enabled": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "DNS provider updated successfully",
  "data": { ... }
}
```

---

### Delete DNS Provider

```http
DELETE /api/dns-providers/:id
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "message": "DNS provider deleted successfully"
}
```

**Note**: Cannot delete if in use by certificates.

---

### Test DNS Provider

```http
POST /api/dns-providers/:id/test
```

**Auth Required**: Yes

**Response (Success):**
```json
{
  "success": true,
  "message": "Connected to zone: example.com"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Invalid credentials: 401 Unauthorized"
}
```

---

## ACME Account Endpoints

### List ACME Accounts

```http
GET /api/acme-accounts
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "email": "admin@example.com",
      "certificateAuthority": {
        "_id": "65a2...",
        "name": "Let's Encrypt Production"
      },
      "status": "registered",
      "registrationDate": "2024-10-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get ACME Account

```http
GET /api/acme-accounts/:id
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "email": "admin@example.com",
    "certificateAuthorityId": "65a2b3c4d5e6f7g8h9i0j1k2",
    "accountUrl": "https://acme-v02.api.letsencrypt.org/acme/acct/123456",
    "status": "registered",
    "registrationDate": "2024-10-01T00:00:00.000Z"
  }
}
```

**Note**: Private key not returned for security.

---

### Register ACME Account

```http
POST /api/acme-accounts/register
```

**Auth Required**: Yes

**Body:**
```json
{
  "email": "admin@example.com",
  "certificateAuthorityId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "termsOfServiceAgreed": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "ACME account registered successfully",
  "data": {
    "_id": "65a2b3c4d5e6f7g8h9i0j1k2",
    "email": "admin@example.com",
    "accountUrl": "https://acme-v02.api.letsencrypt.org/acme/acct/123456",
    "status": "registered"
  }
}
```

**Process:**
1. Generates RSA key pair
2. Contacts ACME server
3. Agrees to Terms of Service
4. Stores encrypted private key
5. Saves account URL

---

### Delete ACME Account

```http
DELETE /api/acme-accounts/:id
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "message": "ACME account deleted successfully"
}
```

**Note**: Cannot delete if in use by certificates.

---

## Certificate Authority Endpoints

### List Certificate Authorities

```http
GET /api/certificate-authorities
```

**Auth Required**: Yes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Let's Encrypt Production",
      "directoryUrl": "https://acme-v02.api.letsencrypt.org/directory",
      "isDefault": true,
      "enabled": true
    },
    {
      "_id": "65a2b3c4d5e6f7g8h9i0j1k2",
      "name": "ZeroSSL",
      "directoryUrl": "https://acme.zerossl.com/v2/DV90/directory",
      "isDefault": false,
      "enabled": true
    }
  ]
}
```

---

### Create Certificate Authority

```http
POST /api/certificate-authorities
```

**Auth Required**: Admin only

**Body:**
```json
{
  "name": "Custom ACME CA",
  "directoryUrl": "https://acme.example.com/directory",
  "isDefault": false,
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Certificate authority created successfully",
  "data": { ... }
}
```

---

### Update Certificate Authority

```http
PUT /api/certificate-authorities/:id
```

**Auth Required**: Admin only

**Body:**
```json
{
  "name": "Let's Encrypt Staging",
  "enabled": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Certificate authority updated successfully",
  "data": { ... }
}
```

---

### Delete Certificate Authority

```http
DELETE /api/certificate-authorities/:id
```

**Auth Required**: Admin only

**Response:**
```json
{
  "success": true,
  "message": "Certificate authority deleted successfully"
}
```

**Note**: Cannot delete if in use by ACME accounts or certificates.

---

## User Endpoints

### List Users

```http
GET /api/users
```

**Auth Required**: Admin only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "admin",
      "createdAt": "2024-10-01T00:00:00.000Z"
    },
    {
      "_id": "65a2b3c4d5e6f7g8h9i0j1k2",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2024-10-15T00:00:00.000Z"
    }
  ]
}
```

---

### Create User

```http
POST /api/users
```

**Auth Required**: Admin only

**Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword123",
  "role": "user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "_id": "65a3b4c5d6e7f8g9h0i1j2k3",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user"
  }
}
```

---

### Update User

```http
PUT /api/users/:id
```

**Auth Required**: Admin only (or self for own account)

**Body:**
```json
{
  "name": "Jane Smith",
  "role": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { ... }
}
```

**Note**: Cannot change email (used as unique identifier).

---

### Delete User

```http
DELETE /api/users/:id
```

**Auth Required**: Admin only

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Note**: Cannot delete currently logged-in admin user.

---

## Rate Limiting

**Not Implemented by Default**

For production, implement rate limiting:

```javascript
// Example with express-rate-limit
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);
```

## Pagination

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 10, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

## Webhooks

**Not Implemented**

Future consideration for event notifications:
- Certificate issued
- Certificate renewal success/failure
- Certificate expiring soon
- DNS provider validation failure

## Next Steps

- [User Guide](USER_GUIDE.md) - End-user documentation
- [Development Guide](DEVELOPMENT.md) - Developer setup
- [Architecture Overview](ARCHITECTURE.md) - System design
- [Configuration Guide](CONFIGURATION.md) - Environment setup
