/**
 * data/loadTestCases.ts
 * What it does: reads projects/<project>/testdata/<api>.testdata.json, checks every row, resolves date placeholders.
 * Input:  ApiContext and the endpoint names exported by <api>.endpoints.ts.
 * Output: the list of TestCase rows. If anything is wrong, ONE error that lists every problem.
 *
 * Checked: file exists and is valid JSON; it is a non empty list; required fields; unknown fields (typos);
 *          ids unique; every endpoint named in a row exists; every endpoint has at least one row.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ApiContext, TestCase } from '../types';
import { resolvePlaceholders } from './placeholders';
import { expectFieldProblems } from '../checks/fields';

const ALLOWED = new Set([
  'endpoint', 'id', 'description', 'expectedStatus', 'pathParams', 'query', 'body',
  'headers', 'expectFields', 'tags', 'skipComparison',
]);

export function testDataPath(ctx: ApiContext): string {
  return path.join(ctx.projectDir, 'testdata', `${ctx.api}.testdata.json`);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function loadTestCases(ctx: ApiContext, endpointNames: string[]): TestCase[] {
  const file = testDataPath(ctx);
  const shown = path.relative(process.cwd(), file) || file;
  if (!fs.existsSync(file)) throw new Error(`Test data file is missing: ${shown}`);

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    throw new Error(`Test data is not valid JSON: ${shown} (${(error as Error).message})`);
  }
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${shown} must be a JSON list with at least one row.`);

  const problems: string[] = [];
  const seenIds = new Set<string>();
  const rowsPerEndpoint = new Map<string, number>();

  raw.forEach((row, index) => {
    const where = `row ${index + 1}${isPlainObject(row) && typeof row.id === 'string' ? ` (${row.id})` : ''}`;
    if (!isPlainObject(row)) {
      problems.push(`${where}: must be an object`);
      return;
    }
    for (const key of Object.keys(row)) {
      if (!ALLOWED.has(key)) problems.push(`${where}: unknown field "${key}" (allowed: ${[...ALLOWED].join(', ')})`);
    }
    for (const key of ['endpoint', 'id', 'description'] as const) {
      if (typeof row[key] !== 'string' || !(row[key] as string).trim()) problems.push(`${where}: "${key}" must be a non empty text`);
    }
    if (!Number.isInteger(row.expectedStatus)) problems.push(`${where}: "expectedStatus" is required and must be a whole number such as 200`);

    if (typeof row.id === 'string') {
      if (seenIds.has(row.id)) problems.push(`${where}: duplicate id "${row.id}"`);
      seenIds.add(row.id);
    }
    if (typeof row.endpoint === 'string') {
      if (!endpointNames.includes(row.endpoint)) {
        problems.push(`${where}: endpoint "${row.endpoint}" does not exist in ${ctx.api}.endpoints.ts (known: ${endpointNames.join(', ')})`);
      }
      rowsPerEndpoint.set(row.endpoint, (rowsPerEndpoint.get(row.endpoint) ?? 0) + 1);
    }
    for (const key of ['pathParams', 'query', 'headers', 'expectFields'] as const) {
      if (row[key] !== undefined && !isPlainObject(row[key])) problems.push(`${where}: "${key}" must be an object`);
    }
    if (isPlainObject(row.query)) {
      for (const [k, v] of Object.entries(row.query)) {
        if (!['string', 'number', 'boolean'].includes(typeof v)) problems.push(`${where}: query "${k}" must be text, number or true/false`);
      }
    }
    if (row.tags !== undefined && !(Array.isArray(row.tags) && row.tags.every((t) => typeof t === 'string' && t.trim()))) {
      problems.push(`${where}: "tags" must be a list of texts`);
    }
    if (row.skipComparison !== undefined && (typeof row.skipComparison !== 'string' || !row.skipComparison.trim())) {
      problems.push(`${where}: "skipComparison" must be a text that gives the reason`);
    }
    if (isPlainObject(row.expectFields)) {
      for (const p of expectFieldProblems(row.expectFields)) problems.push(`${where}: expectFields ${p}`);
    }
  });

  for (const name of endpointNames) {
    if (!rowsPerEndpoint.has(name)) problems.push(`endpoint "${name}" has no rows in the test data: it would never be tested`);
  }

  if (problems.length > 0) {
    throw new Error(`Problems in ${shown}:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
  return resolvePlaceholders(raw as TestCase[]);
}
