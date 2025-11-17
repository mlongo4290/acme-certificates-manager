# ACME Certificate Manager

> A modern web-based application for automated SSL/TLS certificate management using the ACME protocol, featuring DNS-01 challenge support, automatic renewal, and deployment automation.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-%3E%3D5.0-green.svg)](https://www.mongodb.com)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

---

## ⚠️ Project Status

**This project was developed primarily (~90%) using AI assistance (GitHub Copilot & Claude) and should be considered experimental.**

### ✅ Tested Configurations
- **Certificate Authority**: Let's Encrypt (Production & Staging)
- **DNS Provider**: Cloudflare
- **Platforms**: Windows 10/11, Debian 11/12 (native installation)
- **Authentication**: Local (email/password)

### ⚠️ Untested/Experimental
- **Other DNS Providers**: DigitalOcean, GoDaddy, Namecheap, Route53, Google Cloud DNS, Azure DNS, OVH
- **Other CAs**: ZeroSSL, Buypass, Google Trust Services
- **Multi-provider authentication**: LDAP, OAuth2, Azure AD, OIDC, SAML
- **Password reset via email**: SMTP configuration

---

## 🚀 Features

- **Automated Certificate Management**: Issue and renew SSL/TLS certificates automatically using ACME protocol (Let's Encrypt, ZeroSSL, etc.)
- **DNS-01 Challenge Support**: Fully automated DNS validation with multiple provider integrations
- **Smart Renewal System**: Configurable renewal windows with randomization to avoid rate limits
- **Web Interface**: Modern Angular-based UI for configuration and monitoring
- **Multi-CA Support**: Support for multiple ACME Certificate Authorities
- **Post-Issue Hooks**: Automated deployment scripts for Nginx, Proxmox VE, VMware vCenter
- **Security Features**: JWT authentication, encrypted secrets, audit logging
- **API-First Design**: RESTful API for integration with other systems
- **Docker Support**: Containerized deployment with docker-compose
- **Automated Installation**: One-command installation script for Debian/Ubuntu

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org))
- MongoDB 5.0+ ([Installation Guide](https://docs.mongodb.com/manual/installation))
- Git ([Download](https://git-scm.com))

### Automated Installation (Recommended)

For Debian/Ubuntu systems, use the automated installer:

```bash
# Download and run the installer
curl -fsSL https://github.com/mlongo4290/acme-certificates-manager/releases/latest/download/install.sh | bash
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/mlongo4290/acme-certificates-manager.git
cd acme-certificates-manager

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Build the frontend
npm run build

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Start the application
cd ..
npm run dev  # Runs both backend and frontend in development mode
```

---

## 📦 Installation

### Option 1: Automated Installation (Linux)

```bash
# Download the latest release
curl -fsSL https://github.com/mlongo4290/acme-certificates-manager/releases/latest/download/install.sh | bash
```

### Option 2: Docker Deployment

```bash
# Clone and deploy with Docker
git clone https://github.com/mlongo4290/acme-certificates-manager.git
cd acme-certificates-manager
docker-compose up -d
```

### Option 3: Manual Installation

See the [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

---

## ⚙️ Configuration

Configuration is done via **environment variables** set in `backend/ecosystem.config.js` for PM2 deployments.

### Quick Start Configuration

Edit `backend/ecosystem.config.js`:

```javascript
env: {
    NODE_ENV: 'production',
    PORT: '3000',
    MONGODB_URI: 'mongodb://localhost:27017/acme-certificates-manager',
    JWT_SECRET: 'your-super-secure-jwt-secret-here-min-32-chars',
    ENCRYPTION_KEY: 'your-32-character-encryption-key',
    FRONTEND_URL: 'https://acme.yourdomain.com',
    // SMTP (optional - leave empty to disable emails)
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: 'your-email@gmail.com',
    SMTP_PASS: 'your-app-password'
}
```

### Generate Secure Keys

```bash
# Generate JWT Secret (min 32 chars)
openssl rand -base64 32

# Generate Encryption Key (32 chars)
openssl rand -base64 32 | cut -c1-32
```

See [backend/CONFIGURATION.md](backend/CONFIGURATION.md) for complete configuration reference.

### Reverse Proxy Configuration

The application is designed to work behind a reverse proxy (Nginx, Apache, Traefik, etc.). The frontend uses **relative URLs** (`/api/*`) which are automatically proxied to the backend.

#### Example Nginx Configuration

See [`nginx.conf.example`](nginx.conf.example) for a complete configuration example.

Key points:
- Frontend: Serve static files from `/var/www/acm/frontend`
- Backend API: Proxy `/api/*` requests to `http://localhost:3000/api/`
- WebSocket support required for SSE (Server-Sent Events) during certificate issue
- Increase timeouts for long-running operations

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
}
```

#### Development Mode

In development, the Angular dev server uses a proxy configuration (`proxy.conf.json`) to forward `/api/*` requests to `http://localhost:3000`.

No code changes required - the same build works for both development and production!

### DNS Provider Setup

Configure DNS providers in the web interface or via API. See [DNS Providers Guide](docs/DNS_PROVIDERS.md).

---

## 📖 Usage

### Web Interface

1. Open your browser to `http://localhost:4200` (development) or your configured domain
2. Create an admin account on first login
3. Configure ACME Certificate Authorities
4. Set up DNS providers
5. Create and manage certificates

### Production Deployment with PM2

For production, use PM2 to manage the backend process:

```bash
# Install PM2 globally
npm install -g pm2

# Backend directory
cd backend

# Start with ecosystem file (automatically loads .env)
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Monitor logs
pm2 logs acme-backend

# Check status
pm2 status
```

The `ecosystem.config.js` file is configured to:
- Load environment variables from `.env`
- Enable auto-restart on crashes
- Manage log rotation
- Set memory limits

### API Usage

```bash
# Get all certificates
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/certificates

# Create a new certificate
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"domain":"example.com","dnsProvider":"cloudflare"}' \
  http://localhost:3000/api/certificates
```

---

## 📚 Documentation

- **[User Guide](docs/USER_GUIDE.md)** - Complete user manual
- **[API Documentation](docs/API.md)** - REST API reference
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment
- **[Configuration Guide](docs/CONFIGURATION.md)** - Advanced configuration
- **[DNS Providers](docs/DNS_PROVIDERS.md)** - DNS provider setup
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

---

## 🤝 Contributing

We welcome contributions! Please see our [Development Guide](docs/DEVELOPMENT.md) for details on how to contribute to the project.

### Development Setup

```bash
# Fork and clone
git clone https://github.com/your-username/acme-certificates-manager.git
cd acme-certificates-manager

# Install dependencies
npm install

# Start development servers
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Run linting
npm run lint
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Angular](https://angular.io), [Node.js](https://nodejs.org), and [MongoDB](https://mongodb.com)
- UI components from [PrimeNG](https://primeng.org)
- Icons from [PrimeIcons](https://primeng.org/icons)
- Font: [Lato](https://fonts.google.com/specimen/Lato)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/mlongo4290/acme-certificates-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mlongo4290/acme-certificates-manager/discussions)
- **Documentation**: [Project Wiki](https://github.com/mlongo4290/acme-certificates-manager/wiki)

---

*Made with ❤️ using AI assistance*

- **Docker Deployment**: Docker Compose configuration exists but is **untested**

- **Authentication Providers**: LDAP, OAuth2, Azure AD, OIDC, SAML- **Post-Issue Scripts**: Execute custom deployment scripts after certificate issue- Docker support (optional)

- **Other Platforms**: macOS, other Linux distributions

- **Production Environments**: This has not been tested in production workloads- **Multi-Provider Authentication**: Local, LDAP, OAuth2, Azure AD, OIDC, SAML support



**Use at your own risk. Test thoroughly in a staging environment before production use.**- **Web Management Interface**: Modern Angular-based UI with real-time progress tracking## Prerequisites



---- **Job Scheduling**: Powered by Agenda with MongoDB persistence



## 🚀 Features- **Security First**: AES-256-GCM encryption for sensitive data, bcrypt for passwords- Node.js >= 16



- **Automated Certificate Issuance**: Generate SSL/TLS certificates using ACME protocol (Let's Encrypt, ZeroSSL, etc.)- MongoDB >= 5.0

- **DNS-01 Challenge**: Fully automated DNS validation with multiple provider integrations

- **Auto-Renewal**: Configurable renewal schedules with time randomization to avoid rate limits## 📋 Prerequisites- Angular CLI

- **Post-Issuance Scripts**: Execute custom deployment scripts after certificate issuance/renewal

- **Web Interface**: Modern Angular-based UI for management and monitoring- Docker (optional)

- **Job Scheduling**: Background job system (Agenda) for automatic certificate renewal

- **Multi-CA Support**: Configure multiple Certificate Authorities- **Node.js** >= 18.0.0

- **Security**: AES-256-GCM encryption for sensitive credentials, bcrypt password hashing, JWT authentication

- **MongoDB** >= 5.0## Installation

## 📋 Prerequisites

- **Angular CLI** (for development)

- **Node.js** >= 18.0.0

- **MongoDB** >= 5.0- **Docker** (optional, for containerized deployment)1. Install dependencies:

- **npm** >= 9.x

- **DNS Provider Account** (Cloudflare recommended for testing)```bash



## 🔧 Quick Start## 🔧 Quick Startnpm run install:all



### 1. Installation```



```bash### 1. Installation

# Clone the repository

git clone <repository-url>2. Configure environment variables:

cd acme-certificates-manager

```bash   - Copy `.env.example` to `.env` in the backend directory

# Install all dependencies (backend + frontend)

npm run install:all# Clone the repository   - Update the variables with your settings

```

git clone <repository-url>   - Configure SMTP settings for password reset emails (optional)

### 2. MongoDB Setup

cd acme-certificates-manager

**Option A: Local MongoDB**

```bash3. Start the development servers:

# Ubuntu/Debian

sudo apt-get install mongodb-org# Install all dependencies (backend + frontend)```bash

sudo systemctl start mongod

npm run install:allnpm start

# Windows

# Download and install MongoDB Community Server from mongodb.com``````

```



**Option B: MongoDB Atlas (Cloud)**

- Create free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)### 2. Configuration## Development

- Get connection string



### 3. Environment Configuration

```bash- Frontend runs on: http://localhost:4200

```bash

# Copy environment template# Copy environment template- Backend API runs on: http://localhost:3000

cp backend/.env.example backend/.env

cp backend/.env.example backend/.env

# Edit configuration

nano backend/.env  # or use your preferred editor### Running with Docker

```

# Edit configuration

**Minimum Required Configuration:**

nano backend/.env```bash

```env

# MongoDB Connection```# Build containers

MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager

# Or for MongoDB Atlas:npm run docker:build

# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/acme-certificates-manager

**Required Environment Variables:**

# JWT Secret (generate a strong random string)

JWT_SECRET=your-very-secure-random-string-here# Start services



# Frontend URL```envnpm run docker:up

FRONTEND_URL=http://localhost:4200

# MongoDB

# Server Port

PORT=3000MONGO_URI=mongodb://localhost:27017/acme-certificates# Stop services

```

npm run docker:down

**Optional: SMTP for Password Reset**

# Security```

```env

SMTP_HOST=smtp.gmail.comJWT_SECRET=<generate-strong-random-key>

SMTP_PORT=587

SMTP_SECURE=falseENCRYPTION_KEY=<32-byte-hex-string>## Configuration

SMTP_USER=your-email@gmail.com

SMTP_PASS=your-gmail-app-password

SMTP_FROM=ACME Manager <your-email@gmail.com>

```# Server### SMTP Email Setup (Optional)



> **Note**: For Gmail, you need to create an App Password (enable 2FA first).PORT=3000



### 4. Start Development ServersNODE_ENV=developmentThe application supports password reset via email. To enable this feature, configure the SMTP settings in your `.env` file:



```bash

# Start both backend and frontend

npm start# Optional: SMTP for password reset```env



# Or start individually:SMTP_HOST=smtp.example.comSMTP_HOST=smtp.gmail.com

npm run start:backend   # Backend API: http://localhost:3000

npm run start:frontend  # Frontend UI: http://localhost:4200SMTP_PORT=587SMTP_PORT=587

```

SMTP_USER=your-email@example.comSMTP_SECURE=false

### 5. First Login

SMTP_PASS=your-passwordSMTP_USER=your-email@gmail.com

Open your browser to `http://localhost:4200` and login with default credentials:

```SMTP_PASS=your-app-password

```

Email: admin@example.comSMTP_FROM=noreply@acme-certificates-manager.com

Password: admin

```### 3. Start Development ServersSMTP_FROM_NAME=ACME Certificates Manager



**⚠️ IMPORTANT: Change the default password immediately after first login!**```



Go to Profile → Change Password to set a secure password.```bash



---# Start both backend and frontend**Supported SMTP Providers:**



## 📖 Documentationnpm start- **Gmail**: Use App Password (not regular password). Enable 2FA and create an App Password.



Comprehensive documentation is available in the `/docs` directory:- **Outlook/Office365**: smtp-mail.outlook.com:587



### For Users# Or start individually- **SendGrid**: smtp.sendgrid.net:587



- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for certificate managementnpm run start:backend  # Backend API on http://localhost:3000- **Mailgun**: smtp.mailgun.org:587

- **[Configuration Guide](docs/CONFIGURATION.md)** - Environment setup and configuration options

- **[DNS Providers Guide](docs/DNS_PROVIDERS.md)** - Supported DNS providers and setup instructionsnpm run start:frontend # Frontend UI on http://localhost:4200

- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

```If SMTP is not configured, password reset tokens will be logged to the console (development mode only).

### For Developers



- **[Development Guide](docs/DEVELOPMENT.md)** - Development environment and workflow

- **[API Documentation](docs/API.md)** - REST API endpoints reference### 4. Default Login### Authentication Providers

- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and components

- **[Creating DNS Provider Plugins](docs/DNS_PROVIDER_PLUGINS.md)** - Extend with custom providers

- **[Testing Guide](docs/TESTING.md)** - Testing strategies and best practices

```The application supports multiple authentication methods:

---

Email: admin@example.com- **Local**: Username/password stored in MongoDB

## 🐳 Docker Deployment (⚠️ UNTESTED)

Password: admin- **LDAP**: Active Directory or other LDAP servers

The project includes Docker configuration, but **it has not been tested**. Use with caution.

```- **OAuth2**: Generic OAuth2 providers

```bash

# Build and start containers- **Azure AD**: Microsoft Azure Active Directory

docker-compose up -d

**⚠️ Change the default password immediately after first login!**- **OpenID Connect (OIDC)**: Keycloak, Auth0, etc.

# View logs

docker-compose logs -f- **SAML 2.0**: Enterprise SSO providers



# Stop containers## 📖 Documentation

docker-compose down

```Configure authentication providers through the Admin panel at `/admin/auth-providers`.



If you test Docker deployment successfully, please report your findings via GitHub Issues.Comprehensive documentation is available in the `/docs` directory:



---## Project Structure



## 🏗️ Project Structure### User Documentation



```- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for end users```

acme-certificates-manager/

├── backend/                 # Node.js/Express API- **[Configuration Guide](docs/CONFIGURATION.md)** - Environment and application setupacmecertificates-manager/

│   ├── src/

│   │   ├── controllers/    # HTTP request handlers- **[DNS Providers Guide](docs/DNS_PROVIDERS.md)** - Supported DNS providers and setup├── frontend/           # Angular application

│   │   ├── models/         # MongoDB/Mongoose models

│   │   ├── services/       # Business logic- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions├── backend/           # Node.js API server

│   │   │   ├── acme.service.ts           # ACME protocol implementation

│   │   │   ├── certificate.service.ts    # Certificate management├── docker/            # Docker configuration

│   │   │   └── dns-providers/            # DNS provider plugins

│   │   │       ├── cloudflare-dns-provider.ts  (✅ Tested)### Developer Documentation└── .vscode/           # VS Code configuration

│   │   │       ├── digitalocean-dns-provider.ts  (⚠️ Untested)

│   │   │       ├── godaddy-dns-provider.ts       (⚠️ Untested)- **[Development Guide](docs/DEVELOPMENT.md)** - Setup and development workflow```

│   │   │       ├── namecheap-dns-provider.ts     (⚠️ Untested)- **[API Documentation](docs/API.md)** - REST API endpoints reference

│   │   │       └── ... (other providers)- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and components

│   │   ├── routes/         # API routes- **[Creating DNS Provider Plugins](docs/DNS_PROVIDER_PLUGINS.md)** - Extend with custom providers

│   │   ├── middleware/     # Express middleware- **[Testing Guide](docs/TESTING.md)** - Testing strategies and guidelines

│   │   └── jobs/           # Scheduled jobs (Agenda)

│   └── package.json## 🐳 Docker Deployment

│

├── frontend/               # Angular 18 SPA```bash

│   ├── src/# Build and start containers

│   │   ├── app/docker-compose up -d

│   │   │   ├── pages/      # Page components

│   │   │   ├── services/   # API communication services# View logs

│   │   │   ├── guards/     # Route guards (auth)docker-compose logs -f

│   │   │   └── models/     # TypeScript interfaces

│   │   ├── assets/# Stop containers

│   │   │   └── i18n/       # Translations (en, it)docker-compose down

│   │   └── environments/   # Environment configs```

│   └── package.json

│The application will be available at:

├── docs/                   # Documentation (9 comprehensive guides)- Frontend: http://localhost:8080

├── certificates/           # Certificate storage (runtime)- Backend API: http://localhost:3000

├── logs/                   # Application logs

├── docker-compose.yml      # Docker orchestration (⚠️ Untested)## 🏗️ Project Structure

└── README.md              # This file

``````

acme-certificates-manager/

---├── backend/                 # Node.js/Express API

│   ├── src/

## 🔌 Supported DNS Providers│   │   ├── controllers/    # Request handlers

│   │   ├── models/         # MongoDB schemas

### ✅ Tested & Working│   │   ├── services/       # Business logic

│   │   │   └── dns-providers/  # DNS provider implementations

- **Cloudflare** - Fully tested with Let's Encrypt│   │   ├── routes/         # API routes

│   │   └── middleware/     # Custom middleware

### ⚠️ Implemented but Untested│   └── package.json

├── frontend/               # Angular SPA

#### Built-in (No Additional Installation Required)│   ├── src/

│   │   ├── app/

- **DigitalOcean** - API v2 integration│   │   │   ├── pages/     # Page components

- **GoDaddy** - Production API integration│   │   │   ├── services/  # API services

- **Namecheap** - Requires IP whitelisting│   │   │   └── guards/    # Route guards

- **Manual** - Guided manual DNS record creation│   │   └── assets/

│   └── package.json

#### Optional (Require SDK Installation)├── docs/                   # Documentation

├── docker-compose.yml      # Docker orchestration

- **AWS Route53** - Requires `npm install @aws-sdk/client-route53`└── README.md

- **Google Cloud DNS** - Requires `npm install @google-cloud/dns````

- **Azure DNS** - Requires `npm install @azure/arm-dns @azure/identity`

- **OVH** - Requires `npm install ovh`## 🔌 Supported DNS Providers



> **If you test any of these providers successfully, please share your experience via GitHub Issues or Discussions!**### Built-in (No Additional Installation)

- ✅ **Cloudflare** - Full API support

See [DNS Providers Setup Guide](docs/DNS_PROVIDERS.md) for configuration instructions.- ✅ **DigitalOcean** - Full API support

- ✅ **GoDaddy** - Full API support

---- ✅ **Namecheap** - Full API support

- ✅ **Manual** - Guided manual DNS record creation

## 🧪 Testing the Application

### Optional (Require SDK Installation)

### Recommended Testing Path- 🔧 **AWS Route53** - Requires `@aws-sdk/client-route53`

- 🔧 **Google Cloud DNS** - Requires `@google-cloud/dns`

1. **Use Let's Encrypt Staging** first to avoid rate limits:- 🔧 **Azure DNS** - Requires `@azure/arm-dns` and `@azure/identity`

   - Create CA: `https://acme-staging-v02.api.letsencrypt.org/directory`- 🔧 **OVH** - Requires `ovh` package

   - Test certificate issuance workflow

See [DNS Providers Setup Guide](docs/DNS_PROVIDERS.md) for detailed configuration instructions.

2. **Use Cloudflare DNS Provider** (tested and working):

   - Create API Token with `Zone:DNS:Edit` permissions## 🤝 Contributing

   - Configure DNS Provider in the app

   - Test with a real domain you controlContributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting PRs.



3. **Test with a subdomain** first:### Development Workflow

   - Use a test subdomain like `test.yourdomain.com`

   - Verify DNS record creation/deletion1. Fork the repository

   - Check certificate issuance2. Create a feature branch: `git checkout -b feature/amazing-feature`

3. Commit your changes: `git commit -m 'Add amazing feature'`

4. **Move to Production** when ready:4. Push to the branch: `git push origin feature/amazing-feature`

   - Switch to Let's Encrypt Production CA5. Open a Pull Request

   - Issue certificate for your main domain

## 📄 License

### Testing Other Components

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Other DNS Providers:**

- Each provider needs valid API credentials## 🙏 Acknowledgments

- Test credential validation first (Test button in UI)

- Monitor logs for detailed error messages- [Let's Encrypt](https://letsencrypt.org/) - Free SSL/TLS certificates

- [ACME Protocol](https://tools.ietf.org/html/rfc8555) - RFC 8555 specification

**Docker Deployment:**- [@peculiar/acme-client](https://github.com/PeculiarVentures/acme-client) - ACME client library

- Review `docker-compose.yml` before use- [Agenda](https://github.com/agenda/agenda) - Job scheduling

- Check environment variables- [Angular](https://angular.io/) - Frontend framework

- Test in isolated environment first- [PrimeNG](https://primeng.org/) - UI component library



**Other Certificate Authorities:**## 📞 Support

- ZeroSSL, Buypass, Google Trust Services are configured but untested

- May require additional setup or different credential formats- 📖 [Documentation](docs/)

- 🐛 [Issue Tracker](https://github.com/yourusername/acme-certificates-manager/issues)

---- 💬 [Discussions](https://github.com/yourusername/acme-certificates-manager/discussions)



## 🛠️ Development---



### Running in Development Mode**Made with ❤️ for the open-source community**


```bash
# Backend with hot reload
cd backend
npm run dev

# Frontend with hot reload
cd frontend
npm start
```

### Code Quality

```bash
# Backend linting
cd backend
npm run lint

# Frontend linting
cd frontend
npm run lint
```

### Building for Production

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
```

---

## 🤝 Contributing

Contributions are welcome! This project was built with AI assistance and can benefit from:

- Testing on different platforms (macOS, other Linux distros)
- Testing Docker deployment
- Testing additional DNS providers
- Testing other Certificate Authorities
- Bug reports and fixes
- Documentation improvements
- Feature enhancements

### How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Test your changes thoroughly
4. Commit with clear messages: `git commit -m 'Add: your feature'`
5. Push to your fork: `git push origin feature/your-feature`
6. Open a Pull Request with detailed description

**Please include:**
- What was tested
- What platform/environment
- Any issues encountered
- Screenshots/logs if relevant

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **AI Tools**: This project was developed with extensive assistance from GitHub Copilot and Claude AI
- **[Let's Encrypt](https://letsencrypt.org/)** - Free SSL/TLS certificates for everyone
- **[ACME Protocol](https://tools.ietf.org/html/rfc8555)** - RFC 8555 specification
- **[acme-client](https://www.npmjs.com/package/acme-client)** - Node.js ACME client library
- **[Agenda](https://github.com/agenda/agenda)** - Job scheduling for Node.js
- **[Angular](https://angular.io/)** - Frontend framework
- **[PrimeNG](https://primeng.org/)** - Rich UI component library
- **[MongoDB](https://www.mongodb.com/)** - Document database
- **Open Source Community** - For the amazing tools and libraries

---

## 📞 Support & Feedback

- 📖 **Documentation**: Check the `/docs` folder for detailed guides
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/mlongo4290/acme-certificates-manager/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/mlongo4290/acme-certificates-manager/discussions)
- ⭐ **Star this repo** if you find it useful!

---

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### What does this mean?

- ✅ You can freely use, modify, and distribute this software
- ✅ You can use it commercially
- ⚠️ **If you run a modified version as a network service**, you must make your source code available to users
- ⚠️ Any derivative works must also be licensed under AGPL-3.0

This strong copyleft license ensures that improvements to the software remain open source and benefit the entire community.

For the full license text, see the [LICENSE](LICENSE) file or visit https://www.gnu.org/licenses/agpl-3.0.html

### Third-Party Licenses

This project uses several open-source libraries. Key dependencies include:

- **Backend**: 
  - `@peculiar/acme-client` (AGPL-3.0) - ACME protocol implementation
  - `express` (MIT) - Web framework
  - `mongoose` (MIT) - MongoDB ODM
  - `passport` (MIT) - Authentication middleware

- **Frontend**:
  - `@angular/*` (MIT) - Web framework
  - `primeng` (MIT) - UI components
  - `tailwindcss` (MIT) - CSS framework

For a complete list of dependencies and their licenses, see [LICENSE-COMPLIANCE.md](LICENSE-COMPLIANCE.md)

---

## ⚖️ Disclaimer

This software is provided "as is", without warranty of any kind. The authors and contributors are not responsible for any damage or data loss that may occur from using this software.

**Always test in a non-production environment first!**

---

**Made with 🤖 AI assistance and ❤️ for the open-source community**
