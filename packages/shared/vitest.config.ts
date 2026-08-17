import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Keep the report on a red run; the default deletes it, and CI uploads
      // this package's coverage-final.json after running this config.
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
      // MEASURED 2026-08-17 01:19 UTC, full denominator (30 files instrumented,
      // all of them):
      //   statements 100%  branches 100%  functions 100%  lines 100%
      // RE-MEASURED 2026-08-17 06:07 UTC (6 test files / 328 tests): still
      // 100% on all four (statements 138/138, branches 42/42, functions
      // 16/16, lines 132/132). Already at the ceiling; nothing to ratchet.
      //
      // Read this number with its denominator in mind: 10 of the 30 files are
      // type-only (`src/types/**`) and contribute 0 statements, so 100% is over
      // 138 statements / 132 lines of actual runtime code — small, but real, and
      // every instrumented file is present. Raised from 80/80/75/80 to hold the
      // measured value; a new uncovered branch here should fail rather than fit
      // inside unused slack.
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
    // The package now has a suite (schemas, logger, cross-package contracts),
    // so `passWithNoTests` is false: with it true, deleting or mis-globbing
    // every test file here would report green with zero tests — the same
    // silent-skip failure the discovery guard exists to catch, but from inside
    // the config rather than outside it.
    passWithNoTests: false
  }
});
