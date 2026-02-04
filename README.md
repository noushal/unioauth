# unioauth

Simple, unified OAuth login for **GitHub**, **Google**, and **Discord**.
No passport.js. No framework lock-in. Just OAuth done right.

- Zero dependencies — uses the built-in `fetch` API (Node.js 18+)
- Framework agnostic — works with Express, Fastify, Next.js, Hono, and raw `http`
- Normalized user object — same shape regardless of provider
- Built-in CSRF state validation
- Descriptive errors you can catch and handle

## Install

```bash
npm install unioauth
```

## Quick Start

```js
import express from "express";
import { createOAuth } from "unioauth";

const app = express();

const oauth = createOAuth({
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/auth/github/callback",
  },
});

// Redirect the user to GitHub's consent screen
app.get("/auth/github", (req, res) => {
  res.redirect(oauth.github.getRedirectUrl());
});

// GitHub redirects back here with a code
app.get("/auth/github/callback", async (req, res) => {
  try {
    const user = await oauth.github.handleCallback(req);
    // user => { provider, id, email, name, avatar, accessToken, raw }
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.listen(3000);
```

## Multiple Providers

```js
const oauth = createOAuth({
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/auth/github/callback",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/auth/google/callback",
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/auth/discord/callback",
  },
});

// Every provider exposes the exact same interface:
// oauth.github.getRedirectUrl()   oauth.github.handleCallback(req)
// oauth.google.getRedirectUrl()   oauth.google.handleCallback(req)
// oauth.discord.getRedirectUrl()  oauth.discord.handleCallback(req)
```

## Normalized User Object

Every provider returns the same shape:

```js
{
  provider: "github",       // "github" | "google" | "discord"
  id: "12345",              // Provider user ID (always a string)
  email: "user@email.com",  // May be null if not granted
  name: "Jane Doe",         // Display name
  avatar: "https://...",    // Profile picture URL (or null)
  accessToken: "gho_...",   // Use for further API calls
  raw: { /* ... */ }        // Full provider response
}
```

## CSRF State Validation

For production use, always validate the OAuth `state` parameter to prevent
cross-site request forgery:

```js
import { createOAuth, generateState } from "unioauth";

app.get("/auth/github", (req, res) => {
  const state = generateState();
  req.session.oauthState = state; // store in session/cookie

  res.redirect(oauth.github.getRedirectUrl({ state }));
});

app.get("/auth/github/callback", async (req, res) => {
  try {
    const user = await oauth.github.handleCallback(req, {
      state: req.session.oauthState, // compare against stored value
    });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});
```

## Custom Scopes

Each provider ships with sensible defaults. Override them globally or
per-request:

```js
// Global override (applies to every redirect)
const oauth = createOAuth({
  github: {
    clientId: "...",
    clientSecret: "...",
    redirectUri: "...",
    scopes: ["read:user"], // no email access
  },
});

// Per-request override
oauth.github.getRedirectUrl({ scopes: ["read:user", "repo"] });
```

**Default scopes:**

| Provider | Scopes |
|----------|--------|
| GitHub   | `read:user`, `user:email` |
| Google   | `openid`, `email`, `profile` |
| Discord  | `identify`, `email` |

## Framework Examples

### Express

```js
app.get("/auth/github", (req, res) => {
  res.redirect(oauth.github.getRedirectUrl());
});

app.get("/auth/github/callback", async (req, res) => {
  const user = await oauth.github.handleCallback(req);
  res.json(user);
});
```

### Fastify

```js
fastify.get("/auth/github", (req, reply) => {
  reply.redirect(oauth.github.getRedirectUrl());
});

fastify.get("/auth/github/callback", async (req, reply) => {
  const user = await oauth.github.handleCallback(req);
  reply.send(user);
});
```

### Next.js (Pages Router — API Routes)

```js
// pages/api/auth/github.js
export default function handler(req, res) {
  res.redirect(oauth.github.getRedirectUrl());
}

// pages/api/auth/github/callback.js
export default async function handler(req, res) {
  const user = await oauth.github.handleCallback(req);
  res.json(user);
}
```

### Next.js (App Router — Route Handlers)

```js
// app/auth/github/route.js
import { redirect } from "next/navigation";

export function GET() {
  redirect(oauth.github.getRedirectUrl());
}

// app/auth/github/callback/route.js
export async function GET(req) {
  const user = await oauth.github.handleCallback(req);
  return Response.json(user);
}
```

### Hono

```js
app.get("/auth/github", (c) => {
  return c.redirect(oauth.github.getRedirectUrl());
});

app.get("/auth/github/callback", async (c) => {
  const user = await oauth.github.handleCallback(c.req.raw);
  return c.json(user);
});
```

## Error Handling

All errors are instances of `OAuthError` with `provider` and `code` fields:

```js
import { OAuthError } from "unioauth";

try {
  const user = await oauth.github.handleCallback(req);
} catch (err) {
  if (err instanceof OAuthError) {
    console.error(err.provider); // "github"
    console.error(err.code);     // "TOKEN_ERROR", "MISSING_CODE", etc.
    console.error(err.message);  // Human-readable description
  }
}
```

**Error codes:**

| Code | Meaning |
|------|---------|
| `CONFIG_ERROR` | Missing clientId, clientSecret, or redirectUri |
| `MISSING_CODE` | Callback URL has no authorization code |
| `TOKEN_ERROR` | Token exchange with the provider failed |
| `HTTP_ERROR` | An API request returned a non-2xx status |
| `NETWORK_ERROR` | A fetch call failed (DNS, timeout, etc.) |
| `STATE_MISSING` | State validation requested but value is missing |
| `STATE_MISMATCH` | State doesn't match — possible CSRF attack |
| `access_denied` | User denied the OAuth consent prompt |

## Getting Provider Credentials

### GitHub

1. Go to **Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set the callback URL to your `/auth/github/callback` route
3. Copy the **Client ID** and generate a **Client Secret**

### Google

1. Go to **Google Cloud Console → APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add your callback URL under **Authorized redirect URIs**
4. Copy the **Client ID** and **Client Secret**

### Discord

1. Go to **Discord Developer Portal → Applications → New Application**
2. Under **OAuth2**, add your callback URL as a **Redirect**
3. Copy the **Client ID** and **Client Secret**

## License

MIT
