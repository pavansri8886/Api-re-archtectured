import { test, expect } from '@playwright/test';
import { checkFields, expectFieldProblems } from '../checks/fields';

// checkFields decides if the expected values of a test row are met. A wrong "pass" here hides real defects.
const body = { status: 'VALID', n: 0, nothing: null, crews: [{ id: 'A', license: { no: 7 } }, { id: 'B' }], obj: { a: 1 } };

test.describe('checkFields', () => {
  test('exact values match, including 0, null and nested paths', () => {
    expect(checkFields(body, { status: 'VALID', n: 0, nothing: null, 'crews[0].license.no': 7, 'crews[1].id': 'B', obj: { a: 1 } })).toEqual([]);
  });
  test('a different value is reported with expected and found', () => {
    const [p] = checkFields(body, { status: 'EXPIRED' });
    expect(p).toContain('expected "EXPIRED"');
    expect(p).toContain('found "VALID"');
  });
  test('a missing path is always a problem', () => {
    expect(checkFields(body, { nope: 'x' })[0]).toContain('missing');
    expect(checkFields(body, { 'crews[5].id': 'x' })[0]).toContain('missing');
    expect(checkFields(body, { 'status.deeper': 'x' })[0]).toContain('missing');
  });
  test('null is not the same as missing, and 0 is not the same as "0"', () => {
    expect(checkFields(body, { nothing: { $exists: true } })).toEqual([]);
    expect(checkFields(body, { n: '0' }).length).toBe(1);
  });
  test('$exists true and false', () => {
    expect(checkFields(body, { status: { $exists: true }, gone: { $exists: false } })).toEqual([]);
    expect(checkFields(body, { gone: { $exists: true } }).length).toBe(1);
    expect(checkFields(body, { status: { $exists: false } }).length).toBe(1);
  });
  test('$minItems needs a list that is long enough', () => {
    expect(checkFields(body, { crews: { $minItems: 2 } })).toEqual([]);
    expect(checkFields(body, { crews: { $minItems: 3 } }).length).toBe(1);
    expect(checkFields(body, { status: { $minItems: 1 } })[0]).toContain('expected a list');
    expect(checkFields(body, { gone: { $minItems: 1 } })[0]).toContain('missing');
  });
  test('works when the body is a list', () => {
    expect(checkFields([{ id: 1 }], { '[0].id': 1 })).toEqual([]);
  });
  test('typos in the definition are problems, not passes', () => {
    expect(expectFieldProblems({ a: { $exist: true } }).length).toBe(1);
    expect(expectFieldProblems({ a: { $exists: 'yes' } }).length).toBe(1);
    expect(expectFieldProblems({ a: { $minItems: -1 } }).length).toBe(1);
    for (const bad of ['a..b', '.a', 'a.', 'a[x]', 'a[0', '']) expect(expectFieldProblems({ [bad]: 1 }).length, bad).toBe(1);
    expect(expectFieldProblems({ 'a[0][1].b': 1 })).toEqual([]);
    expect(checkFields(body, { status: { $exist: true } }).length).toBe(1);
  });
});
