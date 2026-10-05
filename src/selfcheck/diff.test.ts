import { test, expect } from '@playwright/test';
import { diff, formatDifferences } from '../compare/diff';

test.describe('diff', () => {
  test('identical payloads have no differences', () => {
    expect(diff({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toEqual([]);
  });

  test('reports a changed value with its exact path', () => {
    expect(diff({ licenses: [{ status: 'VALID' }] }, { licenses: [{ status: 'EXPIRED' }] })).toEqual([
      { path: '$.licenses[0].status', kind: 'changed', expected: 'VALID', actual: 'EXPIRED' },
    ]);
  });

  test('reports missing and unexpected fields', () => {
    expect(diff({ a: 1 }, { b: 2 })).toEqual([
      { path: '$.a', kind: 'missing', expected: 1 },
      { path: '$.b', kind: 'unexpected', actual: 2 },
    ]);
  });

  test('reports a type change, e.g. a date that became a number', () => {
    expect(diff({ validUntil: '2026-01-01' }, { validUntil: 20260101 })[0].kind).toBe('type_mismatch');
  });

  test('reports different list lengths', () => {
    expect(diff([1, 2], [1])).toEqual([{ path: '$', kind: 'array_length', expected: 2, actual: 1 }]);
  });

  test('null versus a value is a difference', () => {
    expect(diff({ a: null }, { a: 0 })).toHaveLength(1);
  });

  test('the readable message names the field and both values', () => {
    const message = formatDifferences(diff({ name: 'Pallet' }, { name: 'Crate' }));
    expect(message).toContain('$.name');
    expect(message).toContain('"Pallet"');
    expect(message).toContain('"Crate"');
  });
});
