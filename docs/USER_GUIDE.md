# User Guide

Complete guide for end users of ACME Certificate Manager.

## Table of Contents

- [Getting Started](#getting-started)
- [Dashboard Overview](#dashboard-overview)
- [Managing Certificates](#managing-certificates)
- [DNS Providers](#dns-providers)
- [ACME Accounts](#acme-accounts)
- [Certificate Authorities](#certificate-authorities)
- [Post-Issuance Scripts](#post-issuance-scripts)
- [User Management](#user-management)

## Getting Started

### First Login

1. Navigate to `http://localhost:4200` (or your configured URL)
2. Log in with default credentials:
   - Username: `admin`
   - Password: `admin`
3. **Important**: Change your password immediately via Profile > Change Password

### Changing Your Password

1. Click on your profile icon in the top right
2. Select "Change Password"
3. Enter your current password and new password
4. Click "Save"

### Password Reset

If you forget your password:

1. Click "Forgot Password?" on the login page
2. Enter your email address
3. Check your email for a reset link (requires SMTP configuration)
4. Follow the link to set a new password

## Dashboard Overview

The dashboard provides a quick overview of:

- **Total Certificates**: Number of managed certificates
- **Valid Certificates**: Currently valid certificates
- **Expiring Soon**: Certificates expiring within 30 days
- **Failed Renewals**: Recent renewal failures
- **Recent Activity**: Timeline of certificate operations

## Managing Certificates

### Creating a New Certificate

1. Navigate to **Certificates** page
2. Click **"New Certificate"** button
3. Fill in the required fields:
   - **Domain**: Primary domain (e.g., `example.com`)
   - **Additional Domains (SAN)**: Optional alternative names (e.g., `www.example.com`, `api.example.com`)
   - **Challenge Type**: Select `DNS-01` for automated DNS validation
   - **Certificate Authority**: Choose CA (Let's Encrypt, ZeroSSL, etc.)
   - **ACME Account**: Select registered account for chosen CA
   - **DNS Provider**: Select configured DNS provider (required for DNS-01)

4. Configure **Automatic Renewal**:
   - **Enabled**: Toggle auto-renewal
   - **Days Before Expiry**: When to start renewal (default: 30 days)
   - **Time**: Preferred time for renewal (24h format)
   - **Time Randomization**: Random shift in minutes to distribute load

5. Optionally add **Post-Issuance Scripts**: Scripts to run after certificate issuance/renewal

6. Click **"Create"**

### Issuing a Certificate

After creating a certificate configuration:

1. Click the **Play button** (▶️) next to the certificate
2. Confirm the issuance
3. Monitor progress in the real-time dialog:
   - DNS record creation
   - DNS propagation wait
   - ACME challenge validation
   - Certificate download
   - Script execution (if configured)

4. Certificate status will update to "Valid" upon success

### Renewing a Certificate

To manually renew a certificate:

1. Click the **Refresh button** (🔄) next to a valid certificate
2. Confirm renewal
3. Monitor progress (same as issuance)

**Note**: Certificates with auto-renewal enabled will renew automatically based on configured schedule.

### Reissuing a Certificate

When you modify domains (add/remove SAN) on a valid certificate:

1. Edit the certificate and change domains
2. The certificate will be marked as "modified"
3. Click the **Reissue button** (📝) to issue a new certificate with updated domains
4. The "modified" flag is cleared after successful reissue

### Editing a Certificate

1. Click the **Edit button** (✏️) next to any certificate
2. Modify desired fields
3. Click **"Save"**

**Important**: 
- Changing domains on a valid certificate requires reissuing
- Changes to renewal settings take effect immediately
- Scripts can be added/modified at any time

### Deleting a Certificate

1. Click the **Delete button** (🗑️) next to the certificate
2. Confirm deletion
3. Certificate and all associated data will be removed
4. Scheduled renewal jobs are automatically cancelled

### Running Post-Issuance Scripts

To test scripts without waiting for renewal:

1. Click the **Lightning bolt button** (⚡) next to a certificate with scripts
2. Confirm execution
3. View script output in the toast notification

### Certificate Status

- **Pending**: Configuration created, certificate not yet issued
- **Valid**: Certificate issued and active
- **Expired**: Certificate past expiration date
- **Error**: Last issuance/renewal attempt failed

### Certificate Actions

Based on certificate status, different actions are available:

| Status             | Available Actions                                 |
| ------------------ | ------------------------------------------------- |
| Pending/Error      | **Issue** - Start certificate issuance            |
| Valid (unmodified) | **Renew** - Manually renew certificate            |
| Valid (modified)   | **Reissue** - Issue new certificate with changes  |
| Expired            | **Renew** - Renew expired certificate             |
| All                | **Edit**, **Delete**, **Scripts** (if configured) |

## DNS Providers

DNS providers are required for automated DNS-01 challenge validation.

### Adding a DNS Provider

1. Navigate to **DNS Providers** page
2. Click **"New Provider"**
3. Fill in:
   - **Name**: Descriptive name
   - **Type**: Provider type (Cloudflare, DigitalOcean, etc.)
   - **Credentials**: Provider-specific API keys/tokens
   - **DNS Propagation Time**: Wait time after record creation (default: 60 seconds)
   - **Enabled**: Toggle provider availability

4. Click **"Test"** to verify credentials
5. Click **"Save"**

### Provider-Specific Setup

#### Cloudflare
- **API Token**: Create token with `Zone:DNS:Edit` permissions
- **Zone ID** (optional): Specific zone, or auto-detected

#### DigitalOcean
- **API Token**: Personal Access Token with read/write permissions

#### GoDaddy
- **API Key**: Production API key
- **API Secret**: Corresponding secret

#### Namecheap
- **API User**: Your Namecheap username
- **API Key**: Enable API access in account settings
- **Client IP**: Whitelist your server IP address

### Testing Provider Credentials

1. Click **"Test"** button next to provider
2. System validates credentials by making test API call
3. Success/failure message displays result

### Disabling a Provider

1. Edit the provider
2. Toggle **"Enabled"** to OFF
3. Save changes

**Note**: Disabled providers cannot be selected for new certificates.

## ACME Accounts

ACME accounts represent your identity with Certificate Authorities.

### Registering a New Account

1. Navigate to **ACME Accounts** page
2. Click **"New Account"**
3. Fill in:
   - **Email**: Contact email for CA communications
   - **Certificate Authority**: Select CA to register with
   - **Accept Terms of Service**: Must agree to CA's terms

4. Click **"Register"**
5. Account key is generated and stored encrypted
6. Registration status shows "Registered" upon success

### Account Information

View account details:
- Email address
- Associated Certificate Authority
- Registration date
- Account status

### Deleting an Account

1. **Warning**: Ensure no certificates use this account
2. Click **Delete** button
3. Confirm deletion

**Note**: Cannot delete accounts in use by certificates.

## Certificate Authorities

Certificate Authorities (CAs) issue SSL/TLS certificates.

### Pre-configured CAs

The system includes common CAs:

- **Let's Encrypt** (Production & Staging)
- **ZeroSSL**
- **Buypass**
- **Google Trust Services**

### Adding a Custom CA

1. Navigate to **Certificate Authorities** page
2. Click **"New CA"**
3. Fill in:
   - **Name**: CA name
   - **Directory URL**: ACME directory endpoint
   - **Is Default**: Set as default CA for new certificates
   - **Enabled**: Toggle CA availability

4. Click **"Save"**

### CA Directory URLs

Examples:
- Let's Encrypt Production: `https://acme-v02.api.letsencrypt.org/directory`
- Let's Encrypt Staging: `https://acme-staging-v02.api.letsencrypt.org/directory`
- ZeroSSL: `https://acme.zerossl.com/v2/DV90/directory`

## Post-Issuance Scripts

Scripts execute automatically after successful certificate issuance or renewal.

### Use Cases

Common deployment scenarios:
- Copy certificates to web server directories
- Reload/restart web servers (nginx, Apache)
- Update load balancers
- Deploy to CDN
- Notify monitoring systems
- Update container secrets

### Script Environment Variables

Scripts receive certificate data via environment variables:

```bash
CERT_DOMAIN=example.com
CERT_ADDITIONAL_DOMAINS=www.example.com,api.example.com
CERT_ALL_DOMAINS=example.com,www.example.com,api.example.com
CERT_CERTIFICATE=<PEM-encoded-certificate>
CERT_PRIVATE_KEY=<PEM-encoded-private-key>
CERT_FULL_CHAIN=<PEM-encoded-full-chain>
CERT_ISSUE_DATE=2025-10-31T12:00:00.000Z
CERT_EXPIRY_DATE=2026-01-29T12:00:00.000Z
```

### Example Scripts

#### Deploy to Nginx

```bash
#!/bin/bash
# deploy-nginx.sh

CERT_DIR="/etc/nginx/ssl/${CERT_DOMAIN}"
mkdir -p "$CERT_DIR"

# Write certificate files
echo "$CERT_CERTIFICATE" > "$CERT_DIR/cert.pem"
echo "$CERT_PRIVATE_KEY" > "$CERT_DIR/privkey.pem"
echo "$CERT_FULL_CHAIN" > "$CERT_DIR/fullchain.pem"

# Set permissions
chmod 600 "$CERT_DIR"/*.pem

# Reload Nginx
nginx -t && systemctl reload nginx

echo "Certificate deployed successfully"
```

#### Docker Container Update

```bash
#!/bin/bash
# update-docker.sh

CONTAINER_NAME="web-server"

# Update Docker secret
docker secret create "${CERT_DOMAIN}-cert-$(date +%s)" <(echo "$CERT_CERTIFICATE")
docker secret create "${CERT_DOMAIN}-key-$(date +%s)" <(echo "$CERT_PRIVATE_KEY")

# Restart container
docker restart "$CONTAINER_NAME"

echo "Container updated"
```

### Adding Scripts to Certificates

1. Edit certificate
2. In **Post-Issuance Scripts** section, click **"+ Add Script"**
3. Enter full path to script (e.g., `/opt/scripts/deploy.sh`)
4. Add multiple scripts in execution order
5. Save certificate

**Important**: 
- Scripts must be executable: `chmod +x /path/to/script.sh`
- Scripts run with backend process permissions
- Consider using `sudo` if elevated permissions needed
- Test scripts manually before adding to certificates

### Testing Scripts

Test scripts without waiting for renewal:

1. Navigate to **Certificates** page
2. Click **Lightning bolt button** (⚡) next to certificate
3. View execution output in toast notification

**Note**: Scripts execute with current certificate data from database.

## User Management

Manage system users and their roles (Admin users only).

### Adding Users

1. Navigate to **Users** page (Admin only)
2. Click **"New User"**
3. Fill in:
   - **Full Name**: User's name
   - **Email**: Login email
   - **Password**: Initial password
   - **Role**: Admin or User

4. Click **"Create"**
5. User receives welcome email (if SMTP configured)

### User Roles

- **Admin**: Full system access, can manage users and settings
- **User**: Can manage certificates and providers, limited administrative access

### Editing Users

1. Click **Edit** button next to user
2. Modify user information
3. Cannot change email (used as unique identifier)
4. Save changes

### Resetting User Passwords

Admin can reset user passwords:

1. Click **Reset Password** for user
2. Temporary password is generated
3. Send password to user securely
4. User must change password on next login

### Deleting Users

1. Click **Delete** button next to user
2. Confirm deletion
3. User is permanently removed

**Note**: Cannot delete currently logged-in admin user.

## Best Practices

### Security

- Change default admin password immediately
- Use strong passwords (12+ characters, mixed case, numbers, symbols)
- Regularly rotate ACME account keys
- Limit DNS provider token permissions to minimum required
- Review audit logs regularly
- Keep system updated

### Certificate Management

- Use descriptive certificate names
- Enable auto-renewal for production certificates
- Set renewal at least 30 days before expiry
- Test scripts in staging environment first
- Monitor certificate expiration dates
- Keep DNS provider credentials up to date

### Renewal Windows

- Configure time randomization to avoid CA rate limits
- Stagger renewal times for multiple certificates
- Set appropriate DNS propagation times for your provider
- Account for time zones in scheduling

### Monitoring

- Set up external monitoring for certificate expiration
- Review failed renewal logs
- Test renewal process periodically
- Verify post-issuance scripts execute successfully
- Monitor system logs for errors

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

For technical details, consult:
- [API Documentation](API.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Development Guide](DEVELOPMENT.md)
