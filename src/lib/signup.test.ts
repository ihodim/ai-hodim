// Our own tests (not the frozen spec): the shared validation the Edge Function and the form both use.
import { describe, expect, it } from 'vitest';
import { validateSignupInput } from '../../supabase/functions/_shared/signup.ts';
import { isAtLeast18, todayUtc } from './age';

const TODAY = '2026-11-19';

describe('validateSignupInput', () => {
  it('accepts a valid adult and returns only the two contract fields', () => {
    expect(
      validateSignupInput({ username: 'Ivan.P_99', date_of_birth: '2000-01-01', is_admin: true }, TODAY),
    ).toEqual({ ok: true, username: 'Ivan.P_99', dateOfBirth: '2000-01-01' });
  });

  it('checks the username before the date', () => {
    expect(validateSignupInput({ username: 'ab', date_of_birth: 'nope' }, TODAY)).toEqual({
      ok: false,
      code: 'invalid_username',
    });
  });

  it('reports a bad date format before age', () => {
    expect(validateSignupInput({ username: 'ivan', date_of_birth: '2026-02-30' }, TODAY)).toEqual({
      ok: false,
      code: 'invalid_date',
    });
  });

  it('rejects under-18 only once the date is valid', () => {
    expect(validateSignupInput({ username: 'ivan', date_of_birth: '2008-11-20' }, TODAY)).toEqual({
      ok: false,
      code: 'under_18',
    });
  });

  it.each([null, undefined, 'text', 42, [], {}])(
    'treats a non-object or empty body (%s) as invalid',
    (body) => {
      expect(validateSignupInput(body, TODAY)).toEqual({ ok: false, code: 'invalid_username' });
    },
  );

  it('rejects non-string fields', () => {
    expect(validateSignupInput({ username: 123, date_of_birth: '2000-01-01' }, TODAY).ok).toBe(false);
    expect(validateSignupInput({ username: 'ivan', date_of_birth: 20000101 }, TODAY)).toEqual({
      ok: false,
      code: 'invalid_date',
    });
  });
});

describe('isAtLeast18 extra cases', () => {
  it('handles 29 Feb on either side', () => {
    expect(isAtLeast18('2012-02-29', '2030-02-28')).toBe(false);
    expect(isAtLeast18('2012-02-29', '2030-03-01')).toBe(true);
    expect(isAtLeast18('2014-02-28', '2032-02-28')).toBe(true);
    expect(isAtLeast18('2014-03-01', '2032-02-29')).toBe(false);
  });

  it('crosses the year boundary', () => {
    expect(isAtLeast18('2008-12-31', '2026-12-31')).toBe(true);
    expect(isAtLeast18('2009-01-01', '2026-12-31')).toBe(false);
  });

  it('todayUtc uses the UTC date, not local time', () => {
    expect(todayUtc(new Date('2026-11-19T23:30:00-02:00'))).toBe('2026-11-20');
  });
});
