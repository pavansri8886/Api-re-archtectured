/**
 * config/projectConfig.ts
 * What it does: connects a spec file to its project, and turns project.config.ts into a URL and a login.
 * Input:  the folder of a spec file (projects/<project>/tests), the API name, and a version (v1 or v2).
 * Output: ApiContext, the target (base URL and auth) for one version, the compare rules of an endpoint.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROJECTS_DIR } from './paths';
import { readEnv } from './env';
import { ApiContext, ApiVersion, AuthConfig, CompareRules, EndpointDefinition, ProjectConfig } from '../types';

/**
 * Works out the project from where the spec lives: projects/<project>/tests.
 * The API name is passed in by the spec (const API = 'crew'); selfcheck verifies it matches the file name.
 */
export function apiContextFrom(testsDir: string, api: string): ApiContext {
  const parts = path.relative(PROJECTS_DIR, testsDir).split(path.sep);
  if (parts.length !== 2 || parts[0] === '..' || parts[1] !== 'tests') {
    throw new Error(`Spec files must be in projects/<project>/tests/, but this one is in: ${testsDir}`);
  }
  return { project: parts[0], api, projectDir: path.join(PROJECTS_DIR, parts[0]) };
}

const cache = new Map<string, ProjectConfig>();

/** Loads projects/<project>/project.config.ts once and checks its shape. */
export function loadProjectConfig(project: string): ProjectConfig {
  const cached = cache.get(project);
  if (cached) return cached;

  const file = path.join(PROJECTS_DIR, project, 'project.config.ts');
  if (!fs.existsSync(file)) throw new Error(`Missing projects/${project}/project.config.ts`);

  // Loaded when needed (not imported at the top) so a broken config fails only this project.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require(file);
  const config = (loaded.default ?? loaded) as ProjectConfig;
  const where = `projects/${project}/project.config.ts`;

  if (!config || typeof config !== 'object') {
    throw new Error(`${where} must export default defineProject({ ... })`);
  }
  if (config.contractVersions !== undefined) {
    const ok =
      Array.isArray(config.contractVersions) &&
      config.contractVersions.length > 0 &&
      config.contractVersions.every((v) => v === 'v1' || v === 'v2');
    if (!ok) throw new Error(`${where}: contractVersions must be a list with 'v1' and/or 'v2', for example ['v2']`);
  }
  if (config.compare !== undefined && typeof config.compare !== 'boolean') {
    throw new Error(`${where}: compare must be true or false`);
  }
  cache.set(project, config);
  return config;
}

/** Which kinds of tests a project gets. */
export function projectSettings(project: string): { contractVersions: ApiVersion[]; compare: boolean } {
  const config = loadProjectConfig(project);
  return { contractVersions: config.contractVersions ?? ['v2'], compare: config.compare ?? false };
}

export interface ResolvedTarget {
  baseUrl: string;
  auth: AuthConfig;
  label: string;
}

/** Where to send requests for one API and version: the API's own settings first, then the project defaults. */
export function resolveTarget(ctx: ApiContext, version: ApiVersion): ResolvedTarget {
  const config = loadProjectConfig(ctx.project);
  const merged = { ...config.defaults?.[version], ...config.apis?.[ctx.api]?.[version] };
  const label = `${ctx.project}/${ctx.api} ${version.toUpperCase()}`;

  if (!merged.urlEnv) {
    throw new Error(`No ${version} urlEnv for ${label}: set it under "defaults" in projects/${ctx.project}/project.config.ts`);
  }
  return { baseUrl: readEnv(merged.urlEnv, `${label} URL`), auth: merged.auth ?? { type: 'none' }, label };
}

/** Project rules plus endpoint rules, merged. */
export function rulesFor(ctx: ApiContext, endpoint: EndpointDefinition): CompareRules {
  const project = loadProjectConfig(ctx.project).rules ?? {};
  return {
    ignore: [...(project.ignore ?? []), ...(endpoint.ignore ?? [])],
    sortArrays: { ...(project.sortArrays ?? {}), ...(endpoint.sortArrays ?? {}) },
    dropNulls: endpoint.dropNulls ?? project.dropNulls ?? false,
  };
}
