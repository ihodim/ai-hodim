import { describe, expect, it } from 'vitest';
import { eventDate, eventStartsAt, mapsUrl, parseLocation, telHref, upcomingSince } from './venues';

const here = { lat: 42.0116, lng: 23.095 };

describe('parseLocation', () => {
  it('reads plain "lat, lng" as copied from the Google Maps app', () => {
    expect(parseLocation('42.01160, 23.09500')).toEqual({ ...here, approximate: false });
    expect(parseLocation('  42.0116 23.095 ')).toEqual({ ...here, approximate: false });
  });
  it('accepts Bulgarian decimal commas', () => {
    expect(parseLocation('42,0116, 23,095')).toEqual({ ...here, approximate: false });
    expect(parseLocation('42,0116,23,095')).toEqual({ ...here, approximate: false });
  });
  it('prefers the place pin (!3d!4d) over the map centre (@) in a full link', () => {
    const url =
      'https://www.google.com/maps/place/Club/@42.0200,23.0800,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d42.0116!4d23.095!16s';
    expect(parseLocation(url)).toEqual({ ...here, approximate: false });
  });
  it('falls back to the map centre and marks it approximate', () => {
    expect(parseLocation('https://www.google.com/maps/@42.0116,23.095,17z')).toEqual({
      ...here,
      approximate: true,
    });
  });
  it('reads q= / query= coordinates as an exact pin', () => {
    expect(parseLocation('https://maps.google.com/?q=42.0116,23.095')).toEqual({
      ...here,
      approximate: false,
    });
    expect(parseLocation('https://www.google.com/maps/search/?api=1&query=42.0116%2C23.095')).toEqual({
      ...here,
      approximate: false,
    });
  });
  it('explains short share links instead of guessing', () => {
    expect(parseLocation('https://maps.app.goo.gl/AbC123xyz')).toEqual({ error: 'short_link' });
    expect(parseLocation('https://goo.gl/maps/AbC123')).toEqual({ error: 'short_link' });
  });
  it('blocks places outside Blagoevgrad, including swapped lat/lng', () => {
    expect(parseLocation('23.095, 42.0116')).toEqual({ error: 'far' });
    expect(parseLocation('42.6977, 23.3219')).toEqual({ error: 'far' }); // Sofia
    expect(parseLocation('42.1, 23.1')).toEqual({ lat: 42.1, lng: 23.1, approximate: false }); // ~9 km out
  });
  it('rejects text that has no coordinates', () => {
    expect(parseLocation('')).toEqual({ error: 'invalid' });
    expect(parseLocation('42.0116')).toEqual({ error: 'invalid' });
    expect(parseLocation('ул. Тест 1, Благоевград')).toEqual({ error: 'invalid' });
    expect(parseLocation('https://www.google.com/maps/place/Club')).toEqual({ error: 'invalid' });
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

describe('event dates', () => {
  it('stores a date as 22:00 Sofia time that night', () => {
    expect(eventStartsAt('2026-12-05')).toBe('2026-12-05T20:00:00.000Z');
    expect(eventStartsAt('2026-07-10')).toBe('2026-07-10T19:00:00.000Z');
  });
  it('reads the Sofia date back for the edit form', () => {
    expect(eventDate('2026-12-05T20:00:00+00:00')).toBe('2026-12-05');
    expect(eventDate('2026-12-05T23:30:00Z')).toBe('2026-12-06'); // 01:30 Sofia
  });
  it('rejects a missing or invalid date', () => {
    expect(eventStartsAt('')).toBeNull();
    expect(eventStartsAt('2026-02-30')).toBeNull();
  });
});
