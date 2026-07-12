import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/db';
import type { CryptoService } from '../crypto/crypto.service';
import { AuthService } from './auth.service';

// A fixed signing key; no ENCRYPTION_KEY / ConfigService needed in tests.
const crypto = { deriveKey: () => Buffer.alloc(32, 7) } as unknown as CryptoService;

const make = () => new AuthService(createTestDb(), crypto);
const CREDS = { username: 'admin', password: 'correct horse battery' };

describe('AuthService', () => {
  it('starts with no admin', () => {
    expect(make().hasAdmin()).toBe(false);
  });

  it('registers the first admin and issues a verifiable token', () => {
    const svc = make();
    const result = svc.register(CREDS);
    expect(result.username).toBe('admin');
    expect(svc.hasAdmin()).toBe(true);
    expect(svc.verify(result.token)).toEqual({ username: 'admin' });
  });

  it('refuses a second registration once claimed', () => {
    const svc = make();
    svc.register(CREDS);
    expect(() => svc.register({ username: 'other', password: 'another one!' })).toThrow(
      /already exists/i,
    );
  });

  it('logs in with the right password and rejects the wrong one', () => {
    const svc = make();
    svc.register(CREDS);
    expect(svc.login(CREDS).username).toBe('admin');
    expect(() => svc.login({ username: 'admin', password: 'nope' })).toThrow(/invalid/i);
    expect(() => svc.login({ username: 'ghost', password: 'whatever' })).toThrow(/invalid/i);
  });

  it('rejects a tampered or garbage token', () => {
    const svc = make();
    const { token } = svc.register(CREDS);
    expect(svc.verify(token + 'x')).toBeNull();
    expect(svc.verify('not.a.token')).toBeNull();
    expect(svc.verify('')).toBeNull();
  });

  it('does not authenticate a token signed with a different key', () => {
    const a = svc(Buffer.alloc(32, 1));
    const { token } = a.register(CREDS);
    const b = svc(Buffer.alloc(32, 2));
    b.register(CREDS); // claim b too, so it's the key, not "no user", that rejects
    expect(b.verify(token)).toBeNull();
  });
});

function svc(key: Buffer): AuthService {
  return new AuthService(createTestDb(), { deriveKey: () => key } as unknown as CryptoService);
}
