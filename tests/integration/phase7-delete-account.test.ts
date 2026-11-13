// FROZEN SPEC FILE. Phase 7: Edge Function delete-account. See docs/CONTRACTS.md.
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { ANON_KEY, SUPABASE_URL } from './_support/env';
import { BLAGOEVGRAD, admin, callFunction, createMember, fixtureBytes, randomName } from './_support/helpers';

let venueId: string | null = null;
afterAll(async () => {
  if (venueId) {
    await admin.from('checkins').delete().eq('venue_id', venueId);
    await admin.from('venues').delete().eq('id', venueId);
  }
}, 60_000);

describe('delete-account', () => {
  it('removes the user, their rows and their photos', async () => {
    const bob = await createMember();
    const v = await admin
      .from('venues')
      .insert({ name: randomName('Venue '), address: 'x', lat: BLAGOEVGRAD.lat, lng: BLAGOEVGRAD.lng, phone: '1' })
      .select('id')
      .single();
    venueId = v.data!.id;
    const c = await admin
      .from('checkins')
      .insert({
        user_id: bob.id,
        venue_id: venueId,
        night_date: '2026-01-02',
        distance_m: 5,
        accuracy_m: 5,
        photo_path: 'pending',
      })
      .select('id')
      .single();
    const path = `${bob.id}/${c.data!.id}.jpg`;
    const up = await admin.storage
      .from('checkin-photos')
      .upload(path, new Blob([new Uint8Array(fixtureBytes('checkin.jpg'))], { type: 'image/jpeg' }));
    expect(up.error).toBeNull();

    const r = await callFunction('delete-account', bob.token);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });

    const user = await admin.auth.admin.getUserById(bob.id);
    expect(user.data?.user ?? null).toBeNull();
    expect((await admin.from('profiles').select('id').eq('id', bob.id)).data ?? []).toHaveLength(0);
    expect((await admin.from('checkins').select('id').eq('user_id', bob.id)).data ?? []).toHaveLength(0);
    const files = await admin.storage.from('checkin-photos').list(bob.id);
    expect(files.data ?? []).toHaveLength(0);

    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const again = await anon.auth.signInWithPassword({ email: bob.email, password: bob.password });
    expect(again.error).not.toBeNull();
  }, 60_000);

  it('requires a signed-in user', async () => {
    const r = await callFunction('delete-account', null);
    expect(r.status).toBe(401);
  }, 30_000);
});
