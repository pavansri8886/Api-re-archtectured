import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validateSchema } from '../checks/schema';
import { loadSchema } from '../data/schemaFiles';
import { ApiContext } from '../types';

const schema = {
  type: 'object',
  required: ['id', 'count'],
  additionalProperties: false,
  properties: { id: { type: 'string' }, count: { type: 'integer' }, when: { type: 'string', format: 'date' } },
};

test.describe('schema check', () => {
  test('a valid body passes', () => {
    expect(validateSchema(schema, 'ok1', { id: 'a', count: 1, when: '2026-10-05' })).toEqual([]);
  });
  test('wrong type, missing field, extra field and bad date format are all reported together', () => {
    const errors = validateSchema(schema, 'ok2', { id: 5, extra: 1, when: '05/10/2026' }).join(' | ');
    expect(errors).toContain('/id must be string');
    expect(errors).toContain("required property 'count'");
    expect(errors).toContain('"extra"');
    expect(errors).toContain('/when must match format "date"');
  });
  test('a typo inside the schema itself is an error, not ignored', () => {
    expect(() => validateSchema({ type: 'object', requiered: ['id'] }, 'typo', {})).toThrow('cannot be used');
  });
});

test.describe('schema files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schemas-'));
  const ctx: ApiContext = { project: 'p', api: 'a', projectDir: dir };
  const put = (name: string, text: string) => {
    fs.mkdirSync(path.join(dir, 'schemas', 'a'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'schemas', 'a', `${name}.schema.json`), text);
  };
  test('missing file is an error', () => {
    expect(() => loadSchema(ctx, 'nothing')).toThrow('Schema file is missing');
  });
  test('empty, trivial and broken files are errors', () => {
    put('empty', '');
    put('braces', '{}');
    put('onlyType', '{ "type": "object" }');
    put('notObject', '[1]');
    put('good', '{ "type": "object", "properties": { "a": { "type": "string" } } }');
    expect(() => loadSchema(ctx, 'empty')).toThrow('not valid JSON');
    expect(() => loadSchema(ctx, 'braces')).toThrow('too weak');
    expect(() => loadSchema(ctx, 'onlyType')).toThrow('too weak');
    expect(() => loadSchema(ctx, 'notObject')).toThrow('must contain a JSON object');
    expect(loadSchema(ctx, 'good')).toBeTruthy();
  });
});
