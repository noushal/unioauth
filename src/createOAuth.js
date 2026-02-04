import { GitHubProvider } from './providers/github.js';
import { GoogleProvider } from './providers/google.js';
import { DiscordProvider } from './providers/discord.js';

/**
 * Registry of supported providers.
 * Adding a new provider is a one-line change here + a new file in providers/.
 */
const PROVIDERS = {
  github: GitHubProvider,
  google: GoogleProvider,
  discord: DiscordProvider,
};

/**
 * Create an OAuth client that exposes a unified interface for every
 * configured provider.
 *
 * @param {object} config - Keys are provider names, values are provider configs.
 * @returns {object} An object whose keys match the config keys, each with
 *                   getRedirectUrl() and handleCallback() methods.
 *
 * @example
 * const oauth = createOAuth({
 *   github: { clientId: '…', clientSecret: '…', redirectUri: '…' },
 *   google: { clientId: '…', clientSecret: '…', redirectUri: '…' },
 * });
 *
 * oauth.github.getRedirectUrl();
 * await oauth.github.handleCallback(req);
 */
export function createOAuth(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createOAuth() requires a configuration object');
  }

  const oauth = {};

  for (const [name, providerConfig] of Object.entries(config)) {
    const Provider = PROVIDERS[name];
    if (!Provider) {
      const supported = Object.keys(PROVIDERS).join(', ');
      throw new Error(
        `Unknown provider "${name}". Supported providers: ${supported}`
      );
    }
    oauth[name] = new Provider(providerConfig);
  }

  if (Object.keys(oauth).length === 0) {
    throw new Error(
      'At least one provider must be configured (github, google, discord)'
    );
  }

  return oauth;
}
