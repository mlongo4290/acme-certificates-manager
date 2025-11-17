# Troubleshooting Guide

Common issues and solutions for ACME Certificate Manager.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Database Connection](#database-connection)
- [Authentication Problems](#authentication-problems)
- [Certificate Issuance Failures](#certificate-issuance-failures)
- [DNS Validation Errors](#dns-validation-errors)
- [Renewal Issues](#renewal-issues)
- [Email/SMTP Problems](#emailsmtp-problems)
- [Performance Issues](#performance-issues)
- [Docker Issues](#docker-issues)

## Installation Issues

### npm install fails

**Symptoms:**
- `npm ERR!` during installation
- Missing dependencies
- Build errors

**Solutions:**

1. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

2. **Delete node_modules and package-lock.json:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check Node.js version:**
   ```bash
   node -v  # Should be >= 18.x
   ```

4. **Use correct npm version:**
   ```bash
   npm -v  # Should be >= 9.x
   npm install -g npm@latest
   ```

5. **Install with legacy peer deps (if conflicts):**
   ```bash
   npm install --legacy-peer-deps
   ```

---

### TypeScript compilation errors

**Symptoms:**
- `TS2307: Cannot find module`
- `TS2339: Property does not exist`

**Solutions:**

1. **Install TypeScript globally:**
   ```bash
   npm install -g typescript
   ```

2. **Clean and rebuild:**
   ```bash
   # Backend
   cd backend
   rm -rf dist
   npm run build

   # Frontend
   cd frontend
   rm -rf .angular
   npm run build
   ```

3. **Check tsconfig.json:**
   - Ensure `strict: true` is manageable
   - Check `moduleResolution: "node"`

---

### Port already in use

**Symptoms:**
- `Error: listen EADDRINUSE: address already in use :::3000`
- `Error: listen EADDRINUSE: address already in use :::4200`

**Solutions:**

**Linux/macOS:**
```bash
# Find process using port
lsof -i :3000
lsof -i :4200

# Kill process
kill -9 <PID>
```

**Windows:**
```powershell
# Find process
netstat -ano | findstr :3000
netstat -ano | findstr :4200

# Kill process
taskkill /PID <PID> /F
```

**Change Port:**
```bash
# Backend (.env)
PORT=3001

# Frontend (package.json)
"start": "ng serve --port 4201"
```

---

## Database Connection

### Cannot connect to MongoDB

**Symptoms:**
- `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`
- `MongoNetworkError: failed to connect to server`

**Solutions:**

1. **Check MongoDB is running:**
   ```bash
   # Linux/macOS
   sudo systemctl status mongod
   sudo systemctl start mongod

   # Windows
   net start MongoDB

   # Docker
   docker ps | grep mongo
   docker start mongodb
   ```

2. **Test connection:**
   ```bash
   mongosh
   # or
   mongo
   ```

3. **Check connection string:**
   ```bash
   # backend/.env
   MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager
   
   # With auth
   MONGODB_URI=mongodb://username:password@localhost:27017/acme-certificates-manager?authSource=admin
   
   # MongoDB Atlas
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/acme-certificates-manager
   ```

4. **Check firewall:**
   ```bash
   # Allow MongoDB port
   sudo ufw allow 27017
   ```

---

### Authentication failed

**Symptoms:**
- `MongoServerError: Authentication failed`
- `Error: bad auth : Authentication failed`

**Solutions:**

1. **Check credentials:**
   ```bash
   mongosh -u username -p password --authenticationDatabase admin
   ```

2. **Create user if missing:**
   ```javascript
   mongosh
   use admin
   db.createUser({
     user: "acme_admin",
     pwd: "your_password",
     roles: [{ role: "readWrite", db: "acme-certificates-manager" }]
   })
   ```

3. **Update connection string:**
   ```bash
   MONGODB_URI=mongodb://acme_admin:your_password@localhost:27017/acme-certificates-manager?authSource=admin
   ```

---

### Database corrupted

**Symptoms:**
- Unexpected data inconsistencies
- Application crashes during DB operations

**Solutions:**

1. **Repair database:**
   ```bash
   mongod --repair --dbpath /var/lib/mongodb
   ```

2. **Restore from backup:**
   ```bash
   mongorestore --uri="mongodb://localhost:27017/acme-certificates-manager" /backup/mongodb/acme-certificates-manager
   ```

3. **Check disk space:**
   ```bash
   df -h
   ```

---

## Authentication Problems

### Invalid credentials

**Symptoms:**
- "Invalid email or password" message
- Login fails with correct credentials

**Solutions:**

1. **Check email is correct:**
   - Email is case-sensitive
   - No leading/trailing spaces

2. **Reset password via email:**
   - Use "Forgot Password" feature
   - Requires SMTP configuration

3. **Reset admin password manually:**
   ```javascript
   mongosh
   use acme-certificates-manager
   
   const bcrypt = require('bcrypt');
   const newPassword = bcrypt.hashSync('newpassword123', 10);
   
   db.users.updateOne(
     { email: 'admin@example.com' },
     { $set: { password: newPassword } }
   )
   ```

---

### Token expired

**Symptoms:**
- "Token expired or invalid" error
- Auto-logout after some time

**Solutions:**

1. **Login again** (tokens are not refreshable by default)

2. **Increase token expiration:**
   ```bash
   # backend/.env
   JWT_EXPIRES_IN=30d  # 30 days instead of 7d
   ```

3. **Check system time:**
   - Ensure server time is synchronized
   ```bash
   timedatectl status  # Linux
   ```

---

### CORS errors

**Symptoms:**
- `Access-Control-Allow-Origin` error in browser console
- API calls fail from frontend

**Solutions:**

1. **Check CORS configuration:**
   ```typescript
   // backend/src/app.ts
   app.use(cors({
     origin: process.env.FRONTEND_URL || 'http://localhost:4200',
     credentials: true
   }));
   ```

2. **Update FRONTEND_URL:**
   ```bash
   # backend/.env
   FRONTEND_URL=http://localhost:4200
   ```

3. **Multiple origins:**
   ```typescript
   app.use(cors({
     origin: ['http://localhost:4200', 'https://yourdomain.com'],
     credentials: true
   }));
   ```

---

## Certificate Issuance Failures

### ACME account registration failed

**Symptoms:**
- "Failed to register ACME account"
- "Terms of service not accepted"

**Solutions:**

1. **Accept ToS:**
   - Ensure `termsOfServiceAgreed: true` in registration request

2. **Check CA directory URL:**
   - Let's Encrypt Production: `https://acme-v02.api.letsencrypt.org/directory`
   - Let's Encrypt Staging: `https://acme-staging-v02.api.letsencrypt.org/directory`

3. **Verify email format:**
   - Must be valid email address
   - CA may send notifications to this email

4. **Test with staging first:**
   - Use Let's Encrypt Staging to avoid rate limits

---

### Rate limit exceeded

**Symptoms:**
- "too many certificates already issued for exact set of domains"
- "too many registrations for this IP address"

**Solutions:**

1. **Let's Encrypt Rate Limits:**
   - 50 certificates per domain per week
   - 5 duplicate certificates per week
   - 500 accounts per IP per 3 hours

2. **Use Staging CA for testing:**
   - No rate limits on staging environment
   - Switch to production when ready

3. **Wait for rate limit reset:**
   - Weekly limits reset after 7 days
   - Check: https://crt.sh/?q=yourdomain.com

4. **Use different domains for testing:**
   - `test1.example.com`, `test2.example.com`

---

### DNS propagation timeout

**Symptoms:**
- "DNS record not found"
- "Timeout waiting for DNS propagation"

**Solutions:**

1. **Increase DNS propagation time:**
   - Edit DNS Provider
   - Increase "DNS Propagation Time" (e.g., 120 seconds)

2. **Verify DNS provider credentials:**
   - Click "Test" button on DNS Provider
   - Check API token permissions

3. **Manually verify DNS record:**
   ```bash
   dig _acme-challenge.example.com TXT
   nslookup -type=TXT _acme-challenge.example.com
   ```

4. **Check DNS provider API status:**
   - Cloudflare: https://www.cloudflarestatus.com/
   - DigitalOcean: https://status.digitalocean.com/

---

### Certificate download failed

**Symptoms:**
- Challenge validated but certificate not downloaded
- "Failed to finalize order"

**Solutions:**

1. **Check ACME server logs:**
   - Look for finalization errors
   - May indicate CSR issues

2. **Retry issuance:**
   - Delete and recreate certificate configuration
   - Issue again

3. **Test with staging CA:**
   - Verify configuration works in staging
   - Switch to production

---

## DNS Validation Errors

### TXT record not created

**Symptoms:**
- "Failed to create DNS record"
- DNS provider API errors

**Solutions:**

1. **Check DNS provider credentials:**
   - API token/key valid
   - Correct zone ID
   - Sufficient permissions

2. **Test provider manually:**
   - Click "Test" on DNS Provider page
   - Check error message

3. **Verify zone exists:**
   - Domain managed by DNS provider
   - Zone active and accessible

4. **Check API rate limits:**
   - May be hitting provider's API limits
   - Wait and retry

---

### TXT record not deleted

**Symptoms:**
- Old `_acme-challenge` records remain
- DNS cleanup fails

**Solutions:**

1. **Manually delete records:**
   - Login to DNS provider dashboard
   - Delete `_acme-challenge.*` TXT records

2. **Check provider permissions:**
   - Token needs delete permissions

3. **Ignore if harmless:**
   - Old challenge records don't affect functionality
   - Will be overwritten on next challenge

---

### Cloudflare specific errors

**Error: Invalid token**
- Token format incorrect
- Token expired
- Create new API token with `Zone:DNS:Edit` permission

**Error: Zone not found**
- Provide correct Zone ID
- Or leave empty for auto-detection
- Check domain is on Cloudflare account

---

### Namecheap specific errors

**Error: IP not whitelisted**
- Add server IP to Namecheap whitelist
- Account → Profile → Tools → API Access
- Find your IP: `curl ifconfig.me`

**Error: Invalid API credentials**
- Use Namecheap username (not email)
- Enable API access in account settings
- Use correct API key

---

## Renewal Issues

### Auto-renewal not working

**Symptoms:**
- Certificates expire despite auto-renewal enabled
- No renewal attempts in logs

**Solutions:**

1. **Check Agenda jobs:**
   ```javascript
   mongosh
   use acme-certificates-manager
   db.jobs.find({ name: "certificate-renewal" }).pretty()
   ```

2. **Verify auto-renewal settings:**
   - `autoRenew: true`
   - `daysBeforeRenewal` reasonable (30 days)
   - Valid `renewalTime` (24h format)

3. **Check backend is running:**
   - Agenda scheduler requires backend to be running
   - Jobs won't execute if backend is stopped

4. **Restart backend:**
   - May need to restart to re-schedule jobs
   ```bash
   pm2 restart backend
   # or
   systemctl restart acme-backend
   ```

---

### Renewal failed

**Symptoms:**
- Renewal attempt shows error
- Certificate shows "error" status

**Solutions:**

1. **Check error logs:**
   ```bash
   tail -f logs/app.log | grep renewal
   ```

2. **Common causes:**
   - DNS provider credentials changed
   - API token expired
   - Rate limit exceeded
   - Network connectivity issues

3. **Manual renewal:**
   - Click "Renew" button to try manually
   - Check error message

4. **Update DNS provider:**
   - Verify credentials still valid
   - Test provider connection

---

## Email/SMTP Problems

### Password reset emails not sent

**Symptoms:**
- "Forgot password" doesn't send email
- No error message

**Solutions:**

1. **Check SMTP configuration:**
   ```bash
   # backend/.env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=ACME Manager <your-email@gmail.com>
   ```

2. **Gmail App Password:**
   - Enable 2FA on Gmail
   - Create App Password
   - Use App Password, not regular password

3. **Test SMTP connection:**
   ```bash
   cd backend
   node -e "
   const nodemailer = require('nodemailer');
   const transporter = nodemailer.createTransport({
     host: 'smtp.gmail.com',
     port: 587,
     secure: false,
     auth: { user: 'your-email@gmail.com', pass: 'your-app-password' }
   });
   transporter.verify().then(() => console.log('SMTP OK')).catch(console.error);
   "
   ```

4. **Check firewall:**
   - Port 587 may be blocked
   - Try port 2525 or 465

---

### Emails in spam

**Symptoms:**
- Emails sent but go to spam folder

**Solutions:**

1. **Use professional SMTP service:**
   - SendGrid, Mailgun, Amazon SES
   - Better deliverability than Gmail

2. **Configure SPF/DKIM:**
   - Add SPF record to domain DNS
   - Configure DKIM signing

3. **Use proper "From" address:**
   - Use domain email (noreply@yourdomain.com)
   - Not personal Gmail

---

## Performance Issues

### Slow certificate issuance

**Symptoms:**
- Issuance takes several minutes
- Timeout errors

**Solutions:**

1. **Reduce DNS propagation time:**
   - If provider is fast (Cloudflare), use 30-60 seconds
   - Monitor and adjust based on failures

2. **Check network latency:**
   - Slow connection to ACME server
   - Slow connection to DNS provider API

3. **Review logs for delays:**
   ```bash
   tail -f logs/app.log | grep -i "time\|duration"
   ```

---

### High memory usage

**Symptoms:**
- Backend process uses excessive RAM
- Server becomes unresponsive

**Solutions:**

1. **Check memory usage:**
   ```bash
   ps aux | grep node
   top -p <PID>
   ```

2. **Restart backend:**
   ```bash
   pm2 restart backend
   ```

3. **Increase Node.js memory limit:**
   ```bash
   node --max-old-space-size=4096 app.js
   ```

4. **Review database queries:**
   - Missing indexes
   - Large result sets without pagination

---

### Database slow queries

**Symptoms:**
- API endpoints slow to respond
- High database CPU usage

**Solutions:**

1. **Create indexes:**
   ```javascript
   mongosh
   use acme-certificates-manager
   
   // Add index on domain
   db.certificates.createIndex({ domain: 1 })
   
   // Add index on status
   db.certificates.createIndex({ status: 1 })
   
   // Add compound index
   db.certificates.createIndex({ status: 1, expiryDate: 1 })
   ```

2. **Analyze slow queries:**
   ```javascript
   // Enable profiling
   db.setProfilingLevel(2)
   
   // View slow queries
   db.system.profile.find().limit(5).sort({ ts: -1 }).pretty()
   ```

3. **Use pagination:**
   - Limit query results
   - Don't fetch all certificates at once

---

## Docker Issues

### Container won't start

**Symptoms:**
- `docker-compose up` fails
- Container exits immediately

**Solutions:**

1. **Check logs:**
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   docker-compose logs mongodb
   ```

2. **Check environment variables:**
   - Create `.env` file
   - Verify all required variables

3. **Build fresh images:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

4. **Check port conflicts:**
   - Ports 3000, 4200, 27017 available
   - Change ports in docker-compose.yml if needed

---

### Volume permission errors

**Symptoms:**
- MongoDB fails to start
- Certificate files not writable

**Solutions:**

1. **Fix permissions:**
   ```bash
   sudo chown -R $USER:$USER ./certificates
   sudo chown -R $USER:$USER ./logs
   sudo chown -R 999:999 ./mongodb_data  # MongoDB user
   ```

2. **Use named volumes:**
   ```yaml
   volumes:
     - mongodb_data:/data/db
   ```

---

### Network connectivity issues

**Symptoms:**
- Backend can't connect to MongoDB
- Containers can't communicate

**Solutions:**

1. **Check Docker network:**
   ```bash
   docker network ls
   docker network inspect <network-name>
   ```

2. **Use service names:**
   ```yaml
   # Use 'mongodb' not 'localhost'
   MONGODB_URI=mongodb://mongodb:27017/acme-certificates-manager
   ```

3. **Recreate network:**
   ```bash
   docker-compose down
   docker network prune
   docker-compose up -d
   ```

---

## Getting Help

### Enable Debug Logging

```bash
# backend/.env
LOG_LEVEL=debug
```

Restart backend and check logs:
```bash
tail -f logs/app.log
```

### Collect System Information

```bash
# Node.js and npm versions
node -v
npm -v

# Operating system
uname -a  # Linux/macOS
systeminfo  # Windows

# MongoDB version
mongosh --version

# Application version
cat package.json | grep version
```

### Check Application Logs

```bash
# Backend logs
tail -n 100 logs/app.log

# System logs (Linux)
journalctl -u acme-backend -n 100

# PM2 logs
pm2 logs backend --lines 100
```

### Report Issues

When reporting issues, include:
- Detailed error message
- Steps to reproduce
- System information (OS, Node.js, MongoDB versions)
- Relevant log excerpts
- Configuration (sanitize credentials)

**GitHub Issues**: https://github.com/yourusername/acme-certificates-manager/issues

---

## Additional Resources

- [User Guide](USER_GUIDE.md) - Complete user documentation
- [Configuration Guide](CONFIGURATION.md) - Environment setup
- [API Documentation](API.md) - REST API reference
- [Development Guide](DEVELOPMENT.md) - Developer setup
- [Architecture Overview](ARCHITECTURE.md) - System design
- [DNS Provider Plugins](DNS_PROVIDER_PLUGINS.md) - Custom providers
