import { defineConfig } from '@playwright/test';

/**
 * playwright.config.ts
 * Two test groups:
 *   api         the API tests in projects/<project>/tests/<api>.spec.ts
 *   selfcheck   tests of the framework itself and consistency checks of all projects (no API calls)
 *
 * Reports follow what you run:
 *   npx playwright test projects/prj-ods/tests/crew.spec.ts  -> reports/prj-ods/crew/
 *   npx playwright test projects/prj-ods                     -> reports/prj-ods/all-apis/
 *   npx playwright test --project=selfcheck                  -> reports/selfcheck/
 *   anything else                                            -> reports/all-projects/
 */

// One run date for the whole run. Workers inherit it, so a run that passes midnight still uses one date.
// Override on the command line to repeat a past day, for example TEST_DATE=2026-10-05
process.env.TEST_DATE ??= new Date().toISOString().slice(0, 10);

function reportDir(): string {
  const args = process.argv.slice(2).map((a) => a.replace(/\\/g, '/'));
  if (args.some((a) => a === '--project=selfcheck') || args.join(' ').includes('--project selfcheck')) return 'reports/selfcheck';
  const target = args.find((a) => /(^|\/)projects\/[^/]+/.test(a));
  if (target) {
    const parts = target.split('/').filter(Boolean);
    const i = parts.indexOf('projects');
    const file = parts[i + 2] === 'tests' ? parts[i + 3] : undefined;
    return `reports/${parts[i + 1]}/${file ? file.replace(/\.spec\.ts$/, '') : 'all-apis'}`;
  }
  return 'reports/all-projects';
}

const out = reportDir();

export default defineConfig({
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0, // a retry could hide a flaky API; every failure must be seen
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `${out}/html` }],
    ['junit', { outputFile: `${out}/junit/results.xml` }],
  ],
  // No browsers are used anywhere, so `npx playwright install` is never needed.
  projects: [
    { name: 'api', testDir: './projects', testMatch: /\.spec\.ts$/ },
    { name: 'selfcheck', testDir: './src/selfcheck', testMatch: /\.test\.ts$/ },
  ],
});
