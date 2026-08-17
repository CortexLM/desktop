import { defineConfig } from 'vitest/config';

/**
 * The package's own tests live under `src/**\/__tests__`. Before this config
 * existed the package declared `"test": "bun test"`, so its suite ran under a
 * different runner than the rest of the repo — and the root `vitest run` never
 * saw it at all.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'benchmarks/**'],
    testTimeout: 10000,
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
        '**/tests/**',
        'benchmarks/**'
      ]
    }
  }
});
