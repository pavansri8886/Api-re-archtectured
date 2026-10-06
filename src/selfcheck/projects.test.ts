/**
 * Consistency checks of every project in projects/. No API calls.
 * Red here means a file is missing, misnamed or inconsistent, before any real test runs.
 * Also guards against a forgotten active console.log (responses can contain personal data).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PROJECTS_DIR, ROOT } from '../config/paths';
import { loadProjectConfig } from '../config/projectConfig';
import { loadTestCases } from '../data/loadTestCases';
import { loadEndpointSchema } from '../data/schemaFiles';
import { compileEndpointSchema } from '../checks/schema';
import { EndpointDefinitionInput, normalizeEndpoint } from '../types';

const dirs = (p: string) => fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const projects = dirs(PROJECTS_DIR);

test('there is at least one project', () => {
  expect(projects.length).toBeGreaterThan(0);
});

for (const project of projects) {
  const projectDir = path.join(PROJECTS_DIR, project);
  const testsDir = path.join(projectDir, 'tests');
  const specs = fs.existsSync(testsDir) ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.ts')) : [];

  test.describe(project, () => {
    test('project.config.ts is valid and at least one spec exists', () => {
      expect(() => loadProjectConfig(project)).not.toThrow();
      expect(specs.length, 'no tests/<api>.spec.ts found').toBeGreaterThan(0);
    });

    for (const spec of specs) {
      const api = spec.replace(/\.spec\.ts$/, '');
      test(`${api}: files, endpoints, test data and schemas fit together`, () => {
        const ctx = { project, api, projectDir };
        const specText = fs.readFileSync(path.join(testsDir, spec), 'utf-8');
        expect(specText, `${spec} must call apiContextFrom(__dirname, '${api}')`).toContain(`apiContextFrom(__dirname, '${api}')`);
        expect(specText, `${spec} must import ../endpoints/${api}.endpoints`).toContain(`../endpoints/${api}.endpoints`);

        const endpointsFile = path.join(projectDir, 'endpoints', `${api}.endpoints.ts`);
        expect(fs.existsSync(endpointsFile), `missing endpoints/${api}.endpoints.ts`).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
                const endpoints = require(endpointsFile).default as Record<string, EndpointDefinitionInput>;
        const names = Object.keys(endpoints);
        expect(names.length, 'the endpoints file exports no endpoints').toBeGreaterThan(0);

        const problems: string[] = [];
        for (const name of names) {
          const p = normalizeEndpoint(endpoints[name]).path;
          if (!(typeof p === 'string' ? p : p?.v2)) problems.push(`endpoint ${name}: the path is missing (use a text, or { v1, v2 })`);
          try {
                compileEndpointSchema(loadEndpointSchema(ctx, name));
          } catch (e) {
            problems.push((e as Error).message);
          }
        }
        try {
          loadTestCases(ctx, names);
        } catch (e) {
          problems.push((e as Error).message);
        }
        expect(problems.join('\n'), `${project}/${api}`).toBe('');
      });
    }
  });
}

test('no active console output is left in src or projects', () => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'selfcheck' && entry.name !== 'node_modules') walk(full);
      } else if (entry.name.endsWith('.ts')) {
        fs.readFileSync(full, 'utf-8').split('\n').forEach((line, i) => {
          const t = line.trim();
          if (/console\.\w+\s*\(/.test(t) && !t.startsWith('//') && !t.startsWith('*')) found.push(`${path.relative(ROOT, full)}:${i + 1}`);
        });
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  walk(PROJECTS_DIR);
  expect(found, 'comment these out before committing').toEqual([]);
});
