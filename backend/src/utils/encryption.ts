import * as crypto from 'crypto';

export const PBKDF2_ITERATIONS = 100000;

/**
 * Encrypt data with a user-provided password using AES-256-GCM + PBKDF2.
 * Output format: base64(salt[16] + iv[12] + authTag[16] + ciphertext)
 */
export function passwordEncrypt(data: string, password: string): string {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt data that was encrypted with passwordEncrypt.
 */
export function passwordDecrypt(encData: string, password: string): string {
    const buf = Buffer.from(encData, 'base64');
    const salt = buf.subarray(0, 16);
    const iv = buf.subarray(16, 28);
    const authTag = buf.subarray(28, 44);
    const ciphertext = buf.subarray(44);
    const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
}

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
