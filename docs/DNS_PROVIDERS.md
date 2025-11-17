# DNS Providers

Complete guide to DNS providers for automated DNS-01 challenge validation.

## Table of Contents

- [Overview](#overview)
- [Built-in Providers](#built-in-providers)
- [Optional SDK Providers](#optional-sdk-providers)
- [Provider Setup](#provider-setup)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Overview

DNS providers enable automated DNS-01 challenge validation for certificate issuance. The system creates TXT records, waits for propagation, and validates challenges without manual intervention.

### Challenge Flow

1. ACME server requests DNS-01 challenge
2. System creates `_acme-challenge.domain.com` TXT record via DNS provider API
3. Waits for DNS propagation (configurable)
4. ACME server validates TXT record
5. Certificate is issued
6. System deletes challenge TXT record

### Provider Types

- **Built-in**: Included with installation, no additional dependencies
- **SDK Required**: Require installing official provider SDKs

## Built-in Providers

These providers work out-of-the-box with no additional dependencies.

### Cloudflare

Recommended for most users. Fast propagation, reliable API.

**Requirements:**
- Cloudflare account with domain hosted
- API Token with `Zone:DNS:Edit` permissions

**Configuration:**
```json
{
  "apiToken": "your-cloudflare-api-token",
  "zoneId": "optional-zone-id"
}
```

**Setup Steps:**

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Profile** → **API Tokens**
3. Click **Create Token**
4. Use **Edit zone DNS** template
5. Set permissions:
   - **Zone** → **DNS** → **Edit**
6. Set zone resources:
   - **Include** → **Specific zone** → Select your domain
7. Continue and create token
8. Copy token immediately (shown only once)
9. Optional: Find Zone ID on domain **Overview** page

**DNS Propagation Time:** 30-60 seconds

### DigitalOcean

Fast and reliable for domains managed on DigitalOcean.

**Requirements:**
- DigitalOcean account
- Domain managed by DigitalOcean DNS

**Configuration:**
```json
{
  "apiToken": "your-digitalocean-api-token"
}
```

**Setup Steps:**

1. Log in to [DigitalOcean](https://cloud.digitalocean.com/)
2. Go to **API** → **Tokens/Keys**
3. Click **Generate New Token**
4. Enter token name
5. Select **Read and Write** scopes
6. Click **Generate Token**
7. Copy token immediately

**DNS Propagation Time:** 60-120 seconds

### GoDaddy

For domains registered/hosted with GoDaddy.

**Requirements:**
- GoDaddy account
- Production API key

**Configuration:**
```json
{
  "apiKey": "your-godaddy-api-key",
  "apiSecret": "your-godaddy-api-secret"
}
```

**Setup Steps:**

1. Log in to [GoDaddy Developer Portal](https://developer.godaddy.com/)
2. Go to **API Keys**
3. Click **Create New API Key**
4. Select **Production** environment
5. Copy **Key** and **Secret**
6. Store both securely

**DNS Propagation Time:** 120-300 seconds (slower propagation)

### Namecheap

For Namecheap-registered domains.

**Requirements:**
- Namecheap account
- API access enabled
- Whitelisted IP address

**Configuration:**
```json
{
  "apiUser": "your-namecheap-username",
  "apiKey": "your-namecheap-api-key",
  "clientIp": "your-server-ip-address"
}
```

**Setup Steps:**

1. Log in to [Namecheap](https://www.namecheap.com/)
2. Go to **Profile** → **Tools** → **Business & Dev Tools** → **API Access**
3. Enable API access
4. Copy API Key
5. Whitelist your server IP address
6. Use your Namecheap username as `apiUser`

**DNS Propagation Time:** 120-300 seconds

**Important:** Must whitelist server IP address or API calls will fail.

### Manual

Manual intervention for unsupported providers or testing.

**Configuration:**
```json
{}
```

**Flow:**

1. System displays TXT record details:
   - Record name: `_acme-challenge.domain.com`
   - Record type: `TXT`
   - Record value: `challenge-string`
2. User manually creates record in DNS provider
3. User confirms record creation
4. System validates challenge
5. User manually deletes record after validation

**Use Cases:**
- Unsupported DNS providers
- Testing without API access
- Domains with manual DNS management
- Compliance requirements for manual changes

## Optional SDK Providers

These providers require installing official SDKs.

### Amazon Route53

**Installation:**
```bash
cd backend
npm install @aws-sdk/client-route-53
```

**Requirements:**
- AWS account
- Route53 hosted zone
- IAM user with Route53 permissions

**Configuration:**
```json
{
  "accessKeyId": "your-aws-access-key-id",
  "secretAccessKey": "your-aws-secret-access-key",
  "region": "us-east-1",
  "hostedZoneId": "optional-hosted-zone-id"
}
```

**IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "route53:GetChange",
        "route53:ListHostedZones",
        "route53:ListResourceRecordSets",
        "route53:ChangeResourceRecordSets"
      ],
      "Resource": "*"
    }
  ]
}
```

**DNS Propagation Time:** 60-120 seconds

### Google Cloud DNS

**Installation:**
```bash
cd backend
npm install @google-cloud/dns
```

**Requirements:**
- Google Cloud Platform project
- Cloud DNS API enabled
- Service account with DNS Admin role

**Configuration:**
```json
{
  "projectId": "your-gcp-project-id",
  "keyFilename": "/path/to/service-account-key.json"
}
```

**Setup Steps:**

1. Create service account in GCP Console
2. Grant **DNS Administrator** role
3. Create JSON key
4. Download key file
5. Place on server securely
6. Reference path in configuration

**DNS Propagation Time:** 60-120 seconds

### Azure DNS

**Installation:**
```bash
cd backend
npm install @azure/arm-dns @azure/identity
```

**Requirements:**
- Azure subscription
- DNS Zone in Azure
- Service Principal with contributor access

**Configuration:**
```json
{
  "tenantId": "azure-tenant-id",
  "clientId": "service-principal-client-id",
  "clientSecret": "service-principal-secret",
  "subscriptionId": "azure-subscription-id",
  "resourceGroupName": "dns-resource-group"
}
```

**DNS Propagation Time:** 60-120 seconds

### OVH

**Installation:**
```bash
cd backend
npm install ovh
```

**Requirements:**
- OVH account
- Application credentials
- Consumer key

**Configuration:**
```json
{
  "endpoint": "ovh-eu",
  "applicationKey": "your-application-key",
  "applicationSecret": "your-application-secret",
  "consumerKey": "your-consumer-key"
}
```

**Endpoints:**
- `ovh-eu`: Europe
- `ovh-ca`: Canada
- `ovh-us`: United States

**DNS Propagation Time:** 120-180 seconds

## Provider Setup

### Adding a Provider

1. Install SDK (if required)
2. Obtain API credentials from provider
3. Navigate to **DNS Providers** in web UI
4. Click **New Provider**
5. Fill in configuration:
   - **Name**: Descriptive name (e.g., "Cloudflare Production")
   - **Type**: Select provider
   - **Credentials**: Provider-specific fields
   - **DNS Propagation Time**: Default or custom (seconds)
   - **Enabled**: Enable provider
6. Click **Test** to validate credentials
7. Click **Save**

### Testing Credentials

Always test credentials before saving:

1. Click **Test** button in provider form
2. System validates:
   - API authentication
   - Permission to list zones
   - DNS record creation capability (dry run)
3. Success/error message displays result

**Common Test Failures:**
- Invalid API token/key
- Insufficient permissions
- Expired credentials
- IP not whitelisted (Namecheap)
- Zone not found

### Multiple Providers

You can configure multiple providers:

- Multiple accounts with same provider (e.g., different Cloudflare accounts)
- Different providers for different domains
- Staging vs. production environments
- Backup providers

**Example Setup:**
```
- Cloudflare Production (enabled)
- Cloudflare Staging (enabled)
- Manual Backup (disabled)
```

## Configuration

### DNS Propagation Time

Time to wait after creating DNS record before validation.

**Guidelines:**
- **Cloudflare:** 30-60 seconds (fast global propagation)
- **DigitalOcean:** 60-120 seconds
- **Route53:** 60-120 seconds
- **GoDaddy:** 120-300 seconds (slower)
- **Namecheap:** 120-300 seconds (slower)

**Tuning:**
- Too short: ACME validation fails, DNS not propagated
- Too long: Unnecessary wait time
- Start with provider defaults
- Adjust based on failure patterns

### API Rate Limits

Be aware of provider rate limits:

| Provider     | Rate Limit    | Notes           |
| ------------ | ------------- | --------------- |
| Cloudflare   | 1200 req/5min | Per API token   |
| DigitalOcean | 5000 req/hour | Per account     |
| Route53      | 5 req/second  | Per AWS account |
| GoDaddy      | 60 req/minute | Per API key     |

**Best Practices:**
- Enable renewal time randomization
- Stagger certificate renewals
- Don't issue many certificates simultaneously
- Monitor API usage

### Security

**API Credentials:**
- Store securely (encrypted in database)
- Use minimum required permissions
- Rotate credentials periodically
- Never commit credentials to version control
- Use separate credentials for staging/production

**Network Security:**
- Whitelist server IPs when required
- Use HTTPS for all API calls
- Enable API access only on required domains
- Monitor for unauthorized API usage

## Troubleshooting

### Common Issues

#### "Invalid API token"

**Causes:**
- Incorrect token/key copied
- Token expired
- Token revoked
- Wrong environment (staging vs production)

**Solutions:**
- Regenerate token
- Verify token has correct permissions
- Check token expiration date
- Test token with provider's API directly

#### "Insufficient permissions"

**Causes:**
- Token missing DNS edit permission
- Zone not included in token scope
- Account lacks DNS management rights

**Solutions:**
- Update token permissions
- Include specific zone in token scope
- Verify account has DNS management enabled

#### "DNS validation failed"

**Causes:**
- DNS not propagated yet
- TXT record not created
- Wrong record value
- API rate limit exceeded

**Solutions:**
- Increase DNS propagation time
- Verify record creation in provider dashboard
- Check ACME logs for exact error
- Wait for rate limit reset

#### "Zone not found"

**Causes:**
- Domain not managed by provider
- Wrong Zone ID
- Subdomain issue (use root domain)

**Solutions:**
- Verify domain is on provider
- Check Zone ID is correct
- Use root domain, not subdomain

#### "IP not whitelisted" (Namecheap)

**Causes:**
- Server IP not whitelisted
- IP changed
- Using wrong IP address

**Solutions:**
- Add server IP to Namecheap whitelist
- Verify server public IP: `curl ifconfig.me`
- Update whitelist if IP changed

### Debugging

Enable debug logging in backend:

```bash
# backend/.env
LOG_LEVEL=debug
```

Check logs:
```bash
# View recent logs
tail -f logs/app.log

# Search for DNS errors
grep "DNS" logs/app.log

# Filter by certificate domain
grep "example.com" logs/app.log
```

### Manual DNS Verification

Test DNS propagation manually:

```bash
# Query TXT record
dig _acme-challenge.example.com TXT

# Query specific nameserver
dig @8.8.8.8 _acme-challenge.example.com TXT

# Windows
nslookup -type=TXT _acme-challenge.example.com
```

### Provider-Specific Tools

#### Cloudflare
```bash
# Test API token
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     -H "Authorization: Bearer YOUR_TOKEN"

# List zones
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

#### DigitalOcean
```bash
# Test API token
curl -X GET "https://api.digitalocean.com/v2/account" \
     -H "Authorization: Bearer YOUR_TOKEN"

# List domains
curl -X GET "https://api.digitalocean.com/v2/domains" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

#### Route53
```bash
# Test AWS credentials
aws route53 list-hosted-zones

# Verify IAM permissions
aws iam get-user
```

## Next Steps

- [User Guide](USER_GUIDE.md) - Complete user documentation
- [Configuration Guide](CONFIGURATION.md) - Environment and system configuration
- [DNS Provider Plugins](DNS_PROVIDER_PLUGINS.md) - Creating custom providers
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
