/**
 * compare/diff.ts
 * What it does: finds every difference between two cleaned payloads (V1 is expected, V2 is actual) and formats them for the report.
 */
export type DifferenceKind = 'changed' | 'missing' | 'unexpected' | 'type_mismatch' | 'array_length';

export interface Difference {
  path: string;
  kind: DifferenceKind;
  expected?: unknown;
  actual?: unknown;
}

/** Deep diff. "expected" is V1 (or the baseline), "actual" is V2. */
export function diff(expected: unknown, actual: unknown, path = '$'): Difference[] {
  if (Object.is(expected, actual)) return [];

  const te = typeOf(expected);
  const ta = typeOf(actual);
  if (te !== ta) return [{ path, kind: 'type_mismatch', expected, actual }];

  if (te === 'array') {
    const e = expected as unknown[];
    const a = actual as unknown[];
    const out: Difference[] = [];
    if (e.length !== a.length) out.push({ path, kind: 'array_length', expected: e.length, actual: a.length });
    for (let i = 0; i < Math.min(e.length, a.length); i++) out.push(...diff(e[i], a[i], `${path}[${i}]`));
    return out;
  }

  if (te === 'object') {
    const e = expected as Record<string, unknown>;
    const a = actual as Record<string, unknown>;
    const out: Difference[] = [];
    for (const key of new Set([...Object.keys(e), ...Object.keys(a)])) {
      const p = `${path}.${key}`;
      if (!(key in a)) out.push({ path: p, kind: 'missing', expected: e[key] });
      else if (!(key in e)) out.push({ path: p, kind: 'unexpected', actual: a[key] });
      else out.push(...diff(e[key], a[key], p));
    }
    return out;
  }

  return [{ path, kind: 'changed', expected, actual }];
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

const show = (v: unknown): string => {
  const s = JSON.stringify(v);
  return s === undefined ? 'undefined' : s.length > 120 ? `${s.slice(0, 117)}...` : s;
};

/** Human readable summary used as the assertion message in reports. */
export function formatDifferences(diffs: Difference[], labels = { expected: 'V1', actual: 'V2' }, max = 30): string {
  if (diffs.length === 0) return 'No differences';
  const lines = diffs.slice(0, max).map((d) => {
    switch (d.kind) {
      case 'missing':
        return `  ${d.path}: missing in ${labels.actual} (${labels.expected} = ${show(d.expected)})`;
      case 'unexpected':
        return `  ${d.path}: only in ${labels.actual} (= ${show(d.actual)})`;
      case 'array_length':
        return `  ${d.path}: array length ${labels.expected} = ${d.expected}, ${labels.actual} = ${d.actual}`;
      default:
        return `  ${d.path}: ${labels.expected} = ${show(d.expected)} | ${labels.actual} = ${show(d.actual)}`;
    }
  });
  if (diffs.length > max) lines.push(`  ... and ${diffs.length - max} more (see the "differences" attachment)`);
  return `${diffs.length} difference(s) between ${labels.expected} and ${labels.actual}:\n${lines.join('\n')}`;
}
