/**
 * config/env.ts
 * What it does: reads the ENV variable, loads env/.env.<ENV> if that file exists, and reads settings.
 * Input:  the ENV variable (required, no default on purpose), plus the variables named in project.config.ts.
 * Output: readEnv(name) returns a value or stops with a message that names the variable and where to add it.
 *
 * Nothing runs at import time. The environment is loaded the first time a value is requested,
 * so unit tests can import other files without setting ENV.
 *
 * In a pipeline there is usually no .env file: the values come from the variable group.
 * A value that is already set always wins over the file.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ROOT } from './paths';

let loadedFor: string | undefined;

/** Name of the environment (uat, test, prod ...). Stops with a clear message when ENV is not set. */
export function currentEnv(): string {
  const env = process.env.ENV;
  if (!env) {
    throw new Error('ENV is not set. Set it to the environment name, for example ENV=uat (it selects env/.env.uat).');
  }
  if (loadedFor !== env) {
    const file = path.join(ROOT, 'env', `.env.${env}`);
    if (fs.existsSync(file)) {
      dotenv.config({ path: file });
    }
    loadedFor = env;
  }
  return env;
}

/** Reads a required variable. The message says what is missing, what needs it, and where to add it. */
export function readEnv(name: string, neededFor: string): string {
  const env = currentEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Environment variable ${name} is not set (needed for ${neededFor}, ENV=${env}). ` +
        `Add it to env/.env.${env} or to the pipeline variable group.`,
    );
  }
  return value;
}

/** Reads an optional variable. Returns undefined when it is not set. */
export function readOptionalEnv(name: string): string | undefined {
  currentEnv();
  return process.env[name] || undefined;
}

export const settings = {
  /** Timeout of one request in milliseconds. Default 30000. */
  get requestTimeoutMs(): number {
    const raw = readOptionalEnv('REQUEST_TIMEOUT_MS') ?? '30000';
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`REQUEST_TIMEOUT_MS must be a positive number of milliseconds, but it is "${raw}".`);
    }
    return value;
  },
  /** Only for test environments with self signed certificates. */
  get ignoreHttpsErrors(): boolean {
    return readOptionalEnv('IGNORE_HTTPS_ERRORS') === 'true';
  },
  /** Corporate proxy, for example http://proxy.company.local:8080. Playwright does not read HTTPS_PROXY by itself. */
  get proxyUrl(): string | undefined {
    return readOptionalEnv('PROXY_URL');
  },
  /** Hosts that must not go through the proxy, comma separated. */
  get noProxy(): string | undefined {
    return readOptionalEnv('NO_PROXY');
  },
};
