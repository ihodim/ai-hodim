// FROZEN SPEC FILE. Phase 1. Every signup error code has a Bulgarian message.
import { describe, expect, it } from 'vitest';
import { SIGNUP_ERROR_CODES } from '../../src/lib/error-codes';
import { bg } from '../../src/i18n/bg';

const CYRILLIC = /[Ѐ-ӿ]/;

describe('signup error codes', () => {
  it('are exactly the codes in docs/CONTRACTS.md', () => {
    expect([...SIGNUP_ERROR_CODES].sort()).toEqual(
      ['already_completed', 'invalid_date', 'invalid_username', 'under_18', 'username_taken'].sort(),
    );
  });
  it.each(['already_completed', 'invalid_date', 'invalid_username', 'under_18', 'username_taken'])(
    '%s has a Bulgarian message',
    (code) => {
      const msg = (bg.errors as Record<string, string>)[code];
      expect(typeof msg).toBe('string');
      expect(msg.trim().length).toBeGreaterThan(0);
      expect(msg).toMatch(CYRILLIC);
    },
  );
});
