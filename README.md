# API Integration Tests

Playwright + TypeScript. No browser is used, so `npx playwright install` is never needed.

Two kinds of test are created for every row of test data:

| Kind | What it checks | Calls |
|---|---|---|
| **contract** | status, JSON schema, expected values of one version (default V2) | 1 |
| **compare** | V1 and V2 give the same status and the same body (after ignore rules) | V1 + V2 |

The V2 answer is fetched once per row and shared by both tests. A project with one API version only (for example a
data checker) sets `compare: false` and gets contract tests only.

## Structure

```
projects/<project>/
  project.config.ts            where the APIs live (env variable NAMES), auth, ignore rules, which test kinds
  endpoints/<api>.endpoints.ts how to call each endpoint (method, v1 and v2 path)
  testdata/<api>.testdata.json one row per test
  schemas/<api>/<endpoint>.schema.json   JSON schema (draft 07) of the response, one per endpoint
  tests/<api>.spec.ts          creates the tests from the rows (same file shape for every API)
src/                           the engine, the same for every project, never imports from projects/
  types.ts                     shared types
  fixtures.ts                  the only fixture: one request cache per worker
  steps.ts                     the checks of a contract test and a compare test
  config/    paths.ts, env.ts, projectConfig.ts
  data/      loadTestCases.ts (reads and checks the rows), placeholders.ts ({{date:N}}), schemaFiles.ts
  checks/    schema.ts (Ajv), fields.ts (expectFields)
  compare/   normalize.ts (clean both payloads), diff.ts (list the differences)
  http/      apiClient.ts (one request), auth.ts, context.ts (proxy), session.ts (the shared cache)
  selfcheck/ tests of the framework and consistency checks of every project (no API calls)
env/       .env.<ENV> files (only .env.example is committed)
reports/   html and junit per run (not committed)
```

Names connect the pieces: `tests/crew.spec.ts` uses `endpoints/crew.endpoints.ts`, `testdata/crew.testdata.json`
and `schemas/crew/<endpoint>.schema.json`. The `ctx = apiContextFrom(__dirname, 'crew')` line in the spec must carry the
same name as the file.

## Running

`ENV` is required (no default, on purpose). It selects `env/.env.<ENV>`; in a pipeline the values come from the variable group.

| What | Command |
|---|---|
| Everything | `ENV=uat npx playwright test --project=api` |
| One API | `ENV=uat npx playwright test projects/prj-ods/tests/crew.spec.ts` |
| One endpoint (both kinds) | `ENV=uat npx playwright test --project=api -g "validLicenseCrewList"` |
| One row | `-g "TC02"` |
| One kind | `-g "contract"` or `-g "compare"` |
| Tag of a row | `--grep @smoke` |
| Framework checks | `npm run test:selfcheck`, `npm run typecheck`, `npm run lint` |

PowerShell: `$env:ENV="uat"; npx playwright test --project=api`. CMD: `set ENV=uat && npx playwright test --project=api`.
Repeat a past day: `$env:TEST_DATE="2026-10-05"`.

Reports: `reports/<project>/<api>/html/index.html` (open with `npx playwright show-report reports/prj-ods/crew/html`).
Responses are NOT attached to reports (they may contain personal data). To look at one while debugging, see "Debugging" below.

## Test data

`testdata/crew.testdata.json` is a list. Per row:

| Field | Meaning |
|---|---|
| `endpoint`, `id`, `description` | required. `endpoint` is a name exported by `crew.endpoints.ts`. `id` is unique in the file |
| `expectedStatus` | required: every row says which status it expects (200, 404 ...) |
| `pathParams`, `query`, `body`, `headers` | what to send |
| `expectFields` | values the response must contain (below) |
| `tags` | become `@tag`, run with `--grep` |
| `skipComparison` | a reason text. Skips the compare test of this row and shows as skipped |

A typo in a field name, a duplicate id, an unknown endpoint, or an endpoint without rows stops that API with one failing
test that lists every problem. Other APIs still run.

