import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],

      // Keep the report on a red run. CI runs this config directly
      // (`bun run --filter preload test:coverage`) and then uploads
      // `coverage/coverage-final.json`; without this the file is deleted as
      // soon as a test fails, so the upload on a failed run has nothing to
      // find. Mirrors the root config.
      reportOnFailure: true,

      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__tests__/**',
        '**/tests/**'
      ],
      // MEASURED 2026-08-17 01:19 UTC, full denominator (1 product file):
      //   statements 100%  branches 100%  functions 100%  lines 100%
      // RE-MEASURED 2026-08-17 06:07 UTC (4 test files / 241 tests): still
      // 100% on all four (statements 111/111, branches 20/20, functions
      // 69/69, lines 103/103). Already at the ceiling; nothing to ratchet.
      //
      // Raised from 80/80/75/80. This package is fully covered and is the
      // security boundary between renderer and main, so the gate is set at the
      // measured value: any uncovered line added here should fail immediately
      // rather than be absorbed by 20 points of slack.
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    },
    // `tests/` is included as well as `src/`: a suite placed outside `src/`
    // would otherwise be silently skipped.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    // The package has four suites now (allowlist, exposed surface, event
    // listeners, façade routing), so this is false: with it true, deleting or
    // mis-globbing every test file here would report green with zero tests —
    // and this package is the security boundary between the renderer and main.
    // That is the silent-skip failure mode the discovery guard exists to catch,
    // asserted from inside the config as well as outside it.
    passWithNoTests: false
  }
});
