/**
 * fixtures.ts
 * What it does: the only fixture of the framework. "session" is one ApiSession per worker,
 * so every test in the run shares one request cache (see http/session.ts).
 * Every spec file imports { test, expect } from here instead of from @playwright/test.
 */
import { test as base, expect } from '@playwright/test';
import { ApiSession } from './http/session';

export const test = base.extend<object, { session: ApiSession }>({
  session: [
    // Playwright requires the first argument to be a destructuring pattern, even when empty.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const session = new ApiSession();
      await use(session);
      await session.dispose();
    },
    { scope: 'worker' },
  ],
});

export { expect };
