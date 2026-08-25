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
    passWithNoTests: false,
  },
});
