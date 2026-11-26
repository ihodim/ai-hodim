import { describe, expect, it } from 'vitest';
import { fromSofiaInput, toSofiaInput } from './sofia-time';

describe('fromSofiaInput (datetime-local in Sofia -> UTC ISO)', () => {
  it('winter time is UTC+2', () => {
    expect(fromSofiaInput('2026-12-05T23:00')).toBe('2026-12-05T21:00:00.000Z');
  });
  it('summer time is UTC+3', () => {
    expect(fromSofiaInput('2026-07-10T22:30')).toBe('2026-07-10T19:30:00.000Z');
  });
  it('crosses midnight into the previous UTC day', () => {
    expect(fromSofiaInput('2026-12-06T01:00')).toBe('2026-12-05T23:00:00.000Z');
  });
  it('a time skipped by the spring change moves forward an hour', () => {
    // 2026-03-29 03:00 -> 04:00 local; 03:30 does not exist.
    expect(fromSofiaInput('2026-03-29T03:30')).toBe('2026-03-29T01:30:00.000Z');
  });
  it('a time repeated by the autumn change picks one fixed instant', () => {
    // 2026-10-25 04:00 -> 03:00 local; 03:30 happens twice (00:30Z and 01:30Z).
    expect(fromSofiaInput('2026-10-25T03:30')).toBe('2026-10-25T01:30:00.000Z');
  });
  it('rejects invalid input', () => {
    expect(fromSofiaInput('')).toBeNull();
    expect(fromSofiaInput('2026-13-01T10:00')).toBeNull();
    expect(fromSofiaInput('tomorrow')).toBeNull();
  });
});

describe('toSofiaInput (UTC ISO -> datetime-local in Sofia)', () => {
  it('formats winter and summer times', () => {
    expect(toSofiaInput('2026-12-05T21:00:00Z')).toBe('2026-12-05T23:00');
    expect(toSofiaInput('2026-07-10T19:30:00+00:00')).toBe('2026-07-10T22:30');
  });
  it('round-trips with fromSofiaInput', () => {
    for (const local of ['2026-01-01T00:00', '2026-06-15T23:59', '2026-10-25T05:00']) {
      expect(toSofiaInput(fromSofiaInput(local) ?? '')).toBe(local);
    }
  });
});
