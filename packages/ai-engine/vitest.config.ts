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
      // This was `['src/simple-agent-manager.ts', 'src/orchestration/**/*.ts']`
      // — two paths out of a 64-file package — with `src/providers/**`,
      // `src/registry.ts`, `src/model-presets.ts` and `src/index.ts` excluded on
      // top. Only 11 files reached the report, so the 80% gate below was scored
      // against 11/64 files while CI published it as this package's coverage.
      // routing/, prompts/, tokens/, context-tools/ and model-selection/ were
      // invisible to it. Widened to the whole package: a subsystem must not be
      // able to leave the denominator by being named in a list here.
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.*',

        // Test files.
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.spec.ts',

        // Type-only: no runtime export, compiles to empty JS, can only read 0%.
        '**/*.d.ts',
        'src/model-selection/types.ts',

        // Demo scripts that run work at module scope.
        '**/examples/**',
      ],
      // MEASURED 2026-08-17 01:20 UTC over the full 57-file denominator:
      //   statements 90.50%  branches 85.75%  functions 91.59%  lines 91.48%
      //
      // RE-MEASURED 2026-08-17 06:07 UTC (`cd packages/ai-engine && bunx
      // vitest run --coverage`, 44 test files / 855 tests): identical to four
      // decimal places — statements 90.50% (2737/3024), branches 85.75%
      // (1662/1938), functions 91.59% (512/559), lines 91.48% (2547/2784).
      // The dead-code deletions that moved the renderer and main numbers were
      // all outside this package, so its denominator did not change. These
      // gates are already at the ratchet level; left as-is.
      //
      // Set just under measured, as a ratchet. Raise when coverage rises; do
      // not lower without re-measuring and dating it here.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 89,
      },
    },
    // Stated explicitly rather than left to vitest's default. Suites live in
    // both `src/**/__tests__` and the top-level `tests/`, and an implicit
    // default is exactly how a whole directory goes missing unnoticed.
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
  },
});
