// FROZEN SPEC FILE. Phase 1. Same rule as the DB CHECK: ^[A-Za-z][A-Za-z0-9_.]{2,19}$ (Q3).
import { describe, expect, it } from 'vitest';
import { isValidUsername } from '../../src/lib/username';

describe('isValidUsername', () => {
  it.each(['ivan', 'Ivan_99', 'maria.p', 'abc', 'a'.repeat(20), 'Ivan.P_99'])('accepts %s', (name) => {
    expect(isValidUsername(name)).toBe(true);
  });
  it.each([
    ['ab', 'too short'],
    ['a'.repeat(21), 'too long'],
    ['1ivan', 'starts with a digit'],
    ['_ivan', 'starts with an underscore'],
    ['.ivan', 'starts with a dot'],
    ['iv an', 'contains a space'],
    ['иван', 'Cyrillic'],
    ['ivan!', 'punctuation'],
    ['ivan-p', 'hyphen'],
    ['', 'empty'],
  ])('rejects %s (%s)', (name) => {
    expect(isValidUsername(name)).toBe(false);
  });
});
