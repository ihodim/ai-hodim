import { describe, expect, it } from 'vitest';
import { mapsUrl, parseLatLng, telHref, upcomingSince } from './venues';

describe('parseLatLng', () => {
  it('reads the "lat, lng" text Google Maps copies', () => {
    expect(parseLatLng('42.01160, 23.09500')).toEqual({ lat: 42.0116, lng: 23.095 });
    expect(parseLatLng('  42.0116 23.095 ')).toEqual({ lat: 42.0116, lng: 23.095 });
    expect(parseLatLng('-33.9,-70.6')).toEqual({ lat: -33.9, lng: -70.6 });
  });
  it('rejects out-of-range, swapped-looking or partial input', () => {
    expect(parseLatLng('90.01, 23')).toBeNull();
    expect(parseLatLng('42, 180.5')).toBeNull();
    expect(parseLatLng('42.0116')).toBeNull();
    expect(parseLatLng('')).toBeNull();
    expect(parseLatLng('42,0116, 23,095')).toBeNull();
  });
});

describe('telHref', () => {
  it('keeps digits and a leading plus only', () => {
    expect(telHref('+359 888 000-001')).toBe('tel:+359888000001');
    expect(telHref('(073) 88 12 34')).toBe('tel:073881234');
  });
  it('returns null when there is no number to call', () => {
    expect(telHref('')).toBeNull();
    expect(telHref(' - ')).toBeNull();
  });
});

describe('mapsUrl', () => {
  it('points the phone maps app at the coordinates', () => {
    expect(mapsUrl(42.0116, 23.095)).toBe('https://www.google.com/maps/search/?api=1&query=42.0116%2C23.095');
  });
});

describe('upcomingSince', () => {
  it('keeps tonight’s events for 6 hours after they start', () => {
    expect(upcomingSince(new Date('2026-12-05T23:00:00Z'))).toBe('2026-12-05T17:00:00.000Z');
  });
});
