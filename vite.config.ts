import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  // The throwaway /spike page (phone camera + GPS test) is built only for `vite dev` and for
  // Cloudflare Workers Builds preview builds (any branch except main). Production and any build
  // without Workers Builds' variables (local or CI `npm run build`) leave it out entirely.
  const spike =
    mode === 'development' || (process.env.WORKERS_CI === '1' && process.env.WORKERS_CI_BRANCH !== 'main');

  return {
    plugins: [react()],
    define: {
      __SPIKE__: JSON.stringify(spike),
    },
  };
});
