import { test, expect } from '@playwright/test';
import { normalize } from '../compare/normalize';

// These tests protect the logic every project depends on. If normalize breaks,
// comparisons could pass when V1 and V2 really differ, so every rule is checked here.

test.describe('normalize', () => {
  test('removes an ignored field by exact path', () => {
    expect(normalize({ meta: { requestId: 'x', page: 1 } }, { ignore: ['meta.requestId'] })).toEqual({ meta: { page: 1 } });
  });

  test('"**" ignores a field name at any depth', () => {
    const input = { lastUpdated: 1, a: { lastUpdated: 2, b: [{ lastUpdated: 3, keep: true }] } };
    expect(normalize(input, { ignore: ['**.lastUpdated'] })).toEqual({ a: { b: [{ keep: true }] } });
  });

  test('"[]" ignores a field in every list item', () => {
    const input = { licenses: [{ id: 1, n: 'a' }, { id: 2, n: 'b' }] };
    expect(normalize(input, { ignore: ['licenses[].id'] })).toEqual({ licenses: [{ n: 'a' }, { n: 'b' }] });
  });

  test('does not ignore a field with a similar but different path', () => {
    expect(normalize({ meta: { requestId: 'x' }, requestId: 'y' }, { ignore: ['meta.requestId'] })).toEqual({ meta: {}, requestId: 'y' });
  });

  test('sorts a list by a field so order does not matter', () => {
    const a = normalize({ licenses: [{ licenseNumber: 'B' }, { licenseNumber: 'A' }] }, { sortArrays: { licenses: 'licenseNumber' } });
    const b = normalize({ licenses: [{ licenseNumber: 'A' }, { licenseNumber: 'B' }] }, { sortArrays: { licenses: 'licenseNumber' } });
    expect(a).toEqual(b);
  });

  test('"*" sorts a list of plain values, "$" targets the root list', () => {
    expect(normalize({ tags: ['b', 'a'] }, { sortArrays: { tags: '*' } })).toEqual({ tags: ['a', 'b'] });
    expect(normalize([{ id: 2 }, { id: 1 }], { sortArrays: { $: 'id' } })).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('keeps list order when no sort rule applies', () => {
    expect(normalize({ list: [2, 1] }, {})).toEqual({ list: [2, 1] });
  });

  test('dropNulls treats null and missing as the same', () => {
    expect(normalize({ a: 1, b: null }, { dropNulls: true })).toEqual({ a: 1 });
    expect(normalize({ a: 1, b: null }, {})).toEqual({ a: 1, b: null });
  });

  test('does not modify the input', () => {
    const input = { meta: { requestId: 'x' } };
    normalize(input, { ignore: ['meta.requestId'] });
    expect(input).toEqual({ meta: { requestId: 'x' } });
  });
});
