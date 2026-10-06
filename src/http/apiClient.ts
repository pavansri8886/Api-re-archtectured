/**
 * http/apiClient.ts
 * What it does: sends ONE request for one API version. It knows nothing about specific APIs.
 * Input:  an endpoint definition and a test row. Output: ApiResponse (status, headers, parsed body, duration).
 * A 4xx or 5xx is returned as a result (not thrown), so the test can state what it expected.
 */
import { APIRequestContext } from '@playwright/test';
import { settings } from '../config/env';
import { ResolvedTarget } from '../config/projectConfig';
import { authHeaders } from './auth';
import { ApiResponse, ApiVersion, EndpointDefinition, TestCase } from '../types';

/**
 * One client per project, API and version. It knows nothing about specific APIs:
 * it receives an endpoint definition and a test case, and sends the request.
 */
export class ApiClient {
  constructor(
    private readonly ctx: APIRequestContext,
    private readonly target: ResolvedTarget,
    readonly version: ApiVersion,
  ) {}

  async send(endpoint: EndpointDefinition, testCase: TestCase): Promise<ApiResponse> {
      const template = typeof endpoint.path === 'string' ? endpoint.path : endpoint.path[this.version];
    if (!template) throw new Error(`This endpoint has no ${this.version} path`);

    const url = joinUrl(this.target.baseUrl, fillPath(template, testCase.pathParams));
    const headers = {
      Accept: 'application/json',
      ...endpoint.headers,
      ...(await authHeaders(this.target.auth, this.target.label)),
      ...testCase.headers,
    };

    const started = Date.now();
    const res = await this.ctx.fetch(url, {
      method: endpoint.method,
      params: testCase.query,
      data: testCase.body,
      headers,
      failOnStatusCode: false, // a 4xx or 5xx is a result to compare, not an exception
      timeout: settings.requestTimeoutMs,
    });
    const durationMs = Date.now() - started;

    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // not JSON: keep the raw text so it can still be compared
    }
    return { version: this.version, url: res.url(), status: res.status(), headers: res.headers(), body, durationMs };
  }
}

/** Joins base URL and path ourselves: Playwright's baseURL drops any base path when the path starts with "/". */
function joinUrl(baseUrl: string, pathPart: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${pathPart.replace(/^\/+/, '')}`;
}

function fillPath(template: string, params: TestCase['pathParams'] = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in params)) throw new Error(`Test case has no pathParams.${key} (needed by ${template})`);
    return encodeURIComponent(String(params[key]));
  });
}
