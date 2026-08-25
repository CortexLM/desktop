import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tokens',
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],

      // Keep the report on a red run. CI runs this config directly
      // (`bun run --filter <pkg> test:coverage`) and then uploads
      // `coverage/coverage-final.json`; without this the file is deleted as soon as a
      // test fails, so a failed run publishes no coverage at all.
      reportOnFailure: true,

      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__tests__/**',
        'src/**/*.generated.ts',
      ],

      // MEASURED 2026-08-25 (3 test files / 53 tests):
      //   statements 100% (16/16)         branches 100% (2/2)
      //   functions  100% (2/2)           lines    100% (16/16)
      //
      // Gates sit ~1 point under each measured value: the margin absorbs drift in the
      // measurement itself, not a regression. Ratchet rule — when coverage rises, raise
      // these; never lower them without replacing the measurement above and dating it.
      // Set at the measured ceiling. This package is almost entirely declarations; the two
      // functions it does have are the contrast helpers the suite drives directly, so any
      // uncovered line added here should fail immediately rather than be absorbed by slack.
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    },
    passWithNoTests: false,
  },
});
