import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Venues and events. RLS is the authority: members read, admins write. This module only shapes data for the UI.

type Client = SupabaseClient<Database>;
type Tables = Database['public']['Tables'];
export type Venue = Tables['venues']['Row'];
export type VenueEvent = Tables['events']['Row'];
export type VenueInput = Omit<Tables['venues']['Insert'], 'id' | 'created_by' | 'created_at'>;
export type EventInput = Omit<Tables['events']['Insert'], 'id' | 'created_by' | 'created_at'>;

/** An event stays "upcoming" this long after it starts, so a 22:00 party is still listed at midnight. */
const UPCOMING_GRACE_HOURS = 6;

export function upcomingSince(now = new Date()): string {
  return new Date(now.getTime() - UPCOMING_GRACE_HOURS * 3600_000).toISOString();
}

/** Opens the phone's maps app at the venue (Q22: no embedded map). */
export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return /\d/.test(digits) ? `tel:${digits}` : null;
}

/** Launch city. A venue further than MAX_KM from here is almost certainly a bad paste or swapped lat/lng. */
const CITY = { lat: 42.0209, lng: 23.0943 };
const MAX_KM = 15;

/** GPS fixes worse than this get a warning: check-in later uses a ~100 m radius. */
export const GPS_WARN_M = 50;

export type ParsedLocation =
  { lat: number; lng: number; approximate: boolean } | { error: 'invalid' | 'short_link' | 'far' };

const NUM = String.raw`(-?\d{1,3}[.,]\d+)`;
/** [pattern, approximate], in order of preference. */
const LOCATION_PATTERNS: [RegExp, boolean][] = [
  [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, false],
  [/[?&](?:q|query|ll)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i, false],
  [/@(-?\d+\.\d+),(-?\d+\.\d+)/, true],
  [new RegExp(String.raw`^${NUM}[\s,;]+${NUM}$`), false],
];

/** Reads a venue location from what an admin pastes: "lat, lng" (dot or Bulgarian decimal comma) or a full
 *  Google Maps link. A link's !3d!4d is the place's pin; its @lat,lng is only the map centre (approximate). */
export function parseLocation(text: string): ParsedLocation {
  const t = text.trim();
  // Short share links hold no coordinates and resolve in client-side JS, so they can't be read here.
  if (/^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(t)) return { error: 'short_link' };

  for (const [pattern, approximate] of LOCATION_PATTERNS) {
    const m = pattern.exec(t);
    if (!m) continue;
    const lat = Number(m[1]?.replace(',', '.'));
    const lng = Number(m[2]?.replace(',', '.'));
    return distanceKm({ lat, lng }, CITY) <= MAX_KM ? { lat, lng, approximate } : { error: 'far' };
  }
  return { error: 'invalid' };
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// ---- data access --------------------------------------------------------------------------------------------------

export async function listVenues(client: Client): Promise<Pick<Venue, 'id' | 'name' | 'address'>[]> {
  const { data, error } = await client.from('venues').select('id, name, address').order('name');
  if (error) throw error;
  return data;
}

/** The venue with its upcoming events in date order, or null if it doesn't exist (or isn't visible). */
export async function getVenue(
  client: Client,
  id: string,
): Promise<(Venue & { events: VenueEvent[] }) | null> {
  // A malformed id (e.g. /venues/new for a non-admin) is "not found", not a 400 from Postgres.
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return null;
  const { data, error } = await client
    .from('venues')
    .select('*, events(*)')
    .eq('id', id)
    .gte('events.starts_at', upcomingSince())
    .order('starts_at', { referencedTable: 'events' })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEvent(client: Client, id: string): Promise<VenueEvent | null> {
  const { data, error } = await client.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates (id null) or updates a venue. Returns its id. */
export async function saveVenue(client: Client, id: string | null, input: VenueInput): Promise<string> {
  const query = id ? client.from('venues').update(input).eq('id', id) : client.from('venues').insert(input);
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  return data.id;
}

export async function saveEvent(client: Client, id: string | null, input: EventInput): Promise<string> {
  const query = id ? client.from('events').update(input).eq('id', id) : client.from('events').insert(input);
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  return data.id;
}
