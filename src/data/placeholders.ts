/**
 * data/placeholders.ts
 * What it does: replaces {{date:N}} in test data with a real date.
 *   {{date:0}} today, {{date:-1}} yesterday, {{date:2}} two days from today. N is a whole number of days.
 * Input:  any JSON value from a test data row.
 * Output: the same value with every placeholder replaced (a new copy; the input is not changed).
 *
 * The date is UTC and is frozen for the whole run: playwright.config.ts sets TEST_DATE once at start,
 * so a run that crosses midnight still uses one date everywhere. You can set TEST_DATE yourself
 * (format 2026-10-05) to repeat a run for a past day.
 * Anything that looks like a placeholder but is not valid stops with a message (never silently left as text).
 */

const DATE_PLACEHOLDER = /\{\{\s*date:\s*(-?\d+)\s*\}\}/g;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today in UTC as YYYY-MM-DD. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The run date: TEST_DATE if set (and valid), otherwise today in UTC. */
export function runDate(): string {
  const raw = process.env.TEST_DATE;
  if (!raw) return todayUtc();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(raw) && new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) === raw;
  if (!valid) throw new Error(`TEST_DATE must be a real date written as YYYY-MM-DD (for example 2026-10-05), but it is "${raw}".`);
  return raw;
}

function shiftDate(base: string, days: number): string {
  return new Date(new Date(`${base}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Replaces placeholders in one string. */
export function resolveString(text: string, base: string = runDate()): string {
  const replaced = text.replace(DATE_PLACEHOLDER, (_all, n: string) => shiftDate(base, Number(n)));
  if (replaced.includes('{{') || replaced.includes('}}')) {
    throw new Error(`Unknown placeholder in "${text}". The only supported form is {{date:N}}, for example {{date:0}} or {{date:-1}}.`);
  }
  return replaced;
}

/** Replaces placeholders in every string of a JSON value. */
export function resolvePlaceholders<T>(value: T, base: string = runDate()): T {
  if (typeof value === 'string') return resolveString(value, base) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => resolvePlaceholders(v, base)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolvePlaceholders(v, base);
    return out as T;
  }
  return value;
}
