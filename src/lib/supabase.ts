import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Browser client. Reads ONLY the two public env vars (anon/publishable key, protected by RLS).
// The service-role key never belongs in frontend code: it bypasses RLS.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}

/** null until .env is filled in, so a fresh clone still starts with `npm run dev`. */
export const supabase: SupabaseClient<Database> | null =
  url && anonKey ? createClient<Database>(url, anonKey) : null;
