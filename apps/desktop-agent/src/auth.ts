import { createHmac, randomBytes } from 'crypto';

const TOKEN_LENGTH_BYTES = 16; // 128 bit

/**
 * Generate a cryptographically secure random token.
 * Returns a Base62-encoded string (URL-safe, no padding chars).
 */
export function generateToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH_BYTES);
  return toBase62(bytes);
}

/**
 * Generate a random challenge for the auth handshake.
 * Returns a hex-encoded 32-byte string.
 */
export function generateChallenge(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Compute the expected HMAC-SHA256 response for a given token + challenge.
 * The token itself never travels over the wire — only this HMAC is compared.
 */
export function computeHmac(token: string, challenge: string): string {
  return createHmac('sha256', token).update(challenge).digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  // Use crypto.timingSafeEqual on Buffer representations
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  // Node's timingSafeEqual requires same-length buffers
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i]! ^ bufB[i]!;
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Internal: Base62 encoding (A-Z a-z 0-9)
// ---------------------------------------------------------------------------

const BASE62_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function toBase62(buf: Buffer): string {
  let n = BigInt('0x' + buf.toString('hex'));
  if (n === 0n) return BASE62_CHARS[0]!;
  let result = '';
  const base = BigInt(62);
  while (n > 0n) {
    result = BASE62_CHARS[Number(n % base)]! + result;
    n = n / base;
  }
  return result;
}
