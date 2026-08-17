import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest project for the repo-root `tests/` suites.
 *
 * These eight files (integration, performance, visual-regression) were the last
 * blind spot after the runner consolidation: the root config's `projects` glob
 * only matched `packages/*​/vitest.config.ts`, so nothing claimed them and
 * `vitest run` never loaded them. They were reachable only through the removed
 * `bun test` scripts — exactly the silent-skip failure mode
 * `scripts/check-test-discovery.ts` exists to catch, which is why the guard-rail
 * now walks the whole repo instead of just `packages/`.
 *
 * `test.root` is pinned to the repo root rather than left to default to this
 * directory, for two reasons: `include` globs resolve against it (a Vite-level
 * `root` is ignored for project test globs), and
 * `tests/visual-regression/visual-regression.test.ts` builds its
 * baseline/current/diff paths from `process.cwd()` + `tests/visual-regression`,
 * which only resolves when the worker cwd is the repo root.
 *
 * Playwright owns `tests/e2e`, `tests/visual` and `tests/accessibility` — they
 * use `@playwright/test`, cannot link under vitest, and run in the `test:e2e`
 * job. They are excluded here and declared as other-runner territory in the
 * guard-rail, so they are accounted for rather than merely missing.
 */
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('..', import.meta.url)),
    name: 'root-tests',
    globals: true,
    environment: 'node',
    include: [
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
      'tests/performance/**/*.{test,spec}.{ts,tsx}',
      'tests/visual-regression/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'tests/e2e/**',
      'tests/visual/**',
      'tests/accessibility/**',
    ],
    // The perf suites time real loops; the bench harness sets its own per-test
    // timeout, this is the floor for the integration suites.
    testTimeout: 30000,
  },
});
