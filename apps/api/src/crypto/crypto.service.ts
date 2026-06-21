import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/**
 * AES-256-GCM encryption for credentials at rest (the paperless token, provider
 * API keys). The key comes from `ENCRYPTION_KEY` (32 bytes, hex or base64).
 *
 * The key is parsed and validated lazily on first use, not at construction, so
 * the process still boots for health checks when no key is configured — only
 * credential operations fail, and they fail loudly with actionable guidance.
 *
 * Ciphertext layout: base64( iv[12] | authTag[16] | ciphertext ).
 */
@Injectable()
export class CryptoService {
  private cachedKey?: Buffer;

  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < IV_BYTES + TAG_BYTES) {
      throw new Error('CryptoService: stored ciphertext is malformed');
    }
    const iv = buf.subarray(0, IV_BYTES);
    const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, this.key(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /**
   * Derive a separate-purpose 32-byte key from the master key via HKDF, so
   * other subsystems (e.g. session-token signing) don't reuse the encryption
   * key directly. Deterministic — survives restarts; rotating `ENCRYPTION_KEY`
   * rotates derived keys too (invalidating old sessions, which is acceptable).
   */
  deriveKey(purpose: string, length = 32): Buffer {
    const salt = Buffer.from('paperless-starfruit');
    return Buffer.from(hkdfSync('sha256', this.key(), salt, Buffer.from(purpose), length));
  }

  private key(): Buffer {
    if (!this.cachedKey) {
      this.cachedKey = parseKey(this.config.get<string>('ENCRYPTION_KEY'));
    }
    return this.cachedKey;
  }
}

function parseKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        'Provide 32 bytes as hex (64 chars) or base64.',
    );
  }
  return key;
}
