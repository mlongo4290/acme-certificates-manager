#!/bin/bash

################################################################################
# ACME Certificates Manager - Automated Installation Script
# For Debian/Ubuntu Linux
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/acme-certificates-manager"
NGINX_CONFIG="/etc/nginx/sites-available/acme-certificates-manager"
SERVICE_USER="acme-certificates-manager"
CERT_DIR="/var/lib/acme-certificates-manager/certificates"
GITHUB_REPO="yourusername/acme-certificates-manager"
VERSION="${1:-latest}"  # Use argument or "latest"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}===================================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}===================================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION_ID=$VERSION_ID
    else
        print_error "Cannot detect OS. This script supports Debian/Ubuntu only."
        exit 1
    fi

    if [ "$OS" != "debian" ] && [ "$OS" != "ubuntu" ]; then
        print_error "Unsupported OS: $OS. This script supports Debian/Ubuntu only."
        exit 1
    fi

    print_success "Detected OS: $OS $VERSION_ID"
}

################################################################################
# Installation Steps
################################################################################

install_dependencies() {
    print_header "Installing System Dependencies"
    
    print_info "Updating package lists..."
    apt-get update -qq
    
    print_info "Installing required packages..."
    apt-get install -y -qq \
        curl \
        wget \
        git \
        nginx \
        mongodb \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    
    print_success "System dependencies installed"
}

install_nodejs() {
    print_header "Installing Node.js 20.x"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_info "Node.js is already installed: $NODE_VERSION"
        
        # Check if version is acceptable (v18+)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            print_success "Node.js version is acceptable"
            return
        else
            print_warning "Node.js version is too old, upgrading..."
        fi
    fi
    
    print_info "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    
    print_info "Installing Node.js..."
    apt-get install -y -qq nodejs
    
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
}

install_pm2() {
    print_header "Installing PM2 Process Manager"
    
    if command -v pm2 &> /dev/null; then
        print_info "PM2 is already installed"
        return
    fi
    
    npm install -g pm2
    print_success "PM2 installed"
}

create_service_user() {
    print_header "Creating Service User"
    
    if id "$SERVICE_USER" &>/dev/null; then
        print_info "User $SERVICE_USER already exists"
    else
        useradd -r -s /bin/bash -d $INSTALL_DIR -m $SERVICE_USER
        print_success "Created user: $SERVICE_USER"
    fi
}

download_application() {
    print_header "Downloading Application"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Installation directory exists. Backing up..."
        BACKUP_DIR="${INSTALL_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
        mv "$INSTALL_DIR" "$BACKUP_DIR"
        print_info "Backup created at: $BACKUP_DIR"
    fi
    
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    if [ "$VERSION" = "latest" ]; then
        print_info "Downloading latest release from GitHub..."
        DOWNLOAD_URL="https://github.com/$GITHUB_REPO/archive/refs/heads/main.zip"
    else
        print_info "Downloading version $VERSION from GitHub..."
        DOWNLOAD_URL="https://github.com/$GITHUB_REPO/archive/refs/tags/$VERSION.zip"
    fi
    
    wget -q --show-progress "$DOWNLOAD_URL" -O release.zip
    unzip -q release.zip
    rm release.zip
    
    # Move contents from extracted folder to current directory
    EXTRACTED_DIR=$(ls -d */ | head -1)
    mv "$EXTRACTED_DIR"* .
    mv "$EXTRACTED_DIR".* . 2>/dev/null || true
    rmdir "$EXTRACTED_DIR"
    
    chown -R $SERVICE_USER:$SERVICE_USER "$INSTALL_DIR"
    
    print_success "Application downloaded"
}

setup_backend() {
    print_header "Setting Up Backend"
    
    cd "$INSTALL_DIR/backend"
    
    print_info "Installing Node.js dependencies..."
    sudo -u $SERVICE_USER npm install --production
    
    print_info "Building TypeScript..."
    sudo -u $SERVICE_USER npm run build
    
    print_success "Backend setup complete"
}

