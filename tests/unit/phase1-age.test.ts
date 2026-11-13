// FROZEN SPEC FILE. Phase 1. Must agree with the DB rule: date_of_birth <= current_date - interval '18 years'.
import { describe, expect, it } from 'vitest';
import { isAtLeast18 } from '../../src/lib/age';

describe('isAtLeast18(dob, today)', () => {
  it('accepts someone who turns 18 today', () => {
    expect(isAtLeast18('2008-11-13', '2026-11-13')).toBe(true);
  });
  it('rejects someone who turns 18 tomorrow', () => {
    expect(isAtLeast18('2008-11-14', '2026-11-13')).toBe(false);
  });
  it('accepts a clearly adult birth date', () => {
    expect(isAtLeast18('1990-05-05', '2026-11-13')).toBe(true);
  });
  it('rejects a birth date in the future', () => {
    expect(isAtLeast18('2026-11-14', '2026-11-13')).toBe(false);
  });
  it('treats a 29 February birthday like Postgres: still 17 on 28 February', () => {
    expect(isAtLeast18('2008-02-29', '2026-02-28')).toBe(false);
  });
  it('treats a 29 February birthday like Postgres: 18 on 1 March', () => {
    expect(isAtLeast18('2008-02-29', '2026-03-01')).toBe(true);
  });
  it('handles the start of the year', () => {
    expect(isAtLeast18('2008-01-01', '2026-01-01')).toBe(true);
    expect(isAtLeast18('2008-01-02', '2026-01-01')).toBe(false);
  });
  it('returns false for invalid input instead of throwing', () => {
    expect(isAtLeast18('not-a-date', '2026-11-13')).toBe(false);
    expect(isAtLeast18('2008-13-01', '2026-11-13')).toBe(false);
    expect(isAtLeast18('2008-02-30', '2026-11-13')).toBe(false);
    expect(isAtLeast18('', '2026-11-13')).toBe(false);
  });
});
