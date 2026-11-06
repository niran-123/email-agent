// backend/src/utils/crypto.js
// Authenticated encryption (AES-256-GCM) and cryptographic utilities.

import crypto from 'crypto';
import { env } from '../config/env.js';

// Derive or format a 32-byte encryption key from the environment variable
function getEncryptionKey() {
  const secret = env.ENCRYPTION_KEY || env.JWT_SECRET || 'mailmind_fallback_encryption_key_32b';
  // Use SHA-256 to ensure exactly 32 bytes (256 bits) regardless of input length
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM (Authenticated Encryption).
 * Returns serialized format: `ivHex:authTagHex:encryptedHex`
 *
 * @param {string} text - Plaintext to encrypt
 * @returns {string} - Combined encrypted payload
 */
export function encrypt(text) {
  if (!text) return text;

  const key = getEncryptionKey();
  // Standard 96-bit (12-byte) IV for AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 128-bit (16-byte) authentication tag for integrity verification
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a payload previously encrypted with `encrypt()`.
 * Verifies authenticity before returning plaintext.
 *
 * @param {string} encryptedPayload - `ivHex:authTagHex:encryptedHex`
 * @returns {string} - Decrypted plaintext string
 */
export function decrypt(encryptedPayload) {
  if (!encryptedPayload) return encryptedPayload;

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format: expected iv:tag:data');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a cryptographically secure random token (e.g. for OAuth state).
 * @param {number} [bytes=32]
 * @returns {string}
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

