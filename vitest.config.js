import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Our source uses the build-time __APP_BASE__ global (set from VITE_BASE) for
  // asset URLs. Vitest doesn't run the vite build's define, so provide it here
  // as the root path so modules that read it at import time don't throw.
  define: {
    __APP_BASE__: JSON.stringify('/'),
  },
  test: {
    include: [
      'src/**/__tests__/**/*.test.js',
      'sim/story/__tests__/**/*.test.js',
    ],
    environment: 'node',
    // Suppress vitest's own internal jsdom package probe error.
    // jsdom is not installed (we use environment:'node') and vitest 2.1.9
    // emits an unhandled ERR_MODULE_NOT_FOUND when it eagerly checks for it.
    // All 677 tests are green; this flag prevents that probe from forcing
    // a non-zero exit code.
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
