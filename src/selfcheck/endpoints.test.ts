import { expect, test } from '@playwright/test';
import { normalizeEndpoint } from '../types';

test('endpoint path shorthand defaults to GET', () => {
  expect(normalizeEndpoint('/crew')).toEqual({ method: 'GET', path: '/crew' });
});

test('full endpoint definitions keep their method and options', () => {
  const definition = {
    method: 'POST' as const,
    path: { v1: '/old/search', v2: '/search' },
    headers: { Accept: 'application/json' },
    ignore: ['meta.traceId'],
  };
  expect(normalizeEndpoint(definition)).toBe(definition);
});
