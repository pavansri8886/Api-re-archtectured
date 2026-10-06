/**
 * checks/schema.ts
 * What it does: validates a response body against the schema of one endpoint (JSON Schema draft 07, Ajv strict mode).
 * Input:  an EndpointSchema (from data/schemaFiles.ts) and the response body.
 * Output: a list of violations, each with the place in the body. An empty list means the body is valid.
 *
 * The whole schema file of an API is registered once under its id (for example "prj-ods/crew"); the endpoint's
 * schema is then picked with the pointer "prj-ods/crew#/$defs/<endpointName>", so "$ref": "#/$defs/crewMember" works.
 * Strict mode means a typo in a schema (an unknown keyword) is an error, not an ignored line.
 */
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { EndpointSchema } from '../data/schemaFiles';

const ajv = new Ajv({ allErrors: true, strictSchema: true, strictTypes: false, strictTuples: false, strictRequired: false });
addFormats(ajv);
const registered = new Set<string>();

/** Returns the compiled validator of one endpoint. Throws a clear error when the schema cannot be used. */
export function compileEndpointSchema(schema: EndpointSchema): ValidateFunction {
  const where = `${schema.file}, endpoint "${schema.endpoint}"`;
  try {
    if (!registered.has(schema.documentId)) {
      ajv.addSchema(schema.document, schema.documentId);
      registered.add(schema.documentId);
    }
    const validate = ajv.getSchema(`${schema.documentId}#/$defs/${schema.endpoint}`);
    if (!validate) throw new Error('the endpoint schema could not be found inside the file');
    return validate;
  } catch (error) {
    throw new Error(`The schema cannot be used (${where}): ${(error as Error).message}`);
  }
}

export function validateSchema(schema: EndpointSchema, body: unknown): string[] {
  const validate = compileEndpointSchema(schema);
  if (validate(body)) return [];
  return (validate.errors ?? []).map((e) => {
    const extra = e.keyword === 'additionalProperties' ? ` ("${(e.params as { additionalProperty: string }).additionalProperty}")` : '';
    return `${e.instancePath || '$'} ${e.message}${extra}`;
  });
}