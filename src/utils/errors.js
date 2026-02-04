/**
 * Custom error class for all OAuth-related failures.
 * Includes the provider name and a machine-readable error code
 * so callers can programmatically handle specific failure modes.
 */
export class OAuthError extends Error {
  /**
   * @param {string} message  - Human-readable description of what went wrong.
   * @param {string|null} provider - Provider that caused the error (e.g. "github").
   * @param {string} code - Machine-readable error code (e.g. "TOKEN_ERROR").
   */
  constructor(message, provider, code) {
    super(message);
    this.name = 'OAuthError';
    this.provider = provider || null;
    this.code = code || 'OAUTH_ERROR';
  }
}
