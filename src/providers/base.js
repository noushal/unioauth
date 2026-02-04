import { OAuthError } from '../utils/errors.js';
import { validateState } from '../utils/state.js';
import { request } from '../utils/http.js';

/**
 * Base class that every OAuth provider extends.
 *
 * It owns the entire authorization-code flow:
 *   1. Build the redirect URL  →  getRedirectUrl()
 *   2. Extract params from the callback request
 *   3. Exchange the code for an access token
 *   4. Delegate to the subclass to fetch + normalize user data
 *
 * Subclasses only need to define a handful of getters and one method:
 *   - name, authorizationUrl, tokenUrl, defaultScopes
 *   - fetchUser(accessToken) → normalized user object
 */
export class OAuthProvider {
  /**
   * @param {object} config
   * @param {string} config.clientId     - OAuth application client ID.
   * @param {string} config.clientSecret - OAuth application client secret.
   * @param {string} config.redirectUri  - Registered callback URL.
   * @param {string[]} [config.scopes]   - Override the provider's default scopes.
   */
  constructor(config) {
    if (!config.clientId) {
      throw new OAuthError('clientId is required', this.name, 'CONFIG_ERROR');
    }
    if (!config.clientSecret) {
      throw new OAuthError('clientSecret is required', this.name, 'CONFIG_ERROR');
    }
    if (!config.redirectUri) {
      throw new OAuthError('redirectUri is required', this.name, 'CONFIG_ERROR');
    }

    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.scopes = config.scopes || this.defaultScopes;
  }

  // ── Subclass contract ──────────────────────────────────────────────

  /** @returns {string} Provider identifier (e.g. "github"). */
  get name() {
    throw new Error('Provider must define get name()');
  }

  /** @returns {string} Full URL of the provider's authorization endpoint. */
  get authorizationUrl() {
    throw new Error('Provider must define get authorizationUrl()');
  }

  /** @returns {string} Full URL of the provider's token endpoint. */
  get tokenUrl() {
    throw new Error('Provider must define get tokenUrl()');
  }

  /** @returns {string[]} Default OAuth scopes for this provider. */
  get defaultScopes() {
    return [];
  }

  /**
   * Fetch the authenticated user's profile and return a normalized object.
   * Every subclass MUST implement this.
   *
   * @param {string} _accessToken
   * @returns {Promise<object>} Normalized user object (without accessToken — added by handleCallback).
   */
  async fetchUser(_accessToken) {
    throw new Error('Provider must implement fetchUser()');
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Build the URL the user's browser should be redirected to.
   *
   * @param {object} [options]
   * @param {string[]} [options.scopes] - Override scopes for this request only.
   * @param {string}   [options.state]  - CSRF state value (use generateState()).
   * @returns {string} The full authorization URL.
   */
  getRedirectUrl(options = {}) {
    const scopes = options.scopes || this.scopes;

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
    });

    if (options.state) {
      params.set('state', options.state);
    }

    // Let subclasses append provider-specific params (e.g. access_type).
    this.addAuthParams(params, options);

    return `${this.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback: validate the response, exchange the
   * authorization code for a token, fetch the user profile, and return
   * a normalized user object.
   *
   * @param {object} req - The incoming HTTP request (Express, Fastify, Next.js, raw Node http).
   * @param {object} [options]
   * @param {string} [options.state] - Expected state value for CSRF validation.
   * @returns {Promise<object>} Normalized user object.
   */
  async handleCallback(req, options = {}) {
    const params = this._extractParams(req);

    // The provider redirected back with an error (e.g. user denied access).
    if (params.error) {
      throw new OAuthError(
        params.errorDescription || `Authorization denied: ${params.error}`,
        this.name,
        params.error
      );
    }

    if (!params.code) {
      throw new OAuthError(
        'No authorization code received in callback',
        this.name,
        'MISSING_CODE'
      );
    }

    // Validate CSRF state when the caller provided an expected value.
    if (options.state) {
      validateState(options.state, params.state);
    }

    const tokenData = await this._exchangeCode(params.code);
    const user = await this.fetchUser(tokenData.access_token);

    // Attach the access token so callers can make further API requests.
    user.accessToken = tokenData.access_token;

    return user;
  }

  // ── Hooks for subclasses ───────────────────────────────────────────

  /**
   * Override to append provider-specific query parameters to the
   * authorization URL (e.g. Google's access_type).
   *
   * @param {URLSearchParams} _params
   * @param {object} _options
   */
  addAuthParams(_params, _options) {
    // No-op by default.
  }

  // ── Internal helpers ───────────────────────────────────────────────

  /**
   * Extract query parameters from the callback request in a
   * framework-agnostic way.
   *
   * Supports: Express, Fastify, Next.js (Pages & App Router),
   * Hono (via c.req.raw), and raw Node.js http.IncomingMessage.
   */
  _extractParams(req) {
    // Express / Fastify / Next.js Pages Router expose req.query as an object.
    if (req.query && typeof req.query === 'object') {
      return {
        code: req.query.code || null,
        state: req.query.state || null,
        error: req.query.error || null,
        errorDescription: req.query.error_description || null,
      };
    }

    // Next.js App Router (NextRequest) exposes nextUrl.searchParams.
    if (req.nextUrl) {
      const sp = req.nextUrl.searchParams;
      return {
        code: sp.get('code'),
        state: sp.get('state'),
        error: sp.get('error'),
        errorDescription: sp.get('error_description'),
      };
    }

    // Raw Node.js http.IncomingMessage or Web API Request — parse the URL.
    if (req.url) {
      const host =
        (typeof req.headers?.get === 'function'
          ? req.headers.get('host')
          : req.headers?.host) || 'localhost';

      const url = new URL(req.url, `http://${host}`);
      return {
        code: url.searchParams.get('code'),
        state: url.searchParams.get('state'),
        error: url.searchParams.get('error'),
        errorDescription: url.searchParams.get('error_description'),
      };
    }

    throw new OAuthError(
      'Unable to extract query parameters from the request object. ' +
        'Pass a standard Node.js/Web request, or an Express/Fastify/Next.js request.',
      this.name,
      'INVALID_REQUEST'
    );
  }

  /**
   * Exchange an authorization code for an access token.
   *
   * Uses application/x-www-form-urlencoded (required by all three
   * providers) and requests a JSON response.
   */
  async _exchangeCode(code) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const data = await request(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    // Some providers return 200 with an error body instead of a 4xx.
    if (data.error) {
      throw new OAuthError(
        data.error_description || `Token exchange failed: ${data.error}`,
        this.name,
        'TOKEN_ERROR'
      );
    }

    if (!data.access_token) {
      throw new OAuthError(
        'No access token received from provider',
        this.name,
        'TOKEN_ERROR'
      );
    }

    return data;
  }
}
