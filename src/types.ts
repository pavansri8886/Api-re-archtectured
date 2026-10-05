/**
 * types.ts
 * What it does: the shared vocabulary of the framework. Every other file imports its types from here.
 * What is in it: HTTP method and version, comparison rules, endpoint and project definitions,
 *                the shape of one test data row, and the shape of one API response.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiVersion = 'v1' | 'v2';

// ---------------------------------------------------------------------------
// Comparison rules (used only when V1 and V2 are compared)
// ---------------------------------------------------------------------------

export interface CompareRules {
  /** Fields allowed to differ. "meta.id" exact path, "items[].id" in every list item, "**.traceId" at any depth. */
  ignore?: string[];
  /** Lists whose order does not matter: path to the list, then the field to sort by ("*" = whole item, "$" = root list). */
  sortArrays?: Record<string, string>;
  /** Treat a field that is null and a field that is missing as the same thing. */
  dropNulls?: boolean;
}

// ---------------------------------------------------------------------------
// Endpoint definition: projects/<project>/endpoints/<api>.endpoints.ts
// ---------------------------------------------------------------------------

export interface EndpointDefinition extends CompareRules {
  method: HttpMethod;
  /** Path templates. {name} is filled from pathParams in the test data. v1 is optional so V1 can be retired. */
  path: { v1?: string; v2: string };
  /** Headers every call to this endpoint needs. */
  headers?: Record<string, string>;
}

/** Identity function. It exists only so endpoint files get type checking and autocomplete. */
export function defineEndpoint(definition: EndpointDefinition): EndpointDefinition {
  return definition;
}

// ---------------------------------------------------------------------------
// Project configuration: projects/<project>/project.config.ts
// Every field ending in "Env" holds the NAME of an environment variable, never the value.
// ---------------------------------------------------------------------------

export type AuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; tokenEnv: string }
  | { type: 'apiKey'; header: string; keyEnv: string }
  | {
      type: 'azureAd';
      scopeEnv: string;
      tenantIdEnv?: string; // default AZURE_TENANT_ID
      clientIdEnv?: string; // default AZURE_CLIENT_ID
      clientSecretEnv?: string; // default AZURE_CLIENT_SECRET
    };

export interface VersionTarget {
  urlEnv: string;
  auth?: AuthConfig;
}

export interface ApiTarget {
  v1?: Partial<VersionTarget>;
  v2?: Partial<VersionTarget>;
}

export interface ProjectConfig {
  /** Where the APIs live, for every API of the project. */
  defaults?: ApiTarget;
  /** Optional overrides for one API, by API name (for example when one API has its own host). */
  apis?: Record<string, ApiTarget>;
  /** Comparison rules shared by every endpoint of the project. */
  rules?: CompareRules;
  /** Versions that get contract tests (status, schema, expected values). Default: ['v2']. */
  contractVersions?: ApiVersion[];
  /** Whether V1 is compared with V2. Default: true. Set false for a project with one version only. */
  compare?: boolean;
}

export function defineProject(config: ProjectConfig): ProjectConfig {
  return config;
}

// ---------------------------------------------------------------------------
// Test data: projects/<project>/testdata/<api>.testdata.json (a list of these rows)
// ---------------------------------------------------------------------------

export interface TestCase {
  /** Name of an endpoint exported by <api>.endpoints.ts */
  endpoint: string;
  /** Unique within the file. */
  id: string;
  description: string;
  /** Required on purpose: every row states what status it expects. */
  expectedStatus: number;
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Values the response must contain. See checks/fields.ts for the supported forms. */
  expectFields?: Record<string, unknown>;
  tags?: string[];
  /** A reason text. Skips the V1 against V2 comparison for this row (visible as skipped in the report). */
  skipComparison?: string;
}

// ---------------------------------------------------------------------------
// Internal shapes
// ---------------------------------------------------------------------------

/** Where a test belongs: the project folder and the API name. */
export interface ApiContext {
  project: string;
  api: string;
  projectDir: string;
}

export interface ApiResponse {
  version: ApiVersion;
  url: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
}
