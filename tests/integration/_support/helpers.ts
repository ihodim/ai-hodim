// FROZEN SPEC FILE. Helpers for the Edge Function integration specs.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from './env';

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Service-role client: bypasses RLS. Used only to set up fixtures and to inspect results. */
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, noSession);

export function randomName(prefix = 'u'): string {
  return prefix + Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, 'x');
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  client: SupabaseClient;
}

/** Creates a confirmed auth user and signs in. No profile yet. */
export async function createAuthUser(): Promise<TestUser> {
  const email = `${randomName('spec')}@spec.ihodim.test`;
  const password = `Spec-${randomName('p')}-9!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`createUser failed: ${created.error?.message}`);
  const anon = createClient(SUPABASE_URL, ANON_KEY, noSession);
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error(`sign-in failed: ${signedIn.error?.message}`);
  const token = signedIn.data.session.access_token;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { id: created.data.user.id, email, password, token, client };
}

/** Creates an auth user plus profile rows directly (fixture shortcut, does not use complete-signup). */
export async function createMember(): Promise<TestUser & { username: string }> {
  const user = await createAuthUser();
  const username = randomName('m');
  const p = await admin.from('profiles').insert({ id: user.id, username });
  if (p.error) throw new Error(`profile fixture failed: ${p.error.message}`);
  const pp = await admin.from('profile_private').insert({ user_id: user.id, date_of_birth: '2000-01-01' });
  if (pp.error) throw new Error(`profile_private fixture failed: ${pp.error.message}`);
  return { ...user, username };
}

export async function deleteAuthUser(id: string): Promise<void> {
  await admin.auth.admin.deleteUser(id);
}

export async function callFunction(
  name: string,
  token: string | null,
  body?: Record<string, unknown> | FormData,
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { apikey: ANON_KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: 'POST', headers, body: payload });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

export function fixtureBytes(file: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`../../fixtures/${file}`, import.meta.url))));
}

/** Today's date in UTC as YYYY-MM-DD, shifted by whole years and days. Clamps 29 Feb like Postgres. */
export function utcDateShift(years: number, days = 0): string {
  const now = new Date();
  let y = now.getUTCFullYear() + years;
  const m = now.getUTCMonth();
  let d = now.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  if (d > last) d = last;
  const t = new Date(Date.UTC(y, m, d) + days * 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** Current Sofia wall-clock time as minutes since midnight, plus the Sofia date (YYYY-MM-DD). */
export function sofiaNow(): { minutes: number; date: string; yesterday: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Sofia',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const y = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - 86_400_000).toISOString().slice(0, 10);
  return { minutes: +parts.hour * 60 + +parts.minute, date, yesterday: y };
}

export function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * A check-in window around "now" in Sofia: [now + startOffset, now + endOffset).
 * Returns the window strings and the night_date the server must assign if "now" is inside it.
 */
export function windowAroundNow(startOffsetMin: number, endOffsetMin: number) {
  const now = sofiaNow();
  const start = ((now.minutes + startOffsetMin) % 1440 + 1440) % 1440;
  const end = ((now.minutes + endOffsetMin) % 1440 + 1440) % 1440;
  const crossesMidnight = start > end;
  const expectedNight = crossesMidnight && now.minutes < end ? now.yesterday : now.date;
  return { start: hhmm(start), end: hhmm(end), expectedNight };
}

export const BLAGOEVGRAD = { lat: 42.0116, lng: 23.095 };

export async function createVenue(opts: { start: string; end: string; radius?: number }): Promise<string> {
  const { data, error } = await admin
    .from('venues')
    .insert({
      name: randomName('Venue '),
      address: 'spec address',
      lat: BLAGOEVGRAD.lat,
      lng: BLAGOEVGRAD.lng,
      phone: '+359000000000',
      checkin_radius_m: opts.radius ?? 100,
      checkin_window_start: opts.start,
      checkin_window_end: opts.end,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`venue fixture failed: ${error?.message}`);
  return data.id as string;
}

export function checkinForm(fields: {
  venueId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  photo: Uint8Array;
}): FormData {
  const form = new FormData();
  form.append('venue_id', fields.venueId);
  form.append('lat', String(fields.lat));
  form.append('lng', String(fields.lng));
  form.append('accuracy_m', String(fields.accuracyM));
  form.append('photo', new Blob([new Uint8Array(fields.photo)], { type: 'image/jpeg' }), 'checkin.jpg');
  return form;
}
