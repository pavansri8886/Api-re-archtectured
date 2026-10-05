/**
 * http/context.ts
 * What it does: creates a Playwright request context with the shared network settings
 * (proxy, HTTPS checks). Used for API calls and for the Azure AD token call, so both behave the same.
 * Playwright does not read HTTPS_PROXY by itself, so PROXY_URL and NO_PROXY are passed explicitly.
 */
import { APIRequestContext, request } from '@playwright/test';
import { settings } from '../config/env';

export function newApiContext(): Promise<APIRequestContext> {
  const proxyUrl = settings.proxyUrl;
  return request.newContext({
    ignoreHTTPSErrors: settings.ignoreHttpsErrors,
    proxy: proxyUrl ? { server: proxyUrl, bypass: settings.noProxy } : undefined,
  });
}
