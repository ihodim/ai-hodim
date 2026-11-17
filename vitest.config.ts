import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __SPIKE__: 'false',
  },
  test: {
    // Frozen specs (tests/) and our own tests next to the code (src/). Never exclude anything under tests/:
    // scripts/run-spec.mjs fails if a spec file doesn't run.
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
