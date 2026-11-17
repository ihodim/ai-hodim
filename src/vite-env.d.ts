/// <reference types="vite/client" />

// The only env vars the frontend may read. Never add the service-role key here.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build-time flag from vite.config.ts: true in `vite dev` and in Workers Builds preview builds only.
declare const __SPIKE__: boolean;
