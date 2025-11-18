# Production Deployment Guide

This guide explains how to deploy ACME Certificates Manager in production.

## Table of Contents

- [Overview](#overview)
- [Frontend Build](#frontend-build)
- [Backend Setup](#backend-setup)
- [Nginx Configuration](#nginx-configuration)
- [SSL/TLS Setup](#ssltls-setup)
- [Process Management](#process-management)
- [Docker Deployment](#docker-deployment)
- [Security Checklist](#security-checklist)

## Overview

The production deployment architecture:

```
Internet (HTTPS/443) 
    ↓
Nginx Reverse Proxy
    ├─→ Static Files (Angular frontend)
    └─→ /api/* → Backend (Node.js Express on localhost:3000)
```

**Key Points:**
- Angular frontend is compiled to static files served by Nginx
- Backend runs as a Node.js process on localhost:3000
- Nginx handles SSL/TLS termination, reverse proxy, and static file serving
- MongoDB runs as a separate service

## Frontend Build

### 1. Build Angular for Production

```bash
cd frontend
npm run build
```

This creates `frontend/dist/acme-certificates-manager/browser/` with optimized files:
- Minified JavaScript bundles
- Optimized CSS
- Compressed assets
- Index.html

### 2. Build Output

The build produces:
- `index.html` - Main HTML file
- `main.*.js` - Application bundle (hashed for cache busting)
- `polyfills.*.js` - Browser polyfills
- `styles.*.css` - Compiled styles
- `assets/` - Images, fonts, i18n files

### 3. Build Configuration

The production build (`npm run build`) uses:
- Angular production mode (optimizations enabled)
- AOT compilation (Ahead-of-Time)
- Tree shaking (removes unused code)
- Minification
- Source maps (optional, can be disabled)

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install --production
```

### 2. Environment Configuration

Create `.env` file:

```env
# Server
NODE_ENV=production
PORT=3000
HOST=localhost

# MongoDB
MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager

# JWT
JWT_SECRET=your-secure-random-secret-here-minimum-32-characters

# CORS (if frontend is on different domain)
CORS_ORIGIN=https://yourdomain.com

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@example.com
```

### 3. Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in `backend/dist/`.

## Nginx Configuration

### Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nginx
```

**Windows:**
Download from https://nginx.org/en/download.html

### Configuration File

Create `/etc/nginx/sites-available/acme-certificates-manager` (Linux) or edit `nginx.conf` (Windows):

```nginx
# Upstream backend server
upstream acme_backend {
    server localhost:3000;
    keepalive 64;
}

# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL certificates (obtained via Let's Encrypt or other CA)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Max upload size (for certificate files)
    client_max_body_size 10M;
    
    # Root directory for Angular frontend
    root /var/www/acme-certificates-manager/frontend;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;
    
    # API requests -> proxy to backend
    location /api/ {
        proxy_pass http://acme_backend;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Disable caching for API requests
        proxy_cache_bypass $http_upgrade;
    }
    
    # Frontend static files
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Disable access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

### Enable Site (Linux)

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/acme-certificates-manager /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Deploy Frontend Files

```bash
# Create directory
sudo mkdir -p /var/www/acme-certificates-manager/frontend

# Copy built files
sudo cp -r frontend/dist/acme-certificates-manager/browser/* /var/www/acme-certificates-manager/frontend/

# Set permissions
sudo chown -R www-data:www-data /var/www/acme-certificates-manager/frontend
sudo chmod -R 755 /var/www/acme-certificates-manager/frontend
```

## SSL/TLS Setup

### Use Your Own ACME Manager! 🎯

**The irony:** You're deploying an ACME certificate manager, so use IT to get your SSL certificate!

1. **Get a temporary self-signed certificate** (just to start Nginx):
```bash
sudo mkdir -p /etc/ssl/acme-certificates-manager
sudo openssl req -x509 -nodes -days 7 -newkey rsa:2048 \
  -keyout /etc/ssl/acme-certificates-manager/temp-privkey.pem \
  -out /etc/ssl/acme-certificatesmanager/temp-fullchain.pem \
  -subj "/CN=yourdomain.com"
```

2. **Update Nginx config** to use temporary certificate:
```nginx
ssl_certificate /etc/ssl/acme-certificates-manager/temp-fullchain.pem;
ssl_certificate_key /etc/ssl/acme-certificates-manager/temp-privkey.pem;
```

3. **Start Nginx** with temporary certificate

4. **Access your ACME Manager** via `https://yourdomain.com` (ignore browser warning)

5. **Use the web interface** to issue a real Let's Encrypt certificate for `yourdomain.com`!

6. **Update Nginx config** to point to the real certificate:
```nginx
ssl_certificate /path/to/certificates/yourdomain.com/fullchain.pem;
ssl_certificate_key /path/to/certificates/yourdomain.com/privkey.pem;
```

7. **Reload Nginx:**
```bash
sudo systemctl reload nginx
```

8. **Set up auto-renewal** using your ACME Manager's renewal functionality!

**Note:** Make sure your backend can write to the certificate directory that Nginx reads from, or set up a post-issuance script to copy certificates to the Nginx location.

### Alternative: Use Certbot (if you prefer)

If you really want to use Certbot:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com
```

But seriously... you built this tool to avoid Certbot! 😉

## Process Management

### Option 1: PM2 (Recommended)

PM2 keeps your Node.js backend running, restarts on crashes, and manages logs.

**Install:**
```bash
sudo npm install -g pm2
```

**Start Backend:**
```bash
cd backend
pm2 start dist/index.js --name acme-backend
```

**Configure Startup:**
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

**Useful Commands:**
```bash
pm2 list              # List processes
pm2 logs acme-backend # View logs
pm2 restart acme-backend
pm2 stop acme-backend
pm2 delete acme-backend
```

**PM2 Configuration File** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'acme-backend',
    script: './dist/index.js',
    cwd: '/path/to/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/acme-backend-error.log',
    out_file: '/var/log/pm2/acme-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

Start with: `pm2 start ecosystem.config.js`

### Option 2: systemd Service (Linux)

Create `/etc/systemd/system/acme-backend.service`:

```ini
[Unit]
Description=ACME Certificates Manager Backend
After=network.target mongodb.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/acme-certificates-manager/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Commands:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable acme-backend
sudo systemctl start acme-backend
sudo systemctl status acme-backend
```

## Docker Deployment

See `docker-compose.yml` in the root directory.

### Build and Run

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Docker Compose

For production, modify `docker-compose.yml`:
- Use environment files for secrets
- Configure volume mounts for persistence
- Set resource limits
- Use production MongoDB image with authentication

## Security Checklist

Before going to production:

### Backend
- [ ] Change default JWT secret (minimum 32 characters)
- [ ] Change default admin password immediately after first login
- [ ] Set `NODE_ENV=production`
- [ ] Enable MongoDB authentication
- [ ] Configure firewall to block direct access to port 3000
- [ ] Review and restrict CORS origins
- [ ] Enable rate limiting for API endpoints
- [ ] Set up HTTPS only (no HTTP)
- [ ] Configure secure session cookies
- [ ] Review file upload limits

### MongoDB
- [ ] Enable authentication (`mongod --auth`)
- [ ] Create database user with minimal permissions
- [ ] Bind to localhost only (not 0.0.0.0)
- [ ] Enable audit logging
- [ ] Configure regular backups
- [ ] Update to latest stable version

### Nginx
- [ ] Install SSL certificate (Let's Encrypt or commercial)
- [ ] Force HTTPS redirect
- [ ] Set security headers (HSTS, X-Frame-Options, etc.)
- [ ] Configure rate limiting
- [ ] Hide Nginx version (`server_tokens off;`)
- [ ] Set up log rotation
- [ ] Configure firewall (allow only 80/443)

### System
- [ ] Keep system packages updated (`apt update && apt upgrade`)
- [ ] Configure automatic security updates
- [ ] Set up monitoring (disk space, CPU, memory)
- [ ] Configure log rotation for application logs
- [ ] Set up automated backups
- [ ] Test backup restoration procedure
- [ ] Configure firewall (UFW or iptables)
- [ ] Disable root SSH login
- [ ] Use SSH keys instead of passwords

### Application
- [ ] Test certificate issuance with staging CA first
- [ ] Configure email notifications
- [ ] Set up monitoring for certificate expiration
- [ ] Test all DNS providers in use
- [ ] Verify post-issuance scripts work correctly
- [ ] Test renewal process
- [ ] Document your specific configuration

## Monitoring

### Log Files

**Nginx:**
- Access: `/var/log/nginx/access.log`
- Error: `/var/log/nginx/error.log`

**Backend (PM2):**
```bash
pm2 logs acme-backend
```

**MongoDB:**
- `/var/log/mongodb/mongod.log`

### Health Checks

Add monitoring for:
- Backend API health endpoint (`GET /api/health`)
- MongoDB connection
- Certificate expiration dates
- Disk space for certificate storage
- ACME API rate limits

### Useful Tools

- **Uptime monitoring:** UptimeRobot, Pingdom, StatusCake
- **Server monitoring:** Netdata, Prometheus + Grafana
- **Log aggregation:** ELK stack, Graylog
- **SSL monitoring:** SSL Labs, Certificate Transparency logs

## Backup Strategy

### What to Backup

1. **MongoDB Database:** All certificates, users, configuration
2. **Certificate Files:** `/path/to/certificates/` directory
3. **Configuration Files:** `.env`, Nginx config
4. **Private Keys:** ACME account keys

### Backup Script Example

```bash
#!/bin/bash
BACKUP_DIR="/backups/acme-certificates-manager"
DATE=$(date +%Y%m%d_%H%M%S)

# MongoDB dump
mongodump --db acme-certificates-manager --out "$BACKUP_DIR/db_$DATE"

# Certificate files
tar -czf "$BACKUP_DIR/certs_$DATE.tar.gz" /path/to/certificates/

# Keep only last 7 days
find "$BACKUP_DIR" -type f -mtime +7 -delete
```

Schedule with cron:
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup-script.sh
```

## Updates and Maintenance

### Update Application

```bash
# Backup first!

# Update backend
cd backend
git pull
npm install --production
npm run build
pm2 restart acme-backend

# Update frontend
cd ../frontend
git pull
npm install
npm run build
sudo cp -r dist/acme-certificates-manager/browser/* /var/www/acme-certificates-manager/frontend/
```

### Database Maintenance

```bash
# Compact database (reduces size)
mongo acme-certificates-manager --eval "db.runCommand({compact: 'certificates'})"

# Rebuild indexes
mongo acme-certificates-manager --eval "db.certificates.reIndex()"
```

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
pm2 logs acme-backend --lines 100

# Common issues:
# - MongoDB not running: sudo systemctl start mongodb
# - Port 3000 in use: sudo lsof -i :3000
# - Missing .env file
# - Incorrect MongoDB URI
```

### Frontend Shows 404 for API Calls

- Check Nginx configuration (`proxy_pass` directive)
- Verify backend is running: `curl http://localhost:3000/api/health`
- Check Nginx error log: `sudo tail -f /var/log/nginx/error.log`

### SSL Certificate Issues

```bash
# Test SSL configuration
sudo nginx -t

# Verify certificate files exist
sudo ls -la /etc/letsencrypt/live/yourdomain.com/

# Test certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### Permission Issues

```bash
# Fix Nginx file permissions
sudo chown -R www-data:www-data /var/www/acme-certificates-manager/frontend
sudo chmod -R 755 /var/www/acme-certificates-manager/frontend

# Fix certificate directory permissions (backend needs write access)
sudo chown -R www-data:www-data /path/to/certificates/
sudo chmod -R 755 /path/to/certificates/
```

## Performance Tuning

### Nginx

```nginx
# In nginx.conf
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
```

### Node.js Backend

```bash
# Increase memory limit if needed
NODE_OPTIONS="--max-old-space-size=512" node dist/index.js
```

### MongoDB

```javascript
// Create indexes for better performance (handled automatically by Mongoose)
db.certificates.createIndex({ domain: 1 })
db.certificates.createIndex({ expirationDate: 1 })
db.certificates.createIndex({ status: 1 })
```

## Support

For issues specific to your deployment environment:
- Check the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide
- Review server logs
- Consult your hosting provider's documentation
- Open an issue on GitHub with deployment details

---

**Remember:** Always test in a staging environment before deploying to production!
