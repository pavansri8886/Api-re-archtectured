import { expect, test } from '@playwright/test';
import { parseResponseBody } from '../http/apiClient';

test.describe('parseResponseBody', () => {
  test('parses a JSON object response', () => {
    expect(parseResponseBody('{"crews":[]}')).toEqual({ crews: [] });
  });

  test('parses a JSON object encoded inside a JSON string', () => {
    expect(parseResponseBody('"{\\"crews\\":[]}"')).toEqual({ crews: [] });
  });

  test('parses a JSON array encoded inside a JSON string', () => {
    expect(parseResponseBody('"[1,2,3]"')).toEqual([1, 2, 3]);
  });

  test('preserves scalar JSON strings and non-JSON text', () => {
    expect(parseResponseBody('"hello"')).toBe('hello');
    expect(parseResponseBody('upstream unavailable')).toBe('upstream unavailable');
  });

  test('maps an empty response to null', () => {
    expect(parseResponseBody('')).toBeNull();
  });
});
