import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { CryptoService } from './crypto.service';

const base64Key = Buffer.alloc(32, 1).toString('base64');
const hexKey = Buffer.alloc(32, 2).toString('hex');

function service(key?: string): CryptoService {
  return new CryptoService({ get: () => key } as unknown as ConfigService);
}

describe('CryptoService', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const svc = service(base64Key);
    const secret = 'paperless-token-abc123';
    expect(svc.decrypt(svc.encrypt(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const svc = service(base64Key);
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
  });

  it('accepts a hex-encoded key', () => {
    const svc = service(hexKey);
    expect(svc.decrypt(svc.encrypt('hello'))).toBe('hello');
  });

  it('rejects a tampered ciphertext (GCM auth tag)', () => {
    const svc = service(base64Key);
    const buf = Buffer.from(svc.encrypt('hello'), 'base64');
    buf[buf.length - 1] ^= 0xff;
    expect(() => svc.decrypt(buf.toString('base64'))).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const ciphertext = service(base64Key).encrypt('hello');
    expect(() => service(hexKey).decrypt(ciphertext)).toThrow();
  });

  it('throws a helpful error when no key is configured', () => {
    expect(() => service(undefined).encrypt('x')).toThrow(/ENCRYPTION_KEY is not set/);
  });

  it('throws when the key is the wrong length', () => {
    expect(() => service('too-short').encrypt('x')).toThrow(/must decode to 32 bytes/);
  });
});
