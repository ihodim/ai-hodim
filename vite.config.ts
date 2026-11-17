import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  // The throwaway /spike page (phone camera + GPS test) is built only for `vite dev` and for
  // Cloudflare Pages preview builds. Production and any build without Cloudflare's variables
  // (local or CI `npm run build`) leave it out entirely.
  const spike =
    mode === 'development' || (process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH !== 'main');

  return {
    plugins: [react()],
    define: {
      __SPIKE__: JSON.stringify(spike),
    },
  };
});
