/**
 * steps.ts
 * What it does: the checks that every API spec file runs, written once.
 *   planApi          loads and checks the project config and test data. On a problem it registers ONE failing test
 *                    for this API and returns nothing, so other APIs still run.
 *   runContractTest  one V2 (or V1) response: status, schema, expected values.
 *   runCompareTest   V1 and V2 response for the same row: both statuses, then every difference.
 *
 * How failures work: the status check stops the test (nothing else makes sense without it).
 * Schema, expected values and differences are "soft": all of them are reported, then the test fails.
 *
 * LOCAL ONLY schema extraction: set PRINT_V1_JSON=true to print V1 response bodies.
 * Responses may contain personal data. Leave the option unset except when extracting schemas.
 */
import { test, expect } from './fixtures';
import { ApiSession } from './http/session';
import { projectSettings } from './config/projectConfig';
import { rulesFor } from './config/projectConfig';
import { loadTestCases } from './data/loadTestCases';
import { loadEndpointSchema } from './data/schemaFiles';
import { validateSchema } from './checks/schema';
import { checkFields } from './checks/fields';
import { normalize } from './compare/normalize';
import { diff, formatDifferences } from './compare/diff';
import { ApiContext, ApiResponse, ApiVersion, EndpointDefinition, TestCase } from './types';

export interface ApiPlan {
  rows: TestCase[];
  contractVersions: ApiVersion[];
  compare: boolean;
}

export function planApi(ctx: ApiContext, endpoints: Record<string, EndpointDefinition>): ApiPlan | undefined {
  try {
    const settings = projectSettings(ctx.project);
    const rows = loadTestCases(ctx, Object.keys(endpoints));
    return { rows, contractVersions: settings.contractVersions, compare: settings.compare };
  } catch (error) {
    const message = (error as Error).message;
    test(`${ctx.project}/${ctx.api}: setup problem`, () => {
      throw new Error(message);
    });
    return undefined;
  }
}

/** Test title. It contains the endpoint name, so -g "endpointName" selects both test kinds. */
export function titleOf(kind: string, row: TestCase): string {
  return `${row.endpoint} ${row.id} [${kind}] ${row.description}`;
}

/** Row tags become Playwright tags (@smoke). Run them with --grep @smoke. */
export function tagsOf(row: TestCase): string[] {
  return (row.tags ?? []).map((t) => (t.startsWith('@') ? t : `@${t}`));
}

function showResponse(response: ApiResponse): void {
  // TEMPORARY V1 SCHEMA EXTRACTION: remove this block after extracting the schemas.
  if (response.version === 'v1' && process.env.PRINT_V1_JSON === 'true') {
    process.stdout.write(
      `\n--- BEGIN V1 JSON (HTTP ${response.status}) ${response.url} ---\n` +
        `${JSON.stringify(response.body, null, 2)}\n` +
        '--- END V1 JSON ---\n',
    );
  }
  // END TEMPORARY V1 SCHEMA EXTRACTION BLOCK.
}

export async function runContractTest(
  session: ApiSession,
  ctx: ApiContext,
  endpoints: Record<string, EndpointDefinition>,
  row: TestCase,
  version: ApiVersion,
): Promise<void> {
  const name = version.toUpperCase();
  const response = await test.step(`Request ${name}`, () => session.get(ctx, row.endpoint, endpoints[row.endpoint], row, version));
  showResponse(response);

  await test.step(`Status is ${row.expectedStatus}`, () => {
    expect(response.status, `${name} returned status ${response.status}, the test data expects ${row.expectedStatus}`).toBe(row.expectedStatus);
  });

  await test.step('Schema', () => {
    if (row.expectedStatus < 200 || row.expectedStatus > 299) {
      test.info().annotations.push({ type: 'schema', description: `not applicable: the expected status is ${row.expectedStatus}, an error response` });
      return;
    }
    const schema = loadEndpointSchema(ctx, row.endpoint);
    const errors = validateSchema(schema, response.body);
    expect.soft(errors, `${name} response breaks the schema (${errors.length}):\n  ${errors.slice(0, 30).join('\n  ')}`).toEqual([]);
  });

  await test.step('Expected values', () => {
    const problems = checkFields(response.body, row.expectFields);
    expect.soft(problems, `${name} response does not match expectFields:\n  ${problems.join('\n  ')}`).toEqual([]);
  });
}

export async function runCompareTest(
  session: ApiSession,
  ctx: ApiContext,
  endpoints: Record<string, EndpointDefinition>,
  row: TestCase,
): Promise<void> {
  test.skip(!!row.skipComparison, row.skipComparison);
  const endpoint = endpoints[row.endpoint];

  const [v1, v2] = await test.step('Request V1 and V2', () =>
    Promise.all([
      session.get(ctx, row.endpoint, endpoint, row, 'v1'),
      session.get(ctx, row.endpoint, endpoint, row, 'v2'),
    ]),
  );
  showResponse(v1);
  showResponse(v2);

  await test.step(`Both statuses are ${row.expectedStatus}`, () => {
    expect(v1.status, `V1 returned status ${v1.status}, the test data expects ${row.expectedStatus}`).toBe(row.expectedStatus);
    expect(v2.status, `V2 returned status ${v2.status}, the test data expects ${row.expectedStatus}`).toBe(row.expectedStatus);
  });

  await test.step('V1 and V2 bodies are the same', () => {
    const rules = rulesFor(ctx, endpoint);
    const differences = diff(normalize(v1.body, rules), normalize(v2.body, rules));
    expect.soft(differences.length, formatDifferences(differences)).toBe(0);
  });
}
