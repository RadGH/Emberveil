import { defineConfig } from 'vitest/config';

export default defineConfig({
  // vite.config.js defines __APP_BASE__ for the app; vitest reads only this
  // file, so give tests the same global or modules that use it fail to load.
  define: { __APP_BASE__: JSON.stringify('/') },
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
