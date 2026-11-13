// FROZEN SPEC FILE. Phase 5: Edge Function verify-checkin. See docs/CONTRACTS.md (check order matters).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BLAGOEVGRAD,
  admin,
  callFunction,
  checkinForm,
  createAuthUser,
  createMember,
  createVenue,
  deleteAuthUser,
  fixtureBytes,
  windowAroundNow,
} from './_support/helpers';

const photo = fixtureBytes('checkin.jpg');
const notAnImage = fixtureBytes('not-an-image.jpg');
const users: string[] = [];
const venues: string[] = [];
let alice: Awaited<ReturnType<typeof createMember>>;
let open: ReturnType<typeof windowAroundNow>;
let venueA: string; // successful check-in, then duplicate
let venueB: string; // too far / low accuracy
let venueC: string; // bad image
let venueClosed: string; // outside window

beforeAll(async () => {
  alice = await createMember();
  users.push(alice.id);
  open = windowAroundNow(-60, 60);
  const closed = windowAroundNow(120, 180);
  venueA = await createVenue({ start: open.start, end: open.end });
  venueB = await createVenue({ start: open.start, end: open.end });
  venueC = await createVenue({ start: open.start, end: open.end });
  venueClosed = await createVenue({ start: closed.start, end: closed.end });
  venues.push(venueA, venueB, venueC, venueClosed);
}, 60_000);

afterAll(async () => {
  const { data } = await admin.from('checkins').select('id, user_id').in('venue_id', venues);
  if (data?.length) {
    await admin.storage.from('checkin-photos').remove(data.map((c: { id: string; user_id: string }) => `${c.user_id}/${c.id}.jpg`));
    await admin.from('checkins').delete().in('venue_id', venues);
  }
  await admin.from('venues').delete().in('id', venues);
  for (const id of users) await deleteAuthUser(id);
}, 60_000);

const at = (venueId: string, over: Partial<{ lat: number; lng: number; accuracyM: number; photo: Uint8Array }> = {}) =>
  checkinForm({ venueId, lat: BLAGOEVGRAD.lat, lng: BLAGOEVGRAD.lng, accuracyM: 10, photo, ...over });

describe('verify-checkin', () => {
  it('accepts a check-in at the venue, inside the window, and stores row + photo', async () => {
    const r = await callFunction('verify-checkin', alice.token, at(venueA, { lat: BLAGOEVGRAD.lat + 0.0002 }));
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    expect(r.json.night_date).toBe(open.expectedNight);
    const row = await admin.from('checkins').select('*').eq('id', r.json.checkin_id).single();
    expect(row.data?.user_id).toBe(alice.id);
    expect(row.data?.venue_id).toBe(venueA);
    expect(row.data?.night_date).toBe(open.expectedNight);
    expect(row.data?.accuracy_m).toBe(10);
    expect(row.data?.distance_m).toBeGreaterThanOrEqual(20);
    expect(row.data?.distance_m).toBeLessThanOrEqual(25);
    expect(row.data?.photo_path).toBe(`${alice.id}/${r.json.checkin_id}.jpg`);
    const files = await admin.storage.from('checkin-photos').list(alice.id);
    expect((files.data ?? []).map((f: { name: string }) => f.name)).toContain(`${r.json.checkin_id}.jpg`);
  }, 30_000);

  it('refuses a second check-in at the same venue on the same night (Q15)', async () => {
    const r = await callFunction('verify-checkin', alice.token, at(venueA));
    expect(r.status).toBe(409);
    expect(r.json).toMatchObject({ ok: false, code: 'already_checked_in' });
  }, 30_000);

  it('refuses a check-in about 1.1 km away', async () => {
    const r = await callFunction('verify-checkin', alice.token, at(venueB, { lat: BLAGOEVGRAD.lat + 0.01 }));
    expect(r.status).toBe(422);
    expect(r.json).toMatchObject({ ok: false, code: 'too_far' });
  }, 30_000);

  it('refuses an inaccurate GPS fix even at the venue (Q13)', async () => {
    const r = await callFunction('verify-checkin', alice.token, at(venueB, { accuracyM: 250 }));
    expect(r.status).toBe(422);
    expect(r.json).toMatchObject({ ok: false, code: 'low_accuracy' });
  }, 30_000);

  it('refuses a check-in outside the venue window', async () => {
    const r = await callFunction('verify-checkin', alice.token, at(venueClosed));
    expect(r.status).toBe(422);
    expect(r.json).toMatchObject({ ok: false, code: 'outside_window' });
  }, 30_000);

  it('refuses a photo that is not a JPEG', async () => {
    const r = await callFunction('verify-checkin', alice.token, at(venueC, { photo: notAnImage }));
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ ok: false, code: 'bad_image' });
  }, 30_000);

  it('returns venue_not_found for an unknown venue', async () => {
    const r = await callFunction('verify-checkin', alice.token, at('00000000-0000-0000-0000-00000000dead'));
    expect(r.status).toBe(404);
    expect(r.json).toMatchObject({ ok: false, code: 'venue_not_found' });
  }, 30_000);

  it('stored nothing for the refused attempts', async () => {
    const { data } = await admin.from('checkins').select('venue_id').eq('user_id', alice.id);
    expect((data ?? []).map((c: { venue_id: string }) => c.venue_id)).toEqual([venueA]);
  }, 30_000);

  it('refuses a signed-in user without a profile', async () => {
    const ghost = await createAuthUser();
    users.push(ghost.id);
    const r = await callFunction('verify-checkin', ghost.token, at(venueC));
    expect(r.status).toBe(403);
    expect(r.json).toMatchObject({ ok: false, code: 'not_member' });
  }, 30_000);

  it('requires a signed-in user', async () => {
    const r = await callFunction('verify-checkin', null, at(venueC));
    expect(r.status).toBe(401);
  }, 30_000);

  it('a client cannot bypass the function by writing to the table or bucket', async () => {
    const ins = await alice.client.from('checkins').insert({
      user_id: alice.id,
      venue_id: venueC,
      night_date: open.expectedNight,
      distance_m: 0,
      accuracy_m: 1,
      photo_path: 'x',
    });
    expect(ins.error).not.toBeNull();
    const up = await alice.client.storage
      .from('checkin-photos')
      .upload(`${alice.id}/forged.jpg`, new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }));
    expect(up.error).not.toBeNull();
  }, 30_000);
});
