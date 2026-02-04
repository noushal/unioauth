import { OAuthError } from './errors.js';

/**
 * Minimal fetch wrapper used by every provider for token exchange and
 * profile requests. Handles JSON / form-encoded responses and surfaces
 * provider error messages as OAuthError instances.
 *
 * @param {string} url - The URL to request.
 * @param {RequestInit} [options] - Standard fetch options (method, headers, body, …).
 * @returns {Promise<object>} Parsed response body.
 * @throws {OAuthError} On network failures or non-2xx responses.
 */
export async function request(url, options = {}) {
  // Merge a default User-Agent so GitHub API calls never fail due to
  // a missing UA header (GitHub requires one for all API requests).
  const headers = {
    'User-Agent': 'unioauth',
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new OAuthError(
      `Network request to ${url} failed: ${err.message}`,
      null,
      'NETWORK_ERROR'
    );
  }

  // Parse the body — providers return either JSON or form-encoded data.
  const contentType = response.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      // Fall back to URL-encoded parsing (e.g. GitHub token endpoint
      // without an Accept: application/json header).
      data = Object.fromEntries(new URLSearchParams(text));
    }
  }

  if (!response.ok) {
    const message =
      data.error_description || data.message || data.error || `HTTP ${response.status}`;
    throw new OAuthError(message, null, 'HTTP_ERROR');
  }

  return data;
}
