import { describe, it, expect } from 'vitest';
import {
  encryptText,
  decryptText,
  encryptBuffer,
  decryptBuffer,
  hashPassword,
  verifyPassword,
  generateTotpSecret,
  verifyTotpToken,
} from '../src/utils/crypto.js';

describe('Security & Cryptography Utilities', () => {
  it('should encrypt and decrypt sensitive strings with AES-256-GCM', () => {
    const sensitiveTaxId = 'TAX-98765-4321-XYZ';
    const encrypted = encryptText(sensitiveTaxId);

    expect(encrypted).not.toBe(sensitiveTaxId);
    expect(encrypted).toContain(':'); // iv:authTag:ciphertext format

    const decrypted = decryptText(encrypted);
    expect(decrypted).toBe(sensitiveTaxId);
  });

  it('should encrypt and decrypt binary file buffers with AES-256-GCM', () => {
    const sampleBuffer = Buffer.from('Confidential receipt and invoice document contents 123456');
    const { encrypted, iv, authTag } = encryptBuffer(sampleBuffer);

    expect(encrypted).not.toEqual(sampleBuffer);

    const decrypted = decryptBuffer(encrypted, iv, authTag);
    expect(decrypted.toString('utf-8')).toBe(sampleBuffer.toString('utf-8'));
  });

  it('should hash and securely verify passwords with bcrypt', async () => {
    const password = 'CorrectHorseBatteryStaple99!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);

    const isWrong = await verifyPassword('WrongPassword', hash);
    expect(isWrong).toBe(false);
  });

  it('should generate valid 2FA TOTP secret and verify authenticator codes', () => {
    const { secret, otpauthUrl } = generateTotpSecret('testuser@vault.dev');
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(otpauthUrl).toContain('testuser%40vault.dev');
  });
});
