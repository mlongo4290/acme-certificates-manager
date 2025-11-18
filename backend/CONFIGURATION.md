# ACME Certificates Manager - Configuration Guide

## Configuration Method

This application uses **environment variables** for configuration. There are two ways to set them:

### 1. PM2 Ecosystem File (Recommended for Production)

Edit `ecosystem.config.js` to configure all environment variables:

```javascript
env: {
    NODE_ENV: 'production',
    PORT: '3000',
    MONGODB_URI: 'mongodb://localhost:27017/acme-certificates-manager',
    // ... other variables
}
```

Start with:
```bash
pm2 start ecosystem.config.js
```

For development:
```bash
pm2 start ecosystem.config.js --env development
```

### 2. System Environment Variables

Set environment variables directly in your shell or systemd service:

**Bash/Linux:**
```bash
export NODE_ENV=production
export PORT=3000
export MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager
# ... other variables
npm start
```

**Systemd Service:**
```ini
[Service]
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager"
# ... other variables
```

## Required Configuration

### Server Configuration

| Variable   | Required | Default     | Description                                     |
| ---------- | -------- | ----------- | ----------------------------------------------- |
| `NODE_ENV` | Yes      | development | Environment mode: `development` or `production` |
| `PORT`     | Yes      | 3000        | HTTP server port                                |

### Database

| Variable      | Required | Default | Description               |
| ------------- | -------- | ------- | ------------------------- |
| `MONGODB_URI` | Yes      | -       | MongoDB connection string |

### Security

| Variable         | Required | Default | Description                               |
| ---------------- | -------- | ------- | ----------------------------------------- |
| `JWT_SECRET`     | Yes      | -       | Secret key for JWT tokens (min 32 chars)  |
| `JWT_EXPIRES_IN` | No       | 24h     | JWT token expiration time                 |
| `ENCRYPTION_KEY` | Yes      | -       | 32-byte key for encrypting sensitive data |

### ACME Configuration

| Variable    | Required | Default            | Description                        |
| ----------- | -------- | ------------------ | ---------------------------------- |
| `ACME_PATH` | No       | ~/.acme.sh/acme.sh | Path to acme.sh script (if needed) |

### Frontend Integration

| Variable       | Required | Default | Description                                 |
| -------------- | -------- | ------- | ------------------------------------------- |
| `FRONTEND_URL` | Yes      | -       | Frontend URL for OAuth callbacks and emails |

### Email Configuration (Optional)

| Variable         | Required | Default      | Description          |
| ---------------- | -------- | ------------ | -------------------- |
| `SMTP_HOST`      | No       | -            | SMTP server hostname |
| `SMTP_PORT`      | No       | 587          | SMTP server port     |
| `SMTP_SECURE`    | No       | false        | Use TLS/SSL          |
| `SMTP_USER`      | No       | -            | SMTP username        |
| `SMTP_PASS`      | No       | -            | SMTP password        |
| `SMTP_FROM`      | No       | -            | From email address   |
| `SMTP_FROM_NAME` | No       | ACME Manager | From name            |

### Logging Configuration

| Variable              | Required | Default    | Description                                   |
| --------------------- | -------- | ---------- | --------------------------------------------- |
| `LOG_LEVEL`           | No       | info       | Log level: error, warn, info, debug, verbose  |
| `LOG_DIR`             | No       | ../logs    | Directory for log files                       |
| `ENABLE_CONSOLE_LOGS` | No       | true       | Enable console logging                        |
| `ENABLE_FILE_LOGS`    | No       | true       | Enable file logging                           |
| `LOG_MAX_FILES`       | No       | 14d        | Max log files to keep (number or time period) |
| `LOG_DATE_PATTERN`    | No       | YYYY-MM-DD | Date pattern for log rotation                 |

## Security Best Practices

### 1. Generate Secure Keys

**JWT Secret (minimum 32 characters):**
```bash
openssl rand -base64 32
```

**Encryption Key (exactly 32 characters):**
```bash
openssl rand -base64 32 | cut -c1-32
```

### 2. Permissions

Ensure `ecosystem.config.js` has restricted permissions:
```bash
chmod 600 ecosystem.config.js
chown acme-certificates-manager:acme-certificates-manager ecosystem.config.js
```

### 3. Never Commit Secrets

Add to `.gitignore`:
```
ecosystem.config.js
.env
```

Keep a template file instead:
```bash
cp ecosystem.config.js ecosystem.config.js.example
# Edit .example to remove sensitive values
```

## Migration from .env

If you have an existing `.env` file:

1. Copy all values to `ecosystem.config.js` → `env` section
2. Test the application: `pm2 start ecosystem.config.js`
3. Verify all features work correctly
4. Delete `.env` file: `rm .env`

## Examples

### Production Setup

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'acme-backend',
    script: 'dist/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      MONGODB_URI: 'mongodb://localhost:27017/acme-certificates-manager',
      JWT_SECRET: 'xK9mP2nL5qR8tW3vY6zA4bC7dE0fG1h',
      ENCRYPTION_KEY: 'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2u',
      FRONTEND_URL: 'https://acme.example.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'true',
      SMTP_USER: 'acme@example.com',
      SMTP_PASS: 'smtp-password',
      SMTP_FROM: 'acme@example.com',
      LOG_LEVEL: 'info',
      LOG_DIR: '/var/log/acme-certificates-manager'
    }
  }]
};
```

### Development Setup

```bash
# Set environment variables
export NODE_ENV=development
export PORT=3000
export MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager
export JWT_SECRET=development-secret-key
export ENCRYPTION_KEY=dev-encryption-key-32-bytes!!!
export FRONTEND_URL=http://localhost:4200
export LOG_LEVEL=debug

# Run directly
npm run dev
```

## Troubleshooting

### Application can't find configuration

**Problem:** Variables not set correctly

**Solution:** Check PM2 env vars:
```bash
pm2 env 0  # Show environment for app ID 0
```

### Email not working

**Problem:** SMTP not configured

**Solution:** Email is optional. If SMTP vars are not set, email features are disabled. Check logs for warnings.

### Database connection fails

**Problem:** MongoDB not running or wrong URI

**Solution:** Verify MongoDB is running:
```bash
systemctl status mongod
mongo --eval "db.version()"
```

Check `MONGODB_URI` in ecosystem.config.js matches your setup.
