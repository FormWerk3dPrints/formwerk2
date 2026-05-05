import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

export type EncryptedBlob = {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
};

function getEncryptionSecret(): string {
  const secret = process.env.USER_PROFILE_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('Defina USER_PROFILE_ENCRYPTION_SECRET para criptografar dados pessoais.');
  }
  return secret;
}

function getHashSecret(): string {
  return process.env.USER_PROFILE_HASH_SECRET || getEncryptionSecret();
}

function buildAesKey(): Buffer {
  const secret = getEncryptionSecret();
  return createHash('sha256').update(secret).digest();
}

export function encryptProfilePayload(payload: Record<string, unknown>): EncryptedBlob {
  const iv = randomBytes(12);
  const key = buildAesKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptProfilePayload<T>(encryptedBlob: EncryptedBlob): T {
  const key = buildAesKey();
  const iv = Buffer.from(encryptedBlob.iv, 'base64');
  const tag = Buffer.from(encryptedBlob.tag, 'base64');
  const ciphertext = Buffer.from(encryptedBlob.ciphertext, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function normalizeForHash(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function hashForSearch(value: string): string {
  const normalized = normalizeForHash(value);
  const secret = getHashSecret();
  return createHmac('sha256', secret).update(normalized).digest('hex');
}
