// complete-signup: creates profiles + profile_private for the signed-in user. Contract: docs/CONTRACTS.md "Phase 1".
// verify_jwt is off (config.toml / --no-verify-jwt): the platform check only understands legacy JWT keys, so this
// function authorizes the caller itself with auth.getUser(). The secret key never leaves this function.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { todayUtc } from '../_shared/age.ts';
import { validateSignupInput } from '../_shared/signup.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Secret key: new named keys first, then the local single key, then the legacy service_role key. */
function secretKey(): string | null {
  const named = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (named) {
    try {
      const key = JSON.parse(named)?.default;
      if (typeof key === 'string' && key) return key;
    } catch {
      // fall through to the other variables
    }
  }
  return Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false });

  const url = Deno.env.get('SUPABASE_URL');
  const key = secretKey();
  if (!url || !key) {
    console.error('complete-signup: SUPABASE_URL or a secret key is missing');
    return json(500, { ok: false });
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // 1. Who is calling? (401 without a valid user JWT; the body is not looked at.)
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return json(401, { ok: false });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json(401, { ok: false });

  // 2. Already a member? Checked before the age rule so a member can't get their account deleted by resubmitting.
  const existing = await admin.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (existing.error) {
    console.error('complete-signup: profile lookup failed', existing.error.code);
    return json(500, { ok: false });
  }
  if (existing.data) return json(409, { ok: false, code: 'already_completed' });

  // 3. Validate. Only username and date_of_birth are read; anything else (e.g. is_admin) is ignored.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const result = validateSignupInput(body, todayUtc());
  if (!result.ok) {
    if (result.code === 'under_18') {
      // Q6: keep nothing about under-18s. Delete the auth user before answering.
      const del = await admin.auth.admin.deleteUser(user.id);
      if (del.error) {
        console.error('complete-signup: deleting under-18 user failed', del.error.message);
        return json(500, { ok: false });
      }
      return json(403, { ok: false, code: 'under_18' });
    }
    return json(400, { ok: false, code: result.code });
  }

  // 4. Create both rows in one transaction.
  const { error } = await admin.rpc('create_signup_rows', {
    p_user_id: user.id,
    p_username: result.username,
    p_dob: result.dateOfBirth,
  });
  if (error) {
    if (error.code === '23505') {
      const raceOnOwnRow = /profiles_pkey|profile_private_pkey/.test(error.message);
      return json(409, { ok: false, code: raceOnOwnRow ? 'already_completed' : 'username_taken' });
    }
    console.error('complete-signup: insert failed', error.code);
    return json(500, { ok: false });
  }
  return json(200, { ok: true });
});
