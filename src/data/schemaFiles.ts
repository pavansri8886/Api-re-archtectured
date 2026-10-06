/**
 * data/schemaFiles.ts
 * What it does: finds the JSON schema of one endpoint inside the API's schema file.
 * Location: projects/<project>/schemas/<api>.schemas.json   (one file per API, all its endpoints inside)
 * Shape of the file:
 *   { "$defs": { "crewMember": {...shared part...}, "<endpointName>": {...schema of that endpoint...}, ... } }
 *   An endpoint schema can reuse a shared part with { "$ref": "#/$defs/crewMember" }.
 * Input:  ApiContext and the endpoint name.
 * Output: the endpoint's schema, or an ERROR. A missing file, a missing endpoint key, a weak schema are errors,
 *         never a skip: a test must not pass because nobody wrote the schema.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ApiContext } from '../types';

export interface EndpointSchema {
  /** Id of the whole file, for example "prj-ods/crew". */
  documentId: string;
  /** The whole file (including shared parts). */
  document: Record<string, unknown>;
  endpoint: string;
  /** Used in messages. */
  file: string;
}

export function schemaFilePath(ctx: ApiContext): string {
  return path.join(ctx.projectDir, 'schemas', `${ctx.api}.schemas.json`);
}

/** Keys that say something about the data's structure. A schema with none of them accepts almost anything. */
const STRUCTURE_KEYS = [
  'properties', 'patternProperties', 'items', 'prefixItems', 'required',
  'oneOf', 'anyOf', 'allOf', 'enum', 'const', '$ref', 'pattern',
];

const documents = new Map<string, Record<string, unknown>>();

function loadDocument(ctx: ApiContext): { document: Record<string, unknown>; file: string } {
  const full = schemaFilePath(ctx);
  const file = path.relative(process.cwd(), full) || full;
  const cached = documents.get(full);
  if (cached) return { document: cached, file };

  if (!fs.existsSync(full)) {
    throw new Error(`Schema file is missing: ${file}. Create it with a "$defs" section holding one schema per endpoint.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
  } catch (error) {
    throw new Error(`Schema file is not valid JSON: ${file} (${(error as Error).message})`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Schema file must contain a JSON object: ${file}`);
  }
  const defs = (parsed as Record<string, unknown>).$defs;
  if (defs === null || typeof defs !== 'object' || Array.isArray(defs)) {
    throw new Error(`Schema file needs a "$defs" object with one schema per endpoint: ${file}`);
  }
  // The framework owns the id, so every file has a unique, predictable one.
  const document = { ...(parsed as Record<string, unknown>), $id: `${ctx.project}/${ctx.api}` };
  documents.set(full, document);
  return { document, file };
}

export function loadEndpointSchema(ctx: ApiContext, endpointName: string): EndpointSchema {
  const { document, file } = loadDocument(ctx);
  const defs = document.$defs as Record<string, unknown>;

  if (!Object.prototype.hasOwnProperty.call(defs, endpointName)) {
    throw new Error(
      `No schema for endpoint "${endpointName}" in ${file}. Add it under "$defs" with exactly this name. ` +
        `Names found: ${Object.keys(defs).join(', ') || '(none)'}`,
    );
  }
  const schema = defs[endpointName];
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`The schema of endpoint "${endpointName}" in ${file} must be a JSON object.`);
  }
  if (!STRUCTURE_KEYS.some((key) => key in (schema as object))) {
    throw new Error(
      `The schema of endpoint "${endpointName}" in ${file} is too weak to check anything. ` +
        `It needs at least one of: ${STRUCTURE_KEYS.join(', ')}.`,
    );
  }
  return { documentId: document.$id as string, document, endpoint: endpointName, file };
}