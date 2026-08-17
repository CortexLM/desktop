import { defineConfig } from 'vitest/config';

/**
 * `test-utils` is a helper library with no suite of its own today. The config
 * exists so the package is a first-class member of the root `projects` glob:
 * when a test file is added here it runs automatically, instead of being
 * silently invisible to CI.
 *
 * `passWithNoTests` is true for this package only — an empty helper library is
 * expected, unlike an application package where zero tests means something
 * broke.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    passWithNoTests: true
  }
});
