# ACME Certificate Manager

> A modern web-based application for automated SSL/TLS certificate management using the ACME protocol, featuring DNS-01 challenge support, automatic renewal, and deployment automation.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-%3E%3D5.0-green.svg)](https://www.mongodb.com)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

---

## Features

- **Automated Certificate Management** — Issue and renew SSL/TLS certificates via ACME protocol (Let's Encrypt, ZeroSSL, etc.)
- **DNS-01 Challenge Support** — Fully automated DNS validation with multiple provider integrations
- **HTTP-01 & TLS-ALPN-01** — Support for all three ACME challenge types
- **Smart Renewal System** — Configurable renewal windows with time randomization to avoid rate limits
- **Multi-CA Support** — Configure and use multiple Certificate Authorities simultaneously
- **Post-Issue Hooks** — Automated deployment scripts executed after certificate issuance/renewal
- **Webhooks** — HTTP notifications on certificate events with optional HMAC signing
- **Certificate Tags** — Organize and filter certificates with custom tags
- **Bulk Operations** — Enable, disable, delete, or export multiple certificates at once
- **Config Export/Import** — Backup and restore full configuration as an encrypted ZIP archive
- **Web Interface** — Modern Angular-based UI with real-time progress tracking and i18n (EN/IT)
- **Security** — AES-256-GCM encryption for stored secrets, JWT authentication, audit logging
- **API-First Design** — RESTful API for integration with external tools
- **Docker Support** — Containerized deployment via docker-compose
- **Automated Installation** — One-command installer for Debian/Ubuntu

---

## Tested Configurations

| Component | Tested |
|-----------|--------|
| Certificate Authority | Let's Encrypt (Production & Staging) |
| DNS Provider | Cloudflare |
| Platforms | Debian 11/12, Windows 10/11 |
| Authentication | Local (email/password) |

---

## Prerequisites

- **Node.js** >= 18.0.0
- **MongoDB** >= 5.0
- **npm** >= 9.x

---

## Quick Start

### Automated Installation (Debian/Ubuntu)

```bash
curl -fsSL https://github.com/mlongo4290/acme-certificates-manager/releases/latest/download/install.sh | bash
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/mlongo4290/acme-certificates-manager.git
cd acme-certificates-manager

# Install dependencies
cd backend && npm install
cd ../frontend && npm install && npm run build

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Start
cd ..
npm run dev
```

### Docker

```bash
git clone https://github.com/mlongo4290/acme-certificates-manager.git
cd acme-certificates-manager
docker-compose up -d
```

---

## Configuration

Configuration is managed via environment variables in `backend/ecosystem.config.js` (PM2) or `backend/.env`.

### Core Variables

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager

# Security (generate strong random values)
JWT_SECRET=your-very-secure-random-string-here
ENCRYPTION_KEY=your-32-character-encryption-key

# Application
PORT=3000
FRONTEND_URL=https://acme.yourdomain.com
```

### Generate Secure Keys

```bash
openssl rand -base64 32         # JWT_SECRET
openssl rand -base64 32 | cut -c1-32  # ENCRYPTION_KEY
```

### Optional: SMTP (for password reset emails)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=ACME Manager <your-email@gmail.com>
```

> For Gmail, create an App Password (requires 2FA).

### Reverse Proxy (Nginx)

```nginx
location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Increase timeouts for SSE (certificate issuance)
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}
```

See [`nginx.conf.example`](nginx.conf.example) for a complete configuration.

---

## Running in Production (PM2)

```bash
npm install -g pm2
cd backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Supported DNS Providers

### Built-in

| Provider | Status |
|----------|--------|
| Cloudflare | ✅ Tested |
| DigitalOcean | ⚠️ Implemented, untested |
| GoDaddy | ⚠️ Implemented, untested |
| Namecheap | ⚠️ Implemented, untested |
| Manual | ✅ Guided manual entry |

### Optional (require SDK installation)

| Provider | Package |
|----------|---------|
| AWS Route53 | `@aws-sdk/client-route53` |
| Google Cloud DNS | `@google-cloud/dns` |
| Azure DNS | `@azure/arm-dns @azure/identity` |
| OVH | `ovh` |

---

## Project Structure

```
acme-certificates-manager/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── controllers/        # HTTP request handlers
│   │   ├── models/             # MongoDB/Mongoose schemas
│   │   ├── services/           # Business logic
│   │   │   └── dns-providers/  # DNS provider implementations
│   │   ├── routes/             # API route definitions
│   │   └── middleware/         # Auth, error handling
│   └── package.json
├── frontend/                   # Angular SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/          # Page components
│   │   │   ├── services/       # API communication
│   │   │   └── components/     # Shared components
│   │   └── assets/i18n/        # Translations (en, it)
│   └── package.json
├── docs/                       # Documentation
├── docker-compose.yml
└── README.md
```

---

## Development

```bash
# Start both frontend and backend with hot reload
npm start

# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm start
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with clear messages
4. Push and open a Pull Request

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

- You can freely use, modify, and distribute this software
- If you run a modified version as a network service, you must make your source code available to users
- Derivative works must also be licensed under AGPL-3.0

See the [LICENSE](LICENSE) file for the full license text.

---

## Acknowledgments

- [Let's Encrypt](https://letsencrypt.org/) — Free SSL/TLS certificates
- [@peculiar/acme-client](https://github.com/PeculiarVentures/acme-client) — ACME client library
- [Agenda](https://github.com/agenda/agenda) — Job scheduling
- [Angular](https://angular.io/) — Frontend framework
- [PrimeNG](https://primeng.org/) — UI component library
- [MongoDB](https://www.mongodb.com/) — Document database

---

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/mlongo4290/acme-certificates-manager/issues)
- **Questions**: [GitHub Discussions](https://github.com/mlongo4290/acme-certificates-manager/discussions)
