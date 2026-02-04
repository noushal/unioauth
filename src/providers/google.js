import { OAuthProvider } from './base.js';
import { request } from '../utils/http.js';

/**
 * Google OAuth 2.0 provider.
 *
 * Console: https://console.cloud.google.com/apis/credentials
 * Scopes reference: https://developers.google.com/identity/protocols/oauth2/scopes
 */
export class GoogleProvider extends OAuthProvider {
  get name() {
    return 'google';
  }

  get authorizationUrl() {
    return 'https://accounts.google.com/o/oauth2/v2/auth';
  }

  get tokenUrl() {
    return 'https://oauth2.googleapis.com/token';
  }

  get defaultScopes() {
    return ['openid', 'email', 'profile'];
  }

  async fetchUser(accessToken) {
    const profile = await request(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    return {
      provider: 'google',
      id: String(profile.id),
      email: profile.email || null,
      name: profile.name || null,
      avatar: profile.picture || null,
      raw: profile,
    };
  }
}
