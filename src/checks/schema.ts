/**
 * checks/schema.ts
 * What it does: validates a response body against a JSON schema (draft 07) with Ajv in strict mode.
 * Input:  the schema object, a cache key (the schema file path) and the response body.
 * Output: a list of violations, each with the place in the body. An empty list means the body is valid.
 *
 * Strict mode means a typo in the schema itself (an unknown keyword) is an error, not an ignored line.
 * Schemas with "$ref" to other files are not supported yet and fail with a clear message.
 */
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strictSchema: true, strictTypes: false, strictTuples: false, strictRequired: false });
addFormats(ajv);
const compiled = new Map<string, ValidateFunction>();

export function validateSchema(schema: Record<string, unknown>, cacheKey: string, body: unknown): string[] {
  let validate = compiled.get(cacheKey);
  if (!validate) {
    try {
      validate = ajv.compile(schema);
    } catch (error) {
      throw new Error(`The schema ${cacheKey} cannot be used: ${(error as Error).message}`);
    }
    compiled.set(cacheKey, validate);
  }
  if (validate(body)) return [];
  return (validate.errors ?? []).map((e) => {
    const extra = e.keyword === 'additionalProperties' ? ` ("${(e.params as { additionalProperty: string }).additionalProperty}")` : '';
    return `${e.instancePath || '$'} ${e.message}${extra}`;
  });
}
