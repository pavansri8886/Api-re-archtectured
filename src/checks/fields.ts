/**
 * checks/fields.ts
 * What it does: checks the "expectFields" of a test row against a response body.
 * Input:  the response body and the expectFields object.
 * Output: a list of problems. An empty list means everything matched.
 *
 * Path syntax:  "data.status"   "crews[0].license.number"   "[0].id" (body is a list)
 * Forms of an expected value:
 *   "VALID"                  exact value (text, number, true/false, null, or a whole object/list)
 *   { "$exists": true }      the field is present (its value may be null)
 *   { "$exists": false }     the field is absent
 *   { "$minItems": 1 }       the field is a list with at least that many items
 * A path that does not exist is always a problem (never skipped) unless $exists is false.
 */
import { isDeepStrictEqual } from 'util';

const OPERATORS = ['$exists', '$minItems'];

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const show = (v: unknown): string => {
  const s = JSON.stringify(v);
  if (s === undefined) return 'undefined';
  return s.length > 100 ? `${s.slice(0, 97)}...` : s;
};

/** Splits "a.b[2].c" into ["a", "b", 2, "c"]. Returns undefined for a path it cannot read. */
function tokens(path: string): (string | number)[] | undefined {
  const parts = path.match(/\[\d+\]|[^.[\]]+/g);
  if (!parts) return undefined;
  // Rebuild the path from the pieces. If it differs from the original, the original had a stray dot or bracket.
  const rebuilt = parts.map((p, i) => (p.startsWith('[') || i === 0 ? p : `.${p}`)).join('');
  if (rebuilt !== path) return undefined;
  return parts.map((p) => (p.startsWith('[') ? Number(p.slice(1, -1)) : p));
}

export function readPath(root: unknown, path: string): { found: boolean; value?: unknown } {
  const steps = tokens(path);
  if (!steps) return { found: false };
  let node = root;
  for (const step of steps) {
    if (typeof step === 'number') {
      if (!Array.isArray(node) || step >= node.length) return { found: false };
      node = node[step];
    } else {
      if (!isPlainObject(node) || !(step in node)) return { found: false };
      node = node[step];
    }
  }
  return { found: true, value: node };
}

const isOperator = (v: unknown): v is Record<string, unknown> =>
  isPlainObject(v) && Object.keys(v).some((k) => k.startsWith('$'));

/** Problems in the DEFINITION of expectFields itself (typos), found before any request is sent. */
export function expectFieldProblems(expectFields: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const [path, expected] of Object.entries(expectFields)) {
    if (!tokens(path)) problems.push(`"${path}": cannot read this path. Use forms like a.b or items[0].name`);
    if (!isOperator(expected)) continue;
    const keys = Object.keys(expected);
    if (keys.length !== 1 || !OPERATORS.includes(keys[0])) {
      problems.push(`"${path}": use exactly one of ${OPERATORS.join(', ')}, but found ${keys.join(', ')}`);
    } else if (keys[0] === '$exists' && typeof expected.$exists !== 'boolean') {
      problems.push(`"${path}": $exists must be true or false`);
    } else if (keys[0] === '$minItems' && !(Number.isInteger(expected.$minItems) && (expected.$minItems as number) >= 0)) {
      problems.push(`"${path}": $minItems must be a whole number, 0 or more`);
    }
  }
  return problems;
}

export function checkFields(body: unknown, expectFields: Record<string, unknown> | undefined): string[] {
  const problems: string[] = [];
  for (const [path, expected] of Object.entries(expectFields ?? {})) {
    const bad = expectFieldProblems({ [path]: expected });
    if (bad.length > 0) {
      problems.push(...bad);
      continue;
    }
    const found = readPath(body, path);

    if (isOperator(expected) && '$exists' in expected) {
      if (expected.$exists && !found.found) problems.push(`${path}: expected to exist, but it is missing`);
      if (!expected.$exists && found.found) problems.push(`${path}: expected to be absent, but found ${show(found.value)}`);
    } else if (isOperator(expected)) {
      const min = expected.$minItems as number;
      if (!found.found) problems.push(`${path}: expected a list with at least ${min} item(s), but the field is missing`);
      else if (!Array.isArray(found.value)) problems.push(`${path}: expected a list, but found ${show(found.value)}`);
      else if (found.value.length < min) problems.push(`${path}: expected at least ${min} item(s), but the list has ${found.value.length}`);
    } else if (!found.found) {
      problems.push(`${path}: missing in the response (expected ${show(expected)})`);
    } else if (!isDeepStrictEqual(found.value, expected)) {
      problems.push(`${path}: expected ${show(expected)}, but found ${show(found.value)}`);
    }
  }
  return problems;
}
