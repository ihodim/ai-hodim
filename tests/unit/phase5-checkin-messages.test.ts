// FROZEN SPEC FILE. Phase 5. Every check-in error code has a Bulgarian message.
import { describe, expect, it } from 'vitest';
import { CHECKIN_ERROR_CODES } from '../../src/lib/error-codes';
import { bg } from '../../src/i18n/bg';

const CODES = [
  'already_checked_in',
  'bad_image',
  'low_accuracy',
  'not_member',
  'outside_window',
  'rate_limited',
  'too_far',
  'venue_not_found',
];

describe('check-in error codes', () => {
  it('are exactly the codes in docs/CONTRACTS.md', () => {
    expect([...CHECKIN_ERROR_CODES].sort()).toEqual([...CODES].sort());
  });
  it.each(CODES)('%s has a Bulgarian message', (code) => {
    const msg = (bg.errors as Record<string, string>)[code];
    expect(typeof msg).toBe('string');
    expect(msg.trim().length).toBeGreaterThan(0);
    expect(msg).toMatch(/[Ѐ-ӿ]/);
  });
});
