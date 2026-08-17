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
        '**/*.config.*',
        '**/__tests__/**',
        '**/tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',

        // Type-only: no runtime export, so it can only ever read 0%.
        '**/*.d.ts',
        'src/database/types.ts',

        // Standalone demo / manual-verification scripts. Each does real work at
        // module scope (`main()`, console output, SQLite writes under
        // `homedir()`), so instrumenting them means running that on every
        // coverage pass.
        '**/examples/**',
        'src/test-db.ts',
        'src/database/test-db.ts',
        'src/database/example.ts'
      ],
      // MEASURED 2026-08-17 06:07 UTC, this config standalone
      // (`cd packages/main && bunx vitest run --coverage`,
      // 31 test files / 1066 tests):
      //   statements 71.73% (2211/3082)  branches 62.23% (758/1218)
      //   functions  72.55% (563/776)    lines    72.13% (2118/2936)
      //
      // Previous reading (2026-08-17 01:23 UTC): statements 70.19%,
      // branches 60.44%, functions 71.26%, lines 70.55%. Part of that ~1.5
      // point rise is the `terminal-history.ts` deletion (210 lines of dead
      // code leaving the denominator), not new tests.
      //
      // Was 85/85/80/85, which this package has never met. Set just under
      // measured, as a ratchet. (Before the demo-script exclusions the same run
      // read 66.01% statements: those files are ~200 uncovered lines of
      // module-scope scripts that no test should be executing.)
      thresholds: {
        lines: 71,
        functions: 71,
        branches: 61,
        statements: 70
      }
    },
    // `tests/` is included as well as `src/`: a suite placed outside `src/`
    // would otherwise be silently skipped.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    // Registers the global `electron` mock. `electron`'s npm entry exports a
    // path string, so `import { ipcMain } from 'electron'` cannot link outside a
    // real Electron runtime — the mock has to be in the registry before any test
    // module links.
    setupFiles: ['../../test/vitest-setup-main.ts']
  }
});