**Dates.** Write `{{date:N}}` anywhere in a row: N whole days from today (UTC). `{{date:0}}` today, `{{date:-1}}` yesterday,
`{{date:2}}` two days ahead. Example: `"from-date": "{{date:-3}}", "to-date": "{{date:-1}}"`. The date is fixed once per run.

**expectFields** (path syntax `a.b`, `items[0].name`, `[0].id` when the body is a list):

```json
"expectFields": {
  "status": "VALID",
  "crews[0].license.number": 7,
  "crews": { "$minItems": 1 },
  "meta": { "$exists": true },
  "secret": { "$exists": false }
}
```

A path that is not in the response is a failure, never a skip.

## Schemas

One file per endpoint, `schemas/<api>/<endpoint>.schema.json`, JSON Schema draft 07. A missing, empty or too weak
schema (only `type`) is a **failure**, so an endpoint cannot look validated when nobody wrote its schema. Ajv runs in strict
mode: a typo in the schema itself is an error. Minimal example:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["crews"],
  "properties": {
    "crews": { "type": "array", "items": { "type": "object", "required": ["id"], "properties": { "id": { "type": "string" } } } }
  }
}
```

Add `"additionalProperties": false` where an unexpected new field should fail the test.
For rows that expect an error status (404 ...) the schema step is shown as "not applicable" in the report (success schema
does not describe an error body); status and expectFields are still checked.
`$ref` to other files is not supported yet.

## Compare rules (endpoint or project level)

```ts
defineEndpoint({ method: 'GET', path: { v1: '/x', v2: '/x' },
  ignore: ['**.traceId'],                 // allowed to differ
  sortArrays: { licenses: 'licenseNumber' }, // order does not matter
  dropNulls: true });                     // null and missing are the same
```

Ignore syntax: `meta.id` exact path, `items[].id` in every list item, `**.traceId` any depth, `*` any one field.
Sort: field name to sort by, `*` for plain values, `$` for a root list.

## Project configuration

`project.config.ts`: `defaults` (v1 and v2 `urlEnv` + `auth`), optional `apis` (override for one API), `rules` (shared
ignore), `contractVersions` (default `['v2']`), `compare` (default `true`). Everything ending in `Env` is the NAME of an
environment variable. Auth types: `none`, `bearer`, `apiKey` (Azure APIM: header `Ocp-Apim-Subscription-Key`), `azureAd`.

Optional environment settings: `PROXY_URL`, `NO_PROXY` (Playwright ignores HTTPS_PROXY, so these are passed explicitly),
`REQUEST_TIMEOUT_MS` (default 30000), `IGNORE_HTTPS_ERRORS=true` (test environments only).

## Debugging (local only)

`src/steps.ts`, function `showResponse`: remove the two slashes in front of the `console.log` line to print responses.
Put them back before committing. `npm run test:selfcheck` fails if an active `console.log` is left in `src` or `projects`.

## What happens when something is wrong

| Situation | Result |
|---|---|
| `ENV` not set | clear message, tests fail |
| Variable (URL, key) not set | that test fails and names the variable and the file |
| Unreachable server, timeout | that test fails with the URL and reason |
| Status differs from `expectedStatus` | stops that test (nothing else is meaningful), both versions named |
| Schema, expected value or difference | all of them are reported in one failure |
| Broken test data or config of one API | one failing "setup problem" test for that API, others run |

Retries are off (0) and workers are 1 on purpose: every failure must be seen, and a retry must not hide a flaky API.
Playwright starts a fresh worker after a failed test, so after a failure the shared request cache starts empty and one
request may be repeated. That costs one extra call, never a wrong result.

## Adding an API or a project

New API in a project: add `endpoints/<api>.endpoints.ts`, `testdata/<api>.testdata.json`, `schemas/<api>/*.schema.json`
and `tests/<api>.spec.ts` (copy another spec, change the name in two lines). If it has its own host, add `apis: { <api>: {...} }`
in `project.config.ts`. New project: a new folder under `projects/` with `project.config.ts`. Nothing in `src/` changes.
`npm run test:selfcheck` reports anything missing or misnamed.