setup_frontend() {
    print_header "Setting Up Frontend"
    
    cd "$INSTALL_DIR/frontend"
    
    print_info "Installing Node.js dependencies..."
    sudo -u $SERVICE_USER npm install
    
    print_info "Building Angular application..."
    sudo -u $SERVICE_USER npm run build
    
    # Copy built files to nginx directory
    NGINX_ROOT="/var/www/acme-certificates-manager"
    mkdir -p "$NGINX_ROOT"
    cp -r dist/acme-certificates-manager/browser/* "$NGINX_ROOT/"
    chown -R www-data:www-data "$NGINX_ROOT"
    chmod -R 755 "$NGINX_ROOT"
    
    print_success "Frontend setup complete"
}

setup_mongodb() {
    print_header "Setting Up MongoDB"
    
    print_info "Starting MongoDB service..."
    systemctl enable mongodb
    systemctl start mongodb
    
    # Wait for MongoDB to be ready
    print_info "Waiting for MongoDB to be ready..."
    sleep 3
    
    print_success "MongoDB is running"
}

seed_database() {
    print_header "Seeding Database"
    
    cd "$INSTALL_DIR/backend"
    
    print_info "Creating default admin user and ACME CAs..."
    sudo -u $SERVICE_USER npm run seed
    
    print_success "Database seeded successfully"
    print_warning "Default credentials: admin / admin"
    print_warning "CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!"
}

generate_config() {
    print_header "Generating Configuration"
    
    # Generate random JWT secret (64 characters base64)
    JWT_SECRET=$(openssl rand -base64 48)
    
    # Generate random encryption key (32 bytes base64)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    # Create .env file
    cat > .env << EOF
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=localhost

# MongoDB
MONGODB_URI=mongodb://localhost:27017/acme-certificates-manager

# JWT Secret (generated during installation)
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h

# Encryption Key (generated during installation)
ENCRYPTION_KEY=$ENCRYPTION_KEY

# CORS
CORS_ORIGIN=http://localhost

# Frontend URL
FRONTEND_URL=http://localhost

# Email Configuration (optional - configure later)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@example.com
# SMTP_PASS=your-password
# SMTP_FROM=noreply@example.com
# SMTP_FROM_NAME=ACME Certificates Manager

# Logging Configuration
LOG_LEVEL=info
LOG_DIR=/var/log/acme-certificates-manager
ENABLE_CONSOLE_LOGS=true
ENABLE_FILE_LOGS=true
LOG_MAX_FILES=14d
LOG_DATE_PATTERN=YYYY-MM-DD
EOF
    
    chown $SERVICE_USER:$SERVICE_USER "$INSTALL_DIR/backend/.env"
    chmod 600 "$INSTALL_DIR/backend/.env"
    
    # Create log directory
    mkdir -p /var/log/acme-certificates-manager
    chown $SERVICE_USER:$SERVICE_USER /var/log/acme-certificates-manager
    chmod 755 /var/log/acme-certificates-manager

    print_success "Configuration file created with secure random keys"
}

setup_certificates_directory() {
    print_header "Setting Up Certificates Directory"
    
    mkdir -p "$CERT_DIR"
    chown $SERVICE_USER:$SERVICE_USER "$CERT_DIR"
    chmod 755 "$CERT_DIR"
    
    print_success "Certificates directory created at: $CERT_DIR"
}

configure_nginx() {
    print_header "Configuring Nginx"
    
    # Generate self-signed certificate for initial setup
    SSL_DIR="/etc/ssl/acme-certificates-manager"
    mkdir -p "$SSL_DIR"
    
    print_info "Generating temporary self-signed certificate..."
    openssl req -x509 -nodes -days 7 -newkey rsa:2048 \
        -keyout "$SSL_DIR/temp-privkey.pem" \
        -out "$SSL_DIR/temp-fullchain.pem" \
        -subj "/CN=localhost" 2>/dev/null
    
    chmod 600 "$SSL_DIR/temp-privkey.pem"
    chmod 644 "$SSL_DIR/temp-fullchain.pem"
    
    # Create Nginx configuration
    cat > "$NGINX_CONFIG" << 'EOF'
upstream acme_backend {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name _;
    
    # Temporary self-signed certificate (replace with real certificate)
    ssl_certificate /etc/ssl/acme-certificates-manager/temp-fullchain.pem;
    ssl_certificate_key /etc/ssl/acme-certificates-manager/temp-privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Max upload size
    client_max_body_size 10M;
    
    # Frontend root
    root /var/www/acme-certificates-manager;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
    
    # API proxy
    location /api/ {
        proxy_pass http://acme_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Frontend static files
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Deny hidden files
    location ~ /\. {
        deny all;
    }
}
EOF
    
    # Enable site
    ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/acme-certificates-manager
    
    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
    
    print_success "Nginx configured and reloaded"
    print_warning "Using temporary self-signed certificate (7 days)"
    print_info "Use the web interface to issue a real certificate!"
}

setup_pm2() {
    print_header "Setting Up PM2 Service"
    
    cd "$INSTALL_DIR/backend"
    
    # Create PM2 ecosystem file with environment variables from .env
    print_info "Creating PM2 ecosystem configuration..."
    cat > ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [{
    name: 'acme-backend',
    script: 'dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_file: '.env',
    error_file: '/var/log/acme-certificates-manager/pm2-error.log',
    out_file: '/var/log/acme-certificates-manager/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
EOFPM2
    
    chown $SERVICE_USER:$SERVICE_USER ecosystem.config.js
    
    # Start application with PM2 using ecosystem file
    print_info "Starting application with PM2..."
    sudo -u $SERVICE_USER pm2 start ecosystem.config.js
    
    # Generate startup script
    print_info "Setting up PM2 to start on boot..."
    pm2 startup systemd -u $SERVICE_USER --hp "$INSTALL_DIR"
    
    # Save PM2 process list
    sudo -u $SERVICE_USER pm2 save
    
    print_success "PM2 service configured"
}

configure_firewall() {
    print_header "Configuring Firewall"
    
    if command -v ufw &> /dev/null; then
        print_info "Configuring UFW firewall..."
        
        # Allow SSH (important!)
        ufw allow ssh
        
        # Allow HTTP and HTTPS
        ufw allow 80/tcp
        ufw allow 443/tcp
        
        # Enable UFW if not already enabled
        echo "y" | ufw enable 2>/dev/null || true
        
        print_success "Firewall configured"
    else
        print_warning "UFW not found, skipping firewall configuration"
    fi
}

print_summary() {
    print_header "Installation Complete!"
    
    echo -e "${GREEN}"
    echo "  ╔════════════════════════════════════════════════════════════════╗"
    echo "  ║         ACME Certificates Manager Successfully Installed       ║"
    echo "  ╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "\n${BLUE}Installation Details:${NC}"
    echo -e "  • Installation Directory: ${GREEN}$INSTALL_DIR${NC}"
    echo -e "  • Certificates Directory: ${GREEN}$CERT_DIR${NC}"
    echo -e "  • Service User: ${GREEN}$SERVICE_USER${NC}"
    echo -e "  • MongoDB: ${GREEN}Running on localhost:27017${NC}"
    echo -e "  • Backend API: ${GREEN}Running on localhost:3000${NC}"
    echo -e "  • Nginx: ${GREEN}Running on ports 80 and 443${NC}"
    
    echo -e "\n${BLUE}Access Information:${NC}"
    echo -e "  • Web Interface: ${GREEN}https://$(hostname -I | awk '{print $1}')${NC}"
    echo -e "  • Default Login: ${YELLOW}admin / admin${NC}"
    echo -e "  • ${RED}⚠ CHANGE DEFAULT PASSWORD IMMEDIATELY!${NC}"
    
    echo -e "\n${BLUE}SSL Certificate:${NC}"
    echo -e "  • ${YELLOW}Currently using temporary self-signed certificate (7 days)${NC}"
    echo -e "  • ${GREEN}Use the web interface to issue a real Let's Encrypt certificate${NC}"
    
    echo -e "\n${BLUE}Useful Commands:${NC}"
    echo -e "  • View backend logs: ${GREEN}sudo -u $SERVICE_USER pm2 logs acme-backend${NC}"
    echo -e "  • Restart backend: ${GREEN}sudo -u $SERVICE_USER pm2 restart acme-backend${NC}"
    echo -e "  • Check PM2 status: ${GREEN}sudo -u $SERVICE_USER pm2 status${NC}"
    echo -e "  • Reload Nginx: ${GREEN}sudo systemctl reload nginx${NC}"
    echo -e "  • MongoDB logs: ${GREEN}sudo journalctl -u mongodb${NC}"
    
    echo -e "\n${BLUE}Next Steps:${NC}"
    echo -e "  1. Access the web interface"
    echo -e "  2. Login with default credentials"
    echo -e "  3. ${RED}Change the admin password${NC}"
    echo -e "  4. Configure an ACME CA (Let's Encrypt recommended)"
    echo -e "  5. Configure a DNS provider"
    echo -e "  6. Issue your first certificate!"
    
    echo -e "\n${BLUE}Documentation:${NC}"
    echo -e "  • User Guide: ${GREEN}$INSTALL_DIR/docs/USER_GUIDE.md${NC}"
    echo -e "  • Configuration: ${GREEN}$INSTALL_DIR/docs/CONFIGURATION.md${NC}"
    echo -e "  • Troubleshooting: ${GREEN}$INSTALL_DIR/docs/TROUBLESHOOTING.md${NC}"
    
    echo -e "\n${YELLOW}⚠  Important Security Notes:${NC}"
    echo -e "  • Change default admin password immediately"
    echo -e "  • Configure MongoDB authentication for production"
    echo -e "  • Review firewall settings"
    echo -e "  • Set up automated backups"
    echo -e "  • Keep the system updated"
    
    echo ""
}

################################################################################
# Main Installation Flow
################################################################################

main() {
    clear
    
    cat << "EOF"
    
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║        ACME Certificates Manager - Automated Installer       ║
    ║                                                               ║
    ║        Manages SSL/TLS certificates via ACME protocol        ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
    
EOF
    
    print_info "This script will install ACME Certificates Manager on your system"
    print_warning "Installation requires root privileges and will modify system configuration"
    
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi
    
    # Pre-flight checks
    #check_root
    #check_os
    
    # Installation steps
    #install_dependencies
    #install_nodejs
    #install_pm2
    #create_service_user
    #download_application
    #setup_backend
    #setup_frontend
    #setup_mongodb
    #generate_config
    #seed_database
    #setup_certificates_directory
    configure_nginx
    #setup_pm2
    #configure_firewall
    
    # Summary
    print_summary
}

# Run installation
main "$@"
