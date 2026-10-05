/**
 * data/schemaFiles.ts
 * What it does: finds and loads the JSON schema of one endpoint.
 * Location: projects/<project>/schemas/<api>/<endpoint>.schema.json
 * Input:  ApiContext and the endpoint name.
 * Output: the schema object, or an error. A missing, unreadable or trivial schema is an ERROR, never a skip:
 *         a test must not pass because nobody wrote the schema.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ApiContext } from '../types';

export function schemaPath(ctx: ApiContext, endpointName: string): string {
  return path.join(ctx.projectDir, 'schemas', ctx.api, `${endpointName}.schema.json`);
}

/** Keys that say something about the data's structure. A schema with none of them accepts almost anything. */
const STRUCTURE_KEYS = [
  'properties', 'patternProperties', 'items', 'prefixItems', 'required',
  'oneOf', 'anyOf', 'allOf', 'enum', 'const', '$ref', 'pattern',
];

export function loadSchema(ctx: ApiContext, endpointName: string): Record<string, unknown> {
  const file = schemaPath(ctx, endpointName);
  const shown = path.relative(process.cwd(), file) || file;
  if (!fs.existsSync(file)) {
    throw new Error(`Schema file is missing: ${shown}. Create it, a test without a schema does not count as validated.`);
  }
  let schema: unknown;
  try {
    schema = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    throw new Error(`Schema file is not valid JSON: ${shown} (${(error as Error).message})`);
  }
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`Schema file must contain a JSON object: ${shown}`);
  }
  const hasStructure = STRUCTURE_KEYS.some((key) => key in (schema as object));
  if (!hasStructure) {
    throw new Error(
      `Schema is too weak to check anything: ${shown}. It needs at least one of: ${STRUCTURE_KEYS.join(', ')}.`,
    );
  }
  return schema as Record<string, unknown>;
}
