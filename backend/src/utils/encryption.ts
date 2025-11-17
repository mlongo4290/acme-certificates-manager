import * as crypto from 'crypto';

// Get encryption key from environment variable (must be 32 bytes hex = 64 chars)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-insecure-key-change-in-production-32bytes!!!';

// Ensure key is 32 bytes
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32), 'utf-8');

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return: iv:authTag:encrypted (all hex encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data encrypted with AES-256-GCM
 */
export function decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUFFER, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
