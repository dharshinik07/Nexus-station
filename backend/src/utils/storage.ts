import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ENV } from '../config/env.js';
import { encryptBuffer, decryptBuffer } from './crypto.js';

// Ensure storage directory exists
if (!fs.existsSync(ENV.STORAGE_DIR)) {
  fs.mkdirSync(ENV.STORAGE_DIR, { recursive: true });
}

export interface StoredEncryptedFile {
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Save and encrypt a file buffer to disk at rest using AES-256-GCM.
 * Stored file structure: [12 bytes IV][16 bytes AuthTag][Encrypted bytes]
 */
export async function saveEncryptedFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<StoredEncryptedFile> {
  const extension = path.extname(originalFilename);
  const randomPrefix = crypto.randomBytes(16).toString('hex');
  const storedFilename = `${Date.now()}_${randomPrefix}${extension}.enc`;
  const fullPath = path.join(ENV.STORAGE_DIR, storedFilename);

  const { encrypted, iv, authTag } = encryptBuffer(buffer);
  
  // Pack IV (12) + Tag (16) + Ciphertext
  const payload = Buffer.concat([iv, authTag, encrypted]);
  await fs.promises.writeFile(fullPath, payload);

  return {
    storedFilename,
    originalFilename,
    mimeType,
    fileSize: buffer.length,
  };
}

/**
 * Read and decrypt an AES-256-GCM encrypted file from disk
 */
export async function getDecryptedFile(storedFilename: string): Promise<Buffer> {
  const fullPath = path.join(ENV.STORAGE_DIR, storedFilename);
  if (!fs.existsSync(fullPath)) {
    throw new Error('File not found in storage');
  }

  const packed = await fs.promises.readFile(fullPath);
  if (packed.length < 28) {
    throw new Error('Corrupted or invalid encrypted file header');
  }

  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const encrypted = packed.subarray(28);

  return decryptBuffer(encrypted, iv, authTag);
}

/**
 * Safely delete an encrypted file from disk
 */
export async function deleteEncryptedFile(storedFilename: string): Promise<void> {
  const fullPath = path.join(ENV.STORAGE_DIR, storedFilename);
  if (fs.existsSync(fullPath)) {
    await fs.promises.unlink(fullPath);
  }
}
