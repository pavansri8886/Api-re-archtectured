/**
 * http/auth.ts
 * What it does: builds the auth headers for one request (none, bearer token, API key header, Azure AD token).
 * The apiKey type is what Azure APIM needs: header Ocp-Apim-Subscription-Key with the key from an env variable.
 */
import { newApiContext } from './context';
import { readEnv } from '../config/env';
import { AuthConfig } from '../types';

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Returns the auth headers for one request. Called per request (not once per client) so that
 * long runs never use an expired token; the cache makes this cheap.
 */
export async function authHeaders(auth: AuthConfig, label: string): Promise<Record<string, string>> {
  switch (auth.type) {
    case 'none':
      return {};
    case 'bearer':
      return { Authorization: `Bearer ${readEnv(auth.tokenEnv, `${label} token`)}` };
    case 'apiKey':
      return { [auth.header]: readEnv(auth.keyEnv, `${label} API key`) };
    case 'azureAd':
      return { Authorization: `Bearer ${await azureAdToken(auth, label)}` };
  }
}

/** Client credentials flow against Microsoft Entra ID (Azure AD). One token per scope, renewed before expiry. */
async function azureAdToken(auth: Extract<AuthConfig, { type: 'azureAd' }>, label: string): Promise<string> {
  const tenantId = readEnv(auth.tenantIdEnv ?? 'AZURE_TENANT_ID', `${label} Azure AD`);
  const clientId = readEnv(auth.clientIdEnv ?? 'AZURE_CLIENT_ID', `${label} Azure AD`);
  const clientSecret = readEnv(auth.clientSecretEnv ?? 'AZURE_CLIENT_SECRET', `${label} Azure AD`);
  const scope = readEnv(auth.scopeEnv, `${label} Azure AD scope`);

  const key = `${tenantId}|${clientId}|${scope}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const ctx = await newApiContext();
  try {
    const res = await ctx.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      form: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope },
    });
    if (!res.ok()) throw new Error(`Azure AD token request for ${label} failed: ${res.status()} ${await res.text()}`);
    const body = await res.json();
    tokenCache.set(key, { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 });
    return body.access_token;
  } finally {
    await ctx.dispose();
  }
}
