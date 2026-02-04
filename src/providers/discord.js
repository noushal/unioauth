import { OAuthProvider } from './base.js';
import { request } from '../utils/http.js';

/**
 * Discord OAuth 2.0 provider.
 *
 * Dev portal: https://discord.com/developers/applications
 * API docs:   https://discord.com/developers/docs/topics/oauth2
 *
 * Avatar URL format: https://cdn.discordapp.com/avatars/{user_id}/{hash}.png
 * Animated avatars (hash starts with "a_") use .gif instead.
 */
export class DiscordProvider extends OAuthProvider {
  get name() {
    return 'discord';
  }

  get authorizationUrl() {
    return 'https://discord.com/api/oauth2/authorize';
  }

  get tokenUrl() {
    return 'https://discord.com/api/oauth2/token';
  }

  get defaultScopes() {
    return ['identify', 'email'];
  }

  async fetchUser(accessToken) {
    const profile = await request('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Build the CDN avatar URL; animated avatars use .gif.
    let avatar = null;
    if (profile.avatar) {
      const ext = profile.avatar.startsWith('a_') ? 'gif' : 'png';
      avatar = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${ext}`;
    }

    return {
      provider: 'discord',
      id: String(profile.id),
      email: profile.email || null,
      name: profile.global_name || profile.username,
      avatar,
      raw: profile,
    };
  }
}
