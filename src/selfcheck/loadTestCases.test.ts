import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadTestCases } from '../data/loadTestCases';
import { ApiContext } from '../types';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testdata-'));
const ctx: ApiContext = { project: 'p', api: 'a', projectDir: dir };
const names = ['one', 'two'];
const write = (data: unknown) => {
  fs.mkdirSync(path.join(dir, 'testdata'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'testdata', 'a.testdata.json'), typeof data === 'string' ? data : JSON.stringify(data));
};
const row = (over: object = {}) => ({ endpoint: 'one', id: 'R1', description: 'd', expectedStatus: 200, ...over });

test.describe('loadTestCases', () => {
  test('a good file loads and resolves date placeholders', () => {
    process.env.TEST_DATE = '2026-10-05';
    write([row({ query: { d: '{{date:-1}}' } }), row({ endpoint: 'two', id: 'R2' })]);
    const rows = loadTestCases(ctx, names);
    expect(rows.length).toBe(2);
    expect(rows[0].query).toEqual({ d: '2026-10-04' });
  });
  test('missing file, invalid JSON, empty list', () => {
    fs.rmSync(path.join(dir, 'testdata'), { recursive: true, force: true });
    expect(() => loadTestCases(ctx, names)).toThrow('missing');
    write('{ nope');
    expect(() => loadTestCases(ctx, names)).toThrow('not valid JSON');
    write([]);
    expect(() => loadTestCases(ctx, names)).toThrow('at least one row');
  });
  test('every problem is listed in one message', () => {
    write([
      row({ expectedStatus: undefined }),
      row({ id: 'R1', endpoint: 'ghost' }),
      row({ id: 'R3', quary: {} }),
      row({ id: 'R4', expectFields: { a: { $exist: true } } }),
      row({ id: 'R5', tags: 'smoke' }),
    ]);
    let message = '';
    try {
      loadTestCases(ctx, names);
    } catch (e) {
      message = (e as Error).message;
    }
    for (const part of ['"expectedStatus" is required', 'duplicate id "R1"', 'endpoint "ghost" does not exist', 'unknown field "quary"', 'expectFields', '"tags" must be a list', 'endpoint "two" has no rows']) {
      expect(message, part).toContain(part);
    }
  });
  test('an unknown placeholder stops the load', () => {
    write([row(), row({ endpoint: 'two', id: 'R2', query: { d: '{{tomorrow}}' } })]);
    expect(() => loadTestCases(ctx, names)).toThrow('Unknown placeholder');
  });
});
