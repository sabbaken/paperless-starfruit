import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Salted scrypt password hashing, with no external dependency. scrypt is memory-hard
 * (deliberately slow) so a leaked hash resists brute force. The cost parameters
 * are stored in the encoded string, so they can be raised later without breaking
 * existing hashes.
 *
 * Encoded form: `scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>`.
 */
const N = 16_384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
