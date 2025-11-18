# Configuration Guide

Complete guide to configuring ACME Certificate Manager.

## Table of Contents

- [Environment Variables](#environment-variables)
- [MongoDB Configuration](#mongodb-configuration)
- [SMTP Configuration](#smtp-configuration)
- [Authentication Providers](#authentication-providers)
- [Security Settings](#security-settings)
- [Job Scheduling](#job-scheduling)
- [Logging](#logging)
- [Docker Configuration](#docker-configuration)

## Environment Variables

Configuration is managed through environment variables in `.env` files.

### Backend Configuration

Create `backend/.env`:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager

# JWT Authentication
JWT_SECRET=your-very-secure-random-string-change-this
JWT_EXPIRES_IN=7d

# CORS Settings
FRONTEND_URL=http://localhost:4200

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=ACME Certificate Manager <noreply@example.com>

# OAuth Providers (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Certificate Storage
CERT_STORAGE_PATH=./certificates

# Job Scheduler
AGENDA_COLLECTION=jobs
```

### Frontend Configuration

Create `frontend/src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: 'http://localhost:3000/api',
  googleAuthEnabled: false,
  allowRegistration: false
};
```

### Required Variables

Minimum required configuration:

```bash
# Backend
PORT=3000
MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager
JWT_SECRET=change-this-to-a-secure-random-string
FRONTEND_URL=http://localhost:4200
```

### Optional Variables

Additional features:

- **SMTP_***: Email notifications and password reset
- **GOOGLE_***: Google OAuth authentication
- **LOG_LEVEL**: Logging verbosity (debug, info, warn, error)
- **CERT_STORAGE_PATH**: Custom certificate storage location

## MongoDB Configuration

### Local Installation

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows:**
Download installer from [MongoDB Download Center](https://www.mongodb.com/try/download/community)

### Connection String

**Local MongoDB:**
```bash
MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager
```

**MongoDB with Authentication:**
```bash
MONGODB_URI=mongodb://username:password@localhost:27017/acme-certificates-manager?authSource=admin
```

**MongoDB Atlas (Cloud):**
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/acme-certificates-manager?retryWrites=true&w=majority
```

**Replica Set:**
```bash
MONGODB_URI=mongodb://host1:27017,host2:27017,host3:27017/acme-certificates-manager?replicaSet=rs0
```

### Database Security

**Create Database User:**
```javascript
// Connect to MongoDB shell
mongosh

// Create admin user
use admin
db.createUser({
  user: "acme_admin",
  pwd: "secure_password",
  roles: [
    { role: "readWrite", db: "acme-certificates-manager" }
  ]
})
```

**Enable Authentication:**
```bash
# Edit MongoDB config
sudo nano /etc/mongod.conf

# Add security section
security:
  authorization: enabled

# Restart MongoDB
sudo systemctl restart mongod
```

### Backup and Restore

**Backup Database:**
```bash
mongodump --uri="mongodb://localhost:27017/acme-certificates-manager" --out=/backup/mongodb
```

**Restore Database:**
```bash
mongorestore --uri="mongodb://localhost:27017/acme-certificates-manager" /backup/mongodb/acme-certificates-manager
```

**Automated Backup Script:**
```bash
#!/bin/bash
# backup-mongo.sh

BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${DATE}"

mongodump --uri="mongodb://localhost:27017/acme-certificates-manager" --out="$BACKUP_PATH"

# Keep only last 7 backups
ls -t $BACKUP_DIR | tail -n +8 | xargs -I {} rm -rf $BACKUP_DIR/{}

echo "Backup completed: $BACKUP_PATH"
```

## SMTP Configuration

Email is required for password reset functionality and optional for notifications.

### Gmail

**Requirements:**
- Gmail account
- App Password (2FA must be enabled)

**Setup:**

1. Enable 2-Factor Authentication on Gmail
2. Go to [Google Account Security](https://myaccount.google.com/security)
3. Select **App passwords**
4. Create app password for "Mail"
5. Copy generated password

**Configuration:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=ACME Manager <your-email@gmail.com>
```

### Microsoft 365 / Outlook

**Configuration:**
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM=ACME Manager <your-email@outlook.com>
```

### SendGrid

**Requirements:**
- SendGrid account
- API Key with Mail Send permissions

**Configuration:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

### Mailgun

**Configuration:**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-mailgun-domain.com
SMTP_PASS=your-mailgun-smtp-password
SMTP_FROM=noreply@your-mailgun-domain.com
```

### Amazon SES

**Configuration:**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

### Custom SMTP Server

**Configuration:**
```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false  # Use false for STARTTLS
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_FROM=ACME Manager <noreply@yourdomain.com>
```

**Port Guide:**
- **25**: Standard SMTP (often blocked by ISPs)
- **587**: SMTP with STARTTLS (recommended)
- **465**: SMTP with SSL/TLS (deprecated, use STARTTLS instead)
- **2525**: Alternative port (some providers)

### Testing SMTP

Test SMTP configuration from backend:

```bash
cd backend
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Error:', error);
  } else {
    console.log('SMTP connection successful');
  }
});
"
```

### Email Templates

Templates are located in `backend/src/templates/`:

- `welcome.html`: Welcome email for new users
- `password-reset.html`: Password reset email
- `certificate-renewal-success.html`: Successful renewal notification
- `certificate-renewal-failure.html`: Failed renewal alert

Customize templates by editing HTML files.

## Authentication Providers

### Local Authentication

Default authentication method. No additional configuration required.

**Features:**
- Email/password login
- Password reset via email
- JWT token-based sessions

### Google OAuth

**Requirements:**
- Google Cloud Console project
- OAuth 2.0 credentials

**Setup:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure consent screen
6. Set application type: **Web application**
7. Add authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/google/callback
   https://yourdomain.com/api/auth/google/callback
   ```
8. Copy **Client ID** and **Client Secret**

**Backend Configuration:**
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

**Frontend Configuration:**
```typescript
// frontend/src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'http://localhost:3000/api',
  googleAuthEnabled: true  // Enable Google login button
};
```

### Disable User Registration

Prevent new user self-registration:

```typescript
// frontend/src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'http://localhost:3000/api',
  allowRegistration: false  // Hide registration form
};
```

**Note:** Admin can still create users via Users page.

## Security Settings

### JWT Configuration

**Secret Key:**
Generate secure random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Token Expiration:**
```bash
JWT_EXPIRES_IN=7d  # 7 days
JWT_EXPIRES_IN=24h  # 24 hours
JWT_EXPIRES_IN=30d  # 30 days
```

**Refresh Tokens:**
Currently not implemented. Users must re-login after token expiration.

### CORS Configuration

Control which origins can access API:

```typescript
// backend/src/app.ts
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
```

**Multiple Origins:**
```typescript
app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://yourdomain.com',
    'https://app.yourdomain.com'
  ],
  credentials: true
}));
```

### HTTPS/TLS

**Production Deployment:**
- Always use HTTPS in production
- Configure reverse proxy (nginx, Apache) with TLS
- Redirect HTTP to HTTPS
- Use certificates from Let's Encrypt or commercial CA

**Example nginx configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:4200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Password Policy

Current password requirements:
- Minimum 8 characters
- No complexity requirements (configurable)

**Enhance Password Policy:**
Edit `backend/src/models/user.model.ts`:

```typescript
userSchema.pre('save', function (next) {
  if (this.isModified('password')) {
    // Add validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!passwordRegex.test(this.password)) {
      return next(new Error('Password must be 12+ chars with uppercase, lowercase, number, and special character'));
    }
  }
  next();
});
```

### Rate Limiting

Protect against brute force attacks:

```typescript
// backend/src/app.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later'
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

## Job Scheduling

Certificate renewals are managed by [Agenda](https://github.com/agenda/agenda) job scheduler.

### Configuration

```bash
# Job collection name in MongoDB
AGENDA_COLLECTION=jobs
```

### Job Types

- **Certificate Renewal**: Scheduled based on certificate settings
- **Certificate Check**: Periodic check for expiring certificates
- **DNS Cleanup**: Remove stale DNS records

### Monitoring Jobs

Query jobs in MongoDB:
```javascript
// MongoDB shell
use acme-certificates-manager
db.jobs.find({ name: "certificate-renewal" })
```

### Manual Job Execution

Trigger renewal manually via UI or API:
```bash
# Via API
curl -X POST http://localhost:3000/api/certificates/:id/renew \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Job Failures

Failed jobs are retried automatically:
- First retry: After 5 minutes
- Second retry: After 15 minutes
- Third retry: After 1 hour
- After 3 failures: Marked as failed, admin notification sent

## Logging

### Log Levels

```bash
LOG_LEVEL=debug  # Verbose, all details
LOG_LEVEL=info   # Standard, recommended
LOG_LEVEL=warn   # Warnings and errors only
LOG_LEVEL=error  # Errors only
```

### Log Files

```bash
LOG_FILE=logs/app.log  # Application logs
```

**Log Rotation:**
Logs are automatically rotated daily and kept for 14 days.

### Viewing Logs

```bash
# Real-time logs
tail -f logs/app.log

# Search logs
grep "ERROR" logs/app.log
grep "certificate" logs/app.log

# View specific date
cat logs/app-2024-01-15.log
```

### Structured Logging

Logs include:
- Timestamp
- Log level
- Component/module
- Message
- Context (certificate ID, domain, etc.)

Example log entry:
```
2024-01-15 10:30:45 [INFO] [AcmeService] Certificate issued successfully for example.com (cert_id: 65a1b2c3d4e5f6g7h8i9j0k1)
```

## Docker Configuration

### Docker Compose

`docker-compose.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: change_this_password
      MONGO_INITDB_DATABASE: acme-certificates-manager

  backend:
    build: ./backend
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      - mongodb
    environment:
      PORT: 3000
      MONGODB_URI: mongodb://admin:change_this_password@mongodb:27017/acme-certificates-manager?authSource=admin
      JWT_SECRET: your-secure-jwt-secret
      FRONTEND_URL: http://localhost:4200
    volumes:
      - ./certificates:/app/certificates
      - ./logs:/app/logs

  frontend:
    build: ./frontend
    restart: always
    ports:
      - "4200:80"
    depends_on:
      - backend
    environment:
      API_URL: http://localhost:3000/api

volumes:
  mongodb_data:
```

### Environment Variables in Docker

Create `.env` file for docker-compose:

```bash
# .env
MONGODB_ROOT_PASSWORD=secure_password
JWT_SECRET=your-jwt-secret
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

Reference in `docker-compose.yml`:
```yaml
environment:
  MONGODB_URI: mongodb://admin:${MONGODB_ROOT_PASSWORD}@mongodb:27017/acme-certificates-manager?authSource=admin
  JWT_SECRET: ${JWT_SECRET}
```

### Persistent Storage

**Certificates:**
```yaml
volumes:
  - ./certificates:/app/certificates
```

**Logs:**
```yaml
volumes:
  - ./logs:/app/logs
```

**MongoDB:**
```yaml
volumes:
  - mongodb_data:/data/db
```

## Next Steps

- [User Guide](USER_GUIDE.md) - Using the application
- [DNS Providers](DNS_PROVIDERS.md) - Setting up DNS providers
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
- [Development Guide](DEVELOPMENT.md) - Development setup
