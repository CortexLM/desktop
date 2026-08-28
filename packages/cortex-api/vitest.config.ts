import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'cortex-api',
    globals: true,
    environment: 'node',
    env: {
      CORTEX_ALLOW_TEST_DOUBLES: '1',
    },
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
      //
      // RE-MEASURED 2026-08-25 after adding the API-key routes:
      //   statements 90.29% (214/237)   branches 83.45% (116/139)
      //   functions  81.96% (50/61)     lines    91.42% (192/210)
      //
      // Slightly down because those three methods cannot be exercised: reaching them
      // needs a session only a human approving a device flow produces. Their request
      // path is verified against the live service instead (it answers
      // `Authentication required`), which is as far as it can honestly be taken.
      thresholds: {
        lines: 90,
        functions: 81,
        branches: 82,
        statements: 89
      }
    },
    passWithNoTests: false,
  },
});
