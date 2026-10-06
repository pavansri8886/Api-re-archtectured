import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { compileEndpointSchema, validateSchema } from '../checks/schema';
import { loadEndpointSchema } from '../data/schemaFiles';
import { ApiContext } from '../types';

// Each test uses its own temp project folder, so the schema file cache never mixes tests up.
let counter = 0;
function setup(content: string | object | undefined): ApiContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schemas-'));
  const ctx: ApiContext = { project: `p${++counter}`, api: 'a', projectDir: dir };
  if (content !== undefined) {
    fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'schemas', 'a.schemas.json'), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return ctx;
}

const good = {
  $defs: {
    member: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, when: { type: 'string', format: 'date' } }, additionalProperties: false },
    listEndpoint: { type: 'object', required: ['crews'], properties: { crews: { type: 'array', items: { $ref: '#/$defs/member' } } } },
    rootArrayEndpoint: { type: 'array', items: { $ref: '#/$defs/member' } },
  },
};

test.describe('endpoint schema inside one file', () => {
  test('the right schema is picked by endpoint name, shared parts through $ref', () => {
    const ctx = setup(good);
    const list = loadEndpointSchema(ctx, 'listEndpoint');
    const array = loadEndpointSchema(ctx, 'rootArrayEndpoint');
    expect(validateSchema(list, { crews: [{ id: 'a', when: '2026-10-05' }] })).toEqual([]);
    expect(validateSchema(array, [{ id: 'a' }])).toEqual([]);
    // an object is valid for one endpoint and wrong for the other: proves the lookup is by name
    expect(validateSchema(array, { crews: [] }).join()).toContain('must be array');
  });

  test('wrong type, missing field, extra field and bad date inside a shared part are reported with their place', () => {
    const list = loadEndpointSchema(setup(good), 'listEndpoint');
    const errors = validateSchema(list, { crews: [{ id: 5, extra: 1, when: '05/10/2026' }, {}] }).join(' | ');
    expect(errors).toContain('/crews/0/id must be string');
    expect(errors).toContain('"extra"');
    expect(errors).toContain('/crews/0/when must match format "date"');
    expect(errors).toContain("/crews/1 must have required property 'id'");
  });

  test('an endpoint name that is not in the file is an error that lists the names found', () => {
    const ctx = setup(good);
    expect(() => loadEndpointSchema(ctx, 'ghost')).toThrow(/No schema for endpoint "ghost".*member, listEndpoint/);
  });

  test('a missing file, broken JSON, no $defs and a non object are errors', () => {
    expect(() => loadEndpointSchema(setup(undefined), 'x')).toThrow('Schema file is missing');
    expect(() => loadEndpointSchema(setup(''), 'x')).toThrow('not valid JSON');
    expect(() => loadEndpointSchema(setup('[1]'), 'x')).toThrow('must contain a JSON object');
    expect(() => loadEndpointSchema(setup({ type: 'object' }), 'x')).toThrow('needs a "$defs" object');
  });

  test('empty, trivial and wrongly typed endpoint schemas are errors', () => {
    const ctx = setup({ $defs: { empty: {}, onlyType: { type: 'object' }, notObject: [1], fine: { type: 'object', required: ['a'] } } });
    expect(() => loadEndpointSchema(ctx, 'empty')).toThrow('too weak');
    expect(() => loadEndpointSchema(ctx, 'onlyType')).toThrow('too weak');
    expect(() => loadEndpointSchema(ctx, 'notObject')).toThrow('must be a JSON object');
    expect(loadEndpointSchema(ctx, 'fine')).toBeTruthy();
  });

  test('a typo inside a schema, or a $ref to nothing, is an error and not ignored', () => {
    const ctx = setup({ $defs: { typo: { type: 'object', requiered: ['id'], properties: {} }, dangling: { $ref: '#/$defs/nope' } } });
    expect(() => compileEndpointSchema(loadEndpointSchema(ctx, 'typo'))).toThrow('cannot be used');
    expect(() => compileEndpointSchema(loadEndpointSchema(ctx, 'dangling'))).toThrow('cannot be used');
  });
});