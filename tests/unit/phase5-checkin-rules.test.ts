// FROZEN SPEC FILE. Phase 5. Pure check-in rules shared by the Edge Function and the app (Q13).
import { describe, expect, it } from 'vitest';
import {
  MAX_ACCURACY_M,
  evaluateLocation,
  haversineMeters,
  pickBestFix,
} from '../../supabase/functions/_shared/checkin-rules';

describe('haversineMeters', () => {
  it('is 0 for the same point', () => {
    expect(haversineMeters({ lat: 42.0116, lng: 23.095 }, { lat: 42.0116, lng: 23.095 })).toBe(0);
  });
  it('0.001 degrees of latitude is about 111.2 m', () => {
    const d = haversineMeters({ lat: 42.0116, lng: 23.095 }, { lat: 42.0126, lng: 23.095 });
    expect(d).toBeGreaterThan(110.7);
    expect(d).toBeLessThan(111.7);
  });
  it('Sofia centre to Blagoevgrad centre is about 77.5 km', () => {
    const d = haversineMeters({ lat: 42.6977, lng: 23.3219 }, { lat: 42.0209, lng: 23.0943 });
    expect(d).toBeGreaterThan(77_000);
    expect(d).toBeLessThan(77_800);
  });
  it('is symmetric', () => {
    const a = { lat: 42.0116, lng: 23.095 };
    const b = { lat: 42.02, lng: 23.1 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe('evaluateLocation', () => {
  it('MAX_ACCURACY_M is 100', () => {
    expect(MAX_ACCURACY_M).toBe(100);
  });
  it('accepts a close, accurate fix', () => {
    expect(evaluateLocation({ distanceM: 50, accuracyM: 20, radiusM: 100 })).toBe('ok');
  });
  it('is inclusive at the limits', () => {
    expect(evaluateLocation({ distanceM: 100, accuracyM: 100, radiusM: 100 })).toBe('ok');
  });
  it('rejects a fix just outside the radius', () => {
    expect(evaluateLocation({ distanceM: 100.5, accuracyM: 20, radiusM: 100 })).toBe('too_far');
  });
  it('rejects inaccurate fixes even at distance 0', () => {
    expect(evaluateLocation({ distanceM: 0, accuracyM: 100.5, radiusM: 100 })).toBe('low_accuracy');
  });
  it('checks accuracy before distance', () => {
    expect(evaluateLocation({ distanceM: 5000, accuracyM: 500, radiusM: 100 })).toBe('low_accuracy');
  });
  it('uses the venue radius, not a fixed 100 m', () => {
    expect(evaluateLocation({ distanceM: 140, accuracyM: 10, radiusM: 150 })).toBe('ok');
    expect(evaluateLocation({ distanceM: 60, accuracyM: 10, radiusM: 50 })).toBe('too_far');
  });
});

describe('pickBestFix', () => {
  it('returns null for no fixes', () => {
    expect(pickBestFix([])).toBeNull();
  });
  it('returns the most accurate fix', () => {
    const best = { lat: 2, lng: 2, accuracyM: 8 };
    expect(pickBestFix([{ lat: 1, lng: 1, accuracyM: 40 }, best, { lat: 3, lng: 3, accuracyM: 15 }])).toEqual(best);
  });
  it('returns the first one on a tie', () => {
    const first = { lat: 1, lng: 1, accuracyM: 10 };
    expect(pickBestFix([first, { lat: 2, lng: 2, accuracyM: 10 }])).toEqual(first);
  });
});
