// Shared by the browser (src/lib/age.ts) and the complete-signup Edge Function.
// Must agree with the DB CHECK: date_of_birth <= current_date - interval '18 years'.

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

/** Strict YYYY-MM-DD parse. Rejects impossible dates such as 2008-02-30 or 2008-13-01. */
export function parseIsoDate(s: string): Ymd | null {
  if (typeof s !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function compare(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

/**
 * True when someone born on `dob` is at least 18 on `today` (both YYYY-MM-DD).
 * Matches Postgres `today - interval '18 years'`: subtracting years from 29 Feb lands on 28 Feb when the
 * target year isn't a leap year, so a 29 Feb birthday turns 18 on 1 March in non-leap years.
 * Returns false for invalid input instead of throwing.
 */
export function isAtLeast18(dob: string, today: string): boolean {
  const birth = parseIsoDate(dob);
  const now = parseIsoDate(today);
  if (!birth || !now) return false;
  const y = now.y - 18;
  const cutoff: Ymd = { y, m: now.m, d: Math.min(now.d, daysInMonth(y, now.m)) };
  return compare(birth, cutoff) <= 0;
}

/** Today's date in UTC as YYYY-MM-DD (Q6: age is checked against UTC, like the DB). */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
