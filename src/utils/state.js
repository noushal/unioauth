import crypto from 'node:crypto';
import { OAuthError } from './errors.js';

/**
 * Generate a cryptographically random state string for CSRF protection.
 * Store this value in the user's session before redirecting, then pass it
 * to handleCallback() so the library can verify the round-trip.
 *
 * @param {number} [length=32] - Number of random bytes (hex-encoded, so output is 2× length).
 * @returns {string} Hex-encoded random string.
 */
export function generateState(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Compare expected and received state values using a timing-safe comparison
 * to prevent timing attacks. Throws OAuthError on mismatch.
 *
 * @param {string} expected - The state value stored in the session.
 * @param {string} received - The state value returned by the OAuth provider.
 * @throws {OAuthError} If the values don't match or either is missing.
 */
export function validateState(expected, received) {
  if (!expected || !received) {
    throw new OAuthError(
      'State parameter missing — potential CSRF attack',
      null,
      'STATE_MISSING'
    );
  }

  const expectedBuf = Buffer.from(String(expected));
  const receivedBuf = Buffer.from(String(received));

  if (
    expectedBuf.length !== receivedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    throw new OAuthError(
      'State mismatch — potential CSRF attack',
      null,
      'STATE_MISMATCH'
    );
  }
}
