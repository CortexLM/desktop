import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config — runs the unit suites of every workspace package.
 *
 * Previously this file declared `include: ['src/**', '__tests__/**']`, resolved
 * against the repo root. There is no `src/` at the root, so `vitest run` matched
 * zero files and exited 1 with "No test files found" while 70+ test files sat
 * under `packages/`. `projects` delegates to each package's own config instead,
 * so package-level `environment` (jsdom for renderer, node elsewhere) and
 * `setupFiles` still apply.
 *
 * Adding a package: create `packages/<name>/vitest.config.ts` and it is picked
 * up automatically by the glob below. `scripts/check-test-discovery.ts` fails
 * the build if a test file on disk is not claimed by any project.
 *
 * `tests/vitest.config.ts` is listed explicitly: the repo-root `tests/`
 * directory is not under `packages/`, so the glob above never matched it and its
 * integration / performance / visual-regression suites went unloaded by
 * `vitest run` while still sitting on disk.
 */
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'tests/vitest.config.ts'],

    // A suite that throws while loading (bad import, missing module) must fail
    // the run, never be reported as a pass with zero tests.
    passWithNoTests: false,
    dangerouslyIgnoreUnhandledErrors: false,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // Write the report even when a test fails. The default is `false`, which
      // *deletes* the report on a red run — so the one run whose coverage you
      // most need to see (is the regression a test failure, or did a whole file
      // stop being exercised?) is the one that produces no number at all. It
      // also means a coverage regression can hide behind an unrelated broken
      // test: no report, no comparison, no signal.
      //
      // Set here rather than passed as `--coverage.reportOnFailure` on the
      // command line: a flag only helps the person who remembers to type it,
      // and CI / `bun run test:coverage` do not.
      reportOnFailure: true,

      // WHY TWO GLOB FORMS: `coverage.include` is globbed once per "root", and
      // the root set depends on how vitest was invoked (see
      // CoverageProvider#getUntestedFiles / `this.roots`):
      //
      //   `vitest run --coverage`                  -> roots = [repo root]
      //   `vitest run --coverage --project <name>` -> roots = [each project root]
      //
      // The glob is passed to tinyglobby as `cwd: root`, so a pattern only
      // matches when it is relative to the root actually in play. A
      // root-relative `packages/*/src/**` matches nothing from
      // `cwd=packages/app`, and a project-relative `src/**` matches
      // nothing from the repo root (there is no `src/` there). Listing both
      // means whichever root is in play, one pattern matches — and the other is
      // simply inert rather than wrong. `test:unit` uses `--project`, so both
      // paths are live in this repo.
      //
      // Matching is substring-based (`picomatch { contains: true }`), so the
      // project-relative form cannot accidentally widen the set beyond `src/`.
      include: ['packages/*/src/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],

      exclude: [
        'node_modules/**',
        'dist/**',

        // Type-only modules. Verified to contain zero runtime exports (no
        // `export const/function/class`), so they compile to empty JS: there is
        // nothing to execute and they can only ever read as 0%, diluting the
        // denominator with lines that no test could cover.
        '**/*.d.ts',
        'packages/ai-engine/src/model-selection/types.ts',
        'packages/main/src/database/types.ts',

        '**/*.config.*',

        // Test files themselves.
        '**/__tests__/**',
        '**/tests/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',

        // Standalone demo / manual-verification scripts. Each runs work at
        // module scope (`main()`, `console.log`, real DB writes under
        // `homedir()`), so instrumenting them means either executing that on
        // every coverage run or carrying permanent 0% rows for code that ships
        // to nobody.
        '**/examples/**',
        'packages/main/src/test-db.ts',
        'packages/main/src/database/test-db.ts',
        'packages/main/src/database/example.ts',

        // DOM bootstrap entry point: `render(...)` at module scope against a real
        // `#root`. Importing it under jsdom executes the mount rather than
        // testing anything.
        'packages/app/src/main.tsx',

        // Test scaffolding, not product code. Measuring the coverage of the
        // helpers that do the covering says nothing about the product; these
        // packages are exercised through the suites that use them. This
        // exclusion predates the `include` fix — it is kept, and it is now
        // load-bearing, because `packages/*/src/**` above would otherwise pull
        // all 34 of their files into the denominator.
        'packages/test-utils/**',
        'packages/test-harness/**',
        'test/**'
      ],
      // THRESHOLDS ARE A RATCHET, NOT A TARGET.
      //
      // These were 80/80/75/80 and they were not honest numbers. Until the
      // `include` above was added, `coverage.include` was unset and `all: true`
      // was relied on to widen the denominator — an option that no longer
      // exists in Vitest 4 (absent from `coverageConfigDefaults`, unreferenced
      // by the v8 provider). Without `include`, the provider skips
      // `getUntestedFilesByRoot` entirely, so a file no test imports was not
      // reported at 0%: it was *absent*. 56 product files were missing from the
      // denominator, and the 80% gate was scored against the remainder.
      //
      // MEASURED 2026-08-17 06:04 UTC, full denominator (131 test files /
      // 3801 tests, `bun run test:coverage`, two consecutive identical reads
      // at 06:03 and 06:04):
      //
      //   statements 74.03% (8030/10846)   branches 69.71% (4136/5933)
      //   functions  69.20% (1989/2874)    lines    74.57% (7513/10074)
      //
      // RE-READ 2026-08-17 08:25 UTC (134 test files / 3865 tests), while
      // another suite was being written in parallel:
      //
      //   statements 74.42% (8259/11097)   branches 70.19% (4288/6109)
      //   functions  69.50% (2022/2909)    lines    75.02% (7717/10286)
      //
      // Note the denominator *grew* between the two reads (10846 -> 11097
      // statements) while the percentage also rose: that is new covered product
      // code, i.e. real testing, unlike the mechanical rise described below.
      // The gates are left at the 06:04 basis; they simply have more headroom.
      //
      // Previous reading (2026-08-17 01:22 UTC) was statements 71.40%
      // (8020/11231), lines 71.90% (7503/10435).
      //
      // THIS RISE IS MECHANICAL, NOT A TESTING IMPROVEMENT. Compare the
      // denominators: 11231 -> 10846 statements, 10435 -> 10074 lines. The
      // numerators barely moved (8020 -> 8030 covered statements, 7503 ->
      // 7513 covered lines: +10 each). ~1795 lines of dead code were deleted
      // — 4 `renderer/src/components/background/` components (1585 lines),
      // `terminal-history.ts` (210 lines), and 111 lines of fabricated data
      // under `views/account/` — several of which sat at exactly 0%. Removing
      // uncovered code from the denominator raises the percentage without a
      // single test being added. Roughly 10 covered statements' worth of
      // actual new testing is in this delta; the other ~2.6 points are
      // subtraction. Do not cite this movement as evidence that the suite got
      // better.
      //
      // The ratchet is still justified on its own terms: the floor should sit
      // at the real current level so a genuine regression trips it. It is not
      // evidence of progress.
      //
      // For contrast, the same command before the `include` fix reported
      // statements 80.16% over 237 files. The number went *down* 8.8 points
      // because 41 more product files entered the denominator — the 80% figure
      // was the old gate passing against a partial measurement.
      //
      // Per package, measured standalone (`cd packages/<p> && bunx vitest run
      // --coverage`) at 06:07 UTC, which is how CI enforces the per-package
      // gates in .github/workflows/test-suite.yml:
      //   ai-engine  statements 90.50%  lines 91.48%  funcs 91.59%  branches 85.75%
      //   main       statements 71.73%  lines 72.13%  funcs 72.55%  branches 62.23%
      //   preload    100% on all four
      //   shared     100% on all four
      //   renderer   statements 61.67%  lines 61.92%  funcs 56.74%  branches 60.22%
      //
      // Note the per-package numbers differ from this file's merged run: the
      // merged lcov attributes cross-package imports differently (main 72.47%
      // merged vs 72.13% standalone). Set each package's gate from its own
      // standalone run, not from the merged report.
      //
      // ---------------------------------------------------------------------
      // SUPERSEDED 2026-08-25: `packages/renderer` was deleted
      // ---------------------------------------------------------------------
      // Every measurement above includes the retired React renderer, which was
      // the whole shortfall at ~62%. Deleting it removes ~19 MB of source and
      // 42 test files from both sides of the ratio.
      //
      // This is the mechanical rise the note above warns about, in its largest
      // form yet: the merged percentage goes UP because the least-covered
      // package left the denominator, not because anything was tested. The
      // gates below are re-measured on the current tree for exactly that
      // reason — leaving them at the old basis would mean the floor sits far
      // below the real level and a genuine regression would not trip it.
      //
      // The gate is set ~1 point under each measured value. Not to make a run
      // pass: it already passes at the measured value. The margin absorbs
      // drift in the measurement itself while other work lands — over ~20
      // minutes on 2026-08-17 the same command read 70.76%, then 71.40%, then
      // 72.32% statements (3772 -> 3777 -> 3806 tests) as another suite was
      // being written. A gate pinned exactly to one reading would fail on that
      // movement rather than on a regression.
      //
      // Consequently these numbers are a floor, not a description: actual
      // coverage at the time of reading is likely higher. Re-measure before
      // quoting them.
      //
      // Ratchet rule: when coverage rises, raise these. Never lower them
      // without replacing the measurement above and dating it. An 80% gate that
      // can never go green gets ignored, then deleted — which is how the
      // denominator came to be unmeasured in the first place.
      //
      // `thresholds.autoUpdate` is deliberately NOT used: it rewrites this
      // config file on every run, which in CI yields either a dirty tree or a
      // threshold change nobody reviewed.
      thresholds: {
        lines: 73,
        functions: 68,
        branches: 68,
        statements: 73
      },
      clean: true
    }
  }
});
