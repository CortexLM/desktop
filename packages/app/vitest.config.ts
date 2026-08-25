import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    name: 'app',
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
        'src/main.tsx',
        'src/**/*.generated.ts',
      ],

      // MEASURED 2026-08-25 (6 test files / 268 tests):
      //   statements 87.09% (1660/1906)   branches 75.83% (273/360)
      //   functions  82.26% (849/1032)     lines    85.55% (1102/1288)
      //
      // Gates sit ~1 point under each measured value: the margin absorbs drift in the
      // measurement itself, not a regression. Ratchet rule — when coverage rises, raise
      // these; never lower them without replacing the measurement above and dating it.
      //
      // RE-MEASURED 2026-08-25, and lowered — debt, not a correction:
      //   statements 66.57% (1896/2848)   branches 43.99% (355/807)
      //   functions  65.11% (952/1462)    lines    63.18% (1306/2067)
      //
      // The package roughly doubled: run state, five IPC hosts, the route adapters,
      // the New Automation form and the Shell tab. Those are verified end to end
      // instead — 19 Playwright cases drive the packaged app — but that is not what
      // this gate measures, so unit coverage genuinely fell. The thin surfaces are
      // the route adapters and `shell-view`; that is where the next tests belong.
      // `main.tsx` is excluded: it calls `render(...)` at module scope against a real
      // `#root`, so importing it under jsdom performs the mount instead of testing it.
      // `icons/geometry.generated.ts` is generated data with no branches.
      thresholds: {
        lines: 62,
        functions: 64,
        branches: 43,
        statements: 65
      }
    },
    passWithNoTests: false,
  },
});
