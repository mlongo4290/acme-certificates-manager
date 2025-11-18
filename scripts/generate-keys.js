const crypto = require('crypto');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║      ACME Certificates Manager - Secure Keys Generator    ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Generate JWT_SECRET (64 characters base64)
console.log('Generating JWT_SECRET (64 characters)...');
const JWT_SECRET = crypto.randomBytes(48).toString('base64');
console.log('\x1b[32mJWT_SECRET=' + JWT_SECRET + '\x1b[0m\n');

// Generate ENCRYPTION_KEY (32 bytes)
console.log('Generating ENCRYPTION_KEY (32 bytes)...');
const ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
console.log('\x1b[32mENCRYPTION_KEY=' + ENCRYPTION_KEY + '\x1b[0m\n');

// Alternative formats
console.log('Alternative formats:');
console.log('\x1b[33mJWT_SECRET (hex):\x1b[0m', crypto.randomBytes(32).toString('hex'));
console.log('\x1b[33mENCRYPTION_KEY (hex):\x1b[0m', crypto.randomBytes(32).toString('hex'));
console.log('');

console.log('Usage Instructions:');
console.log('1. Copy the generated keys above');
console.log('2. Update your .env file with these values:\n');
console.log('   \x1b[33mJWT_SECRET=' + JWT_SECRET + '\x1b[0m');
console.log('   \x1b[33mENCRYPTION_KEY=' + ENCRYPTION_KEY + '\x1b[0m\n');

console.log('\x1b[33m⚠  Security Notes:\x1b[0m');
console.log('• Never commit these keys to version control');
console.log('• Store them securely (password manager, vault)');
console.log('• Use different keys for each environment (dev/staging/prod)');
console.log('• Rotate keys periodically for maximum security\n');
