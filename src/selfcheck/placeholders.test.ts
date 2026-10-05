import { test, expect } from '@playwright/test';
import { resolvePlaceholders, resolveString, runDate } from '../data/placeholders';

test.describe('placeholders', () => {
  const base = '2026-03-01';
  test('{{date:N}} counts whole days from the base date', () => {
    expect(resolveString('{{date:0}}', base)).toBe('2026-03-01');
    expect(resolveString('{{date:-1}}', base)).toBe('2026-02-28');
    expect(resolveString('{{date:2}}', base)).toBe('2026-03-03');
    expect(resolveString('{{ date: -30 }}', base)).toBe('2026-01-30');
  });
  test('crosses a leap day and a year end correctly', () => {
    expect(resolveString('{{date:1}}', '2028-02-28')).toBe('2028-02-29');
    expect(resolveString('{{date:1}}', '2026-12-31')).toBe('2027-01-01');
  });
  test('works inside text and nested JSON, without changing the input', () => {
    const input = { q: { from: '{{date:-1}}' }, list: ['x {{date:0}} y'] };
    expect(resolvePlaceholders(input, base)).toEqual({ q: { from: '2026-02-28' }, list: ['x 2026-03-01 y'] });
    expect(input.q.from).toBe('{{date:-1}}');
  });
  test('an unknown or broken placeholder is an error', () => {
    expect(() => resolveString('{{date:abc}}', base)).toThrow('Unknown placeholder');
    expect(() => resolveString('{{today}}', base)).toThrow('Unknown placeholder');
    expect(() => resolveString('{{date:1.5}}', base)).toThrow('Unknown placeholder');
  });
  test('TEST_DATE is used when valid and rejected when not', () => {
    const saved = process.env.TEST_DATE;
    try {
      process.env.TEST_DATE = '2026-10-05';
      expect(runDate()).toBe('2026-10-05');
      process.env.TEST_DATE = '2026-02-30';
      expect(() => runDate()).toThrow('TEST_DATE');
      process.env.TEST_DATE = 'yesterday';
      expect(() => runDate()).toThrow('TEST_DATE');
    } finally {
      if (saved === undefined) delete process.env.TEST_DATE;
      else process.env.TEST_DATE = saved;
    }
  });
});
