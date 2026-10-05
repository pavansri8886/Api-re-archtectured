/**
 * http/session.ts
 * What it does: sends each request only once per run and shares the answer between the tests that need it.
 * Why: the contract test (V2) and the compare test (V1 against V2) of the same row both need the V2 answer.
 *      They share one call, so the API is not asked twice and both tests judge the identical response.
 * Key:   project / api / endpoint / row id / version.
 * A failed request is NOT kept: the next test that needs it asks again (nothing is hidden by the cache).
 * Note:  Playwright starts a fresh worker after a failed test, so after a failure the cache starts empty.
 *        That costs one extra call, never a wrong result.
 */
import { APIRequestContext } from '@playwright/test';
import { ApiClient } from './apiClient';
import { newApiContext } from './context';
import { resolveTarget } from '../config/projectConfig';
import { ApiContext, ApiResponse, ApiVersion, EndpointDefinition, TestCase } from '../types';

export class ApiSession {
  private readonly contexts = new Map<string, Promise<APIRequestContext>>();
  private readonly answers = new Map<string, Promise<ApiResponse>>();
  /** How many real requests were sent. Used by the framework self checks. */
  sent = 0;

  async get(ctx: ApiContext, endpointName: string, endpoint: EndpointDefinition, row: TestCase, version: ApiVersion): Promise<ApiResponse> {
    const key = [ctx.project, ctx.api, endpointName, row.id, version].join('/');
    let answer = this.answers.get(key);
    if (!answer) {
      answer = this.send(ctx, endpoint, row, version);
      this.answers.set(key, answer);
      answer.catch(() => this.answers.delete(key));
    }
    return answer;
  }

  private async send(ctx: ApiContext, endpoint: EndpointDefinition, row: TestCase, version: ApiVersion): Promise<ApiResponse> {
    const target = resolveTarget(ctx, version);
    const contextKey = `${ctx.project}/${ctx.api}/${version}`;
    let http = this.contexts.get(contextKey);
    if (!http) {
      http = newApiContext();
      this.contexts.set(contextKey, http);
    }
    this.sent++;
    try {
      return await new ApiClient(await http, target, version).send(endpoint, row);
    } catch (error) {
      throw new Error(`${target.label}: request failed for ${row.id}: ${(error as Error).message}`);
    }
  }

  async dispose(): Promise<void> {
    for (const http of this.contexts.values()) await (await http).dispose();
    this.contexts.clear();
    this.answers.clear();
  }
}
