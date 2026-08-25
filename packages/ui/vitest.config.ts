import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

/**
 * `vite-plugin-solid` has to run with `ssr: false` under the test transform, otherwise
 * components compile to the server renderer and never produce DOM nodes for
 * @solidjs/testing-library to query.
 *
 * jsdom rather than happy-dom: the geometry tests read back `getComputedStyle` for
 * dimensions asserted against the Paper spec, and happy-dom's cascade is not faithful
 * enough for that to mean anything.
 */
export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    name: 'ui',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
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

      // MEASURED 2026-08-25 (5 test files / 184 tests):
      //   statements 98.85% (520/526)     branches 87.73% (186/212)
      //   functions  98.47% (259/263)     lines    100% (351/351)
      //
      // Gates sit ~1 point under each measured value: the margin absorbs drift in the
      // measurement itself, not a regression. Ratchet rule — when coverage rises, raise
      // these; never lower them without replacing the measurement above and dating it.
      // The icon geometry is generated data — a map of path strings with no branches, so
      // instrumenting it only inflates the denominator.
      thresholds: {
        lines: 99,
        functions: 97,
        branches: 86,
        statements: 97
      }
    },
    passWithNoTests: false,
  },
});
