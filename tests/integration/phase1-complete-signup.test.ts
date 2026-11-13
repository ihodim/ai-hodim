// FROZEN SPEC FILE. Phase 1: Edge Function complete-signup. See docs/CONTRACTS.md.
import { afterAll, describe, expect, it } from 'vitest';
import { admin, callFunction, createAuthUser, deleteAuthUser, randomName, utcDateShift } from './_support/helpers';

const created: string[] = [];
async function newUser() {
  const u = await createAuthUser();
  created.push(u.id);
  return u;
}
afterAll(async () => {
  for (const id of created) await deleteAuthUser(id);
});

describe('complete-signup', () => {
  it('creates the profile for an adult', async () => {
    const u = await newUser();
    const username = randomName('u');
    const r = await callFunction('complete-signup', u.token, { username, date_of_birth: '2000-01-01' });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
    const p = await admin.from('profiles').select('username, is_admin').eq('id', u.id).single();
    expect(p.data?.username).toBe(username);
    expect(p.data?.is_admin).toBe(false);
    const pp = await admin.from('profile_private').select('date_of_birth').eq('user_id', u.id).single();
    expect(pp.data?.date_of_birth).toBe('2000-01-01');
  }, 30_000);

  it('accepts someone who turns 18 today (UTC)', async () => {
    const u = await newUser();
    const r = await callFunction('complete-signup', u.token, {
      username: randomName('u'),
      date_of_birth: utcDateShift(-18),
    });
    expect(r.status).toBe(200);
  }, 30_000);

  it('rejects someone one day short of 18 and deletes the auth user (Q6)', async () => {
    const u = await newUser();
    const r = await callFunction('complete-signup', u.token, {
      username: randomName('u'),
      date_of_birth: utcDateShift(-18, 1),
    });
    expect(r.status).toBe(403);
    expect(r.json).toEqual({ ok: false, code: 'under_18' });
    const p = await admin.from('profiles').select('id').eq('id', u.id);
    expect(p.data ?? []).toHaveLength(0);
    const still = await admin.auth.admin.getUserById(u.id);
    expect(still.data?.user ?? null).toBeNull();
  }, 30_000);

  it('rejects a username that is taken in another letter case', async () => {
    const first = await newUser();
    const username = randomName('u');
    expect((await callFunction('complete-signup', first.token, { username, date_of_birth: '2000-01-01' })).status).toBe(200);
    const second = await newUser();
    const r = await callFunction('complete-signup', second.token, {
      username: username.toUpperCase(),
      date_of_birth: '2000-01-01',
    });
    expect(r.status).toBe(409);
    expect(r.json).toEqual({ ok: false, code: 'username_taken' });
  }, 30_000);

  it.each(['ab', '1abc', 'иван', 'has space'])('rejects the invalid username %s', async (username: string) => {
    const u = await newUser();
    const r = await callFunction('complete-signup', u.token, { username, date_of_birth: '2000-01-01' });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ ok: false, code: 'invalid_username' });
  }, 30_000);

  it.each(['2000-13-01', '2001-02-29', 'yesterday', ''])('rejects the invalid date %s', async (dob: string) => {
    const u = await newUser();
    const r = await callFunction('complete-signup', u.token, { username: randomName('u'), date_of_birth: dob });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ ok: false, code: 'invalid_date' });
  }, 30_000);

  it('refuses to run twice for the same user', async () => {
    const u = await newUser();
    expect(
      (await callFunction('complete-signup', u.token, { username: randomName('u'), date_of_birth: '2000-01-01' })).status,
    ).toBe(200);
    const r = await callFunction('complete-signup', u.token, { username: randomName('u'), date_of_birth: '1999-01-01' });
    expect(r.status).toBe(409);
    expect(r.json).toEqual({ ok: false, code: 'already_completed' });
  }, 30_000);

  it('requires a signed-in user', async () => {
    const r = await callFunction('complete-signup', null, { username: randomName('u'), date_of_birth: '2000-01-01' });
    expect(r.status).toBe(401);
  }, 30_000);

  it('cannot be used to make yourself admin', async () => {
    const u = await newUser();
    const r = await callFunction('complete-signup', u.token, {
      username: randomName('u'),
      date_of_birth: '2000-01-01',
      is_admin: true,
    });
    expect(r.status).toBe(200);
    const p = await admin.from('profiles').select('is_admin').eq('id', u.id).single();
    expect(p.data?.is_admin).toBe(false);
  }, 30_000);
});
