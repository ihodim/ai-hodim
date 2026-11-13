// FROZEN SPEC FILE. Connection settings for the local Supabase stack.
// scripts/run-spec.mjs fills these from `supabase status -o env`. Never point them at production.
function pick(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(
    `Missing ${names.join(' / ')}. Run integration specs with: npm run test:spec -- --integration ` +
      '(local Supabase must be running: supabase start, plus supabase functions serve).',
  );
}

export const SUPABASE_URL = pick('SUPABASE_URL', 'API_URL');
export const ANON_KEY = pick('SUPABASE_ANON_KEY', 'ANON_KEY', 'PUBLISHABLE_KEY');
export const SERVICE_ROLE_KEY = pick('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY', 'SECRET_KEY');

if (!/^https?:\/\/(127\.0\.0\.1|localhost|host\.docker\.internal)(:\d+)?/.test(SUPABASE_URL)) {
  throw new Error(`Refusing to run integration specs against a non-local Supabase: ${SUPABASE_URL}`);
}
