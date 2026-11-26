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

/** Reads "42.0116, 23.0950" (what Google Maps copies) or "42.0116 23.0950". Null if invalid or out of range. */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*|\s+)(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
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
