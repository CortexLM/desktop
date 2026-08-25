import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'cortex-api',
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
      ],

      // MEASURED 2026-08-25 (4 test files / 63 tests):
      //   statements 95.45% (210/220)     branches 89.14% (115/129)
      //   functions  89.28% (50/56)        lines    95.91% (188/196)
      //
      // Gates sit ~1 point under each measured value: the margin absorbs drift in the
      // measurement itself, not a regression. Ratchet rule — when coverage rises, raise
      // these; never lower them without replacing the measurement above and dating it.
      thresholds: {
        lines: 94,
        functions: 88,
        branches: 88,
        statements: 94
      }
    },
    passWithNoTests: false,
  },
});
