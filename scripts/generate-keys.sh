#!/bin/bash

################################################################################
# ACME Certificates Manager - Generate Secure Keys
# Generates random secure keys for JWT_SECRET and ENCRYPTION_KEY
################################################################################

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      ACME Certificates Manager - Secure Keys Generator    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Generate JWT_SECRET (64 characters base64)
echo -e "${BLUE}Generating JWT_SECRET (64 characters)...${NC}"
JWT_SECRET=$(openssl rand -base64 48)
echo -e "${GREEN}JWT_SECRET=${JWT_SECRET}${NC}"
echo ""

# Generate ENCRYPTION_KEY (32 bytes = 44 characters base64)
echo -e "${BLUE}Generating ENCRYPTION_KEY (32 bytes)...${NC}"
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo -e "${GREEN}ENCRYPTION_KEY=${ENCRYPTION_KEY}${NC}"
echo ""

# Alternative: hex format
echo -e "${BLUE}Alternative formats:${NC}"
echo -e "${YELLOW}JWT_SECRET (hex):${NC} $(openssl rand -hex 32)"
echo -e "${YELLOW}ENCRYPTION_KEY (hex):${NC} $(openssl rand -hex 32)"
echo ""

echo -e "${BLUE}Usage Instructions:${NC}"
echo "1. Copy the generated keys above"
echo "2. Update your .env file with these values:"
echo ""
echo -e "   ${YELLOW}JWT_SECRET=${JWT_SECRET}${NC}"
echo -e "   ${YELLOW}ENCRYPTION_KEY=${ENCRYPTION_KEY}${NC}"
echo ""
echo -e "${YELLOW}⚠  Security Notes:${NC}"
echo "• Never commit these keys to version control"
echo "• Store them securely (password manager, vault)"
echo "• Use different keys for each environment (dev/staging/prod)"
echo "• Rotate keys periodically for maximum security"
echo ""
