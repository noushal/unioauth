import { OAuthProvider } from './base.js';
import { request } from '../utils/http.js';

/**
 * GitHub OAuth 2.0 provider.
 *
 * Scopes reference: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
 *
 * GitHub may omit the email from /user if the user's email is private,
 * so we also call /user/emails to find the verified primary address.
 */
export class GitHubProvider extends OAuthProvider {
  get name() {
    return 'github';
  }

  get authorizationUrl() {
    return 'https://github.com/login/oauth/authorize';
  }

  get tokenUrl() {
    return 'https://github.com/login/oauth/access_token';
  }

  get defaultScopes() {
    return ['read:user', 'user:email'];
  }

  async fetchUser(accessToken) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    };

    const profile = await request('https://api.github.com/user', { headers });

    // Resolve the email: prefer the profile value, fall back to /user/emails.
    let email = profile.email;
    if (!email) {
      try {
        const emails = await request('https://api.github.com/user/emails', {
          headers,
        });
        const primary = emails.find((e) => e.primary && e.verified);
        email =
          primary?.email || emails.find((e) => e.verified)?.email || null;
      } catch {
        // The scope may not grant access to emails — degrade gracefully.
        email = null;
      }
    }

    return {
      provider: 'github',
      id: String(profile.id),
      email,
      name: profile.name || profile.login,
      avatar: profile.avatar_url || null,
      raw: profile,
    };
  }
}
