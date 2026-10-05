/**
 * compare/normalize.ts
 * What it does: cleans a response before V1 and V2 are compared: removes ignored fields, sorts keys and unordered lists, optionally drops nulls. Input: payload and CompareRules. Output: a cleaned copy.
 */
import { CompareRules } from '../types';

type Segment = string; // an object key, or '[]' for "any item of a list"

function tokenize(pattern: string): Segment[] {
  return pattern
    .replace(/^\$\.?/, '')
    .replace(/\[\]/g, '.[]')
    .split('.')
    .filter(Boolean);
}

function matches(pattern: Segment[], path: Segment[]): boolean {
  if (pattern.length === 0) return path.length === 0;
  const [head, ...rest] = pattern;
  if (head === '**') {
    for (let i = 0; i <= path.length; i++) if (matches(rest, path.slice(i))) return true;
    return false;
  }
  if (path.length === 0) return false;
  return (head === '*' || head === path[0]) && matches(rest, path.slice(1));
}

/**
 * Returns a copy of a payload that is safe to compare:
 * ignored fields removed, object keys sorted, unordered lists sorted, nulls optionally dropped.
 * The input is never modified.
 */
export function normalize(value: unknown, rules: CompareRules): unknown {
  const ignore = (rules.ignore ?? []).map(tokenize);
  const sorts = Object.entries(rules.sortArrays ?? {}).map(([p, key]) => ({ pattern: tokenize(p), key }));

  const walk = (node: unknown, path: Segment[]): unknown => {
    if (Array.isArray(node)) {
      const items = node.map((item) => walk(item, [...path, '[]']));
      const sort = sorts.find((s) => matches(s.pattern, path));
      return sort ? sortList(items, sort.key) : items;
    }
    if (node !== null && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(node).sort()) {
        const childPath = [...path, key];
        const child = (node as Record<string, unknown>)[key];
        if (ignore.some((p) => matches(p, childPath))) continue;
        if (rules.dropNulls && child === null) continue;
        out[key] = walk(child, childPath);
      }
      return out;
    }
    return node;
  };

  return walk(value, []);
}

function sortList(items: unknown[], key: string): unknown[] {
  const sortValue = (item: unknown): string =>
    JSON.stringify(key === '*' ? item : ((item as Record<string, unknown> | null)?.[key] ?? null));
  return [...items].sort((a, b) => sortValue(a).localeCompare(sortValue(b)));
}
