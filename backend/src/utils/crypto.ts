import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { ENV } from '../config/env.js';

// Resolve 32-byte encryption key from hex or raw string
function getMasterKey(): Buffer {
  const hex = ENV.ENCRYPTION_MASTER_KEY;
  if (hex.length === 64) {
    return Buffer.from(hex, 'hex');
  }
  return crypto.createHash('sha256').update(hex).digest();
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM

/**
 * Encrypt a plain text string using AES-256-GCM
 * Returns string in format: iv:authTag:ciphertext (hex encoded)
 */
export function encryptText(plainText: string): string {
  if (!plainText) return '';
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decryptText(payload: string): string {
  if (!payload || !payload.includes(':')) return payload;
  try {
    const parts = payload.split(':');
    if (parts.length !== 3) return payload;
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed, returning empty string or original', err);
    return '';
  }
}

/**
 * Encrypt a buffer (for files/receipts) with AES-256-GCM
 */
export function encryptBuffer(buffer: Buffer): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return { encrypted, iv, authTag };
}

/**
 * Decrypt a buffer with AES-256-GCM
 */
export function decryptBuffer(encryptedBuffer: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password with bcrypt
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate cryptographically secure random token (hex)
 */
export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * 2FA (TOTP) utilities
 */
export function generateTotpSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, 'NexusStation', secret);
  return { secret, otpauthUrl };
}

export function verifyTotpToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
