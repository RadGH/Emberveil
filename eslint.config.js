// ESLint v9 flat config — Emberveil (game13)
//
// Pragmatic ruleset for a large vanilla-JS + Vite + canvas codebase.
// Goal: catch real JS error classes (undefined vars, unreachable code,
// genuine bugs) without drowning in legacy-style noise. Errors are a
// release gate (see release.sh); warnings are tolerated.
//
// NOT maximalist by design — a 5000-error config is useless here.

import js from '@eslint/js';
import globals from 'globals';

export default [
  // ---- Ignores ---------------------------------------------------------
  {
    ignores: [
      'dist/**',
      'public/**',
      'node_modules/**',
      '.vite/**',
      'test-results/**',
      'e2e/**',
      'scripts/**/*-legacy-snapshot.json',
      'scripts/__pycache__/**',
      '**/*.min.js',
      'index.html.pre-design-bak',
      // Generated / data files
      'scripts/regression-thresholds.json',
    ],
  },

  // ---- Browser source (src/) ------------------------------------------
  {
    files: ['src/**/*.js'],
    languageOptions: {
      // 'latest' so the parser accepts import attributes
      // (`import x from '...' with { type: 'json' }`) used by
      // src/game/dataLoader.js — a real, Vite/Node-22-supported syntax,
      // not a bug.
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2023,
        // Vite build-time define() replacements (vite.config.js):
        __SUPABASE_URL__: 'readonly',
        __SUPABASE_PUBLISHABLE_KEY__: 'readonly',
        // dataLoader.js is isomorphic (browser + Node parity scripts) and
        // typeof-guards `process` — legitimate, not a bug.
        process: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Real-bug guards (errors — these gate the release):
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-func-assign': 'error',
      'no-self-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-cond-assign': ['error', 'except-parens'],
      'no-fallthrough': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      // Noisy-but-not-bugs → warn so the gate stays unblocked:
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'eqeqeq': ['warn', 'smart'],
      'no-console': 'off',
    },
  },

  // ---- Node tooling (sim/, scripts/, *.config.js, root tooling) -------
  {
    files: [
      'sim/**/*.js',
      'scripts/**/*.{js,cjs,mjs}',
      '*.config.js',
      'vite.config.js',
      'vitest.config.js',
      'playwright.config.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-fallthrough': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      // Intentional parser idioms in data-extraction scripts
      // (`(re.match() || [,0])[1]` default-tuple, multi-space regexes,
      // escaped `/` in paths) — noisy, not bugs:
      'no-sparse-arrays': 'warn',
      'no-regex-spaces': 'warn',
      'no-useless-escape': 'warn',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'eqeqeq': 'off',
      'no-console': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },

  // ---- CommonJS scripts (.cjs) override sourceType -------------------
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },

  // ---- Vitest test files --------------------------------------------
  {
    files: ['src/**/__tests__/**/*.js', 'src/**/*.test.js', 'test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
];
