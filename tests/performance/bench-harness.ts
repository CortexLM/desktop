/**
 * `bench` shim over the standard test runner.
 *
 * Vitest does have a real `bench` (`vitest bench`), but benchmarks declared with
 * it are *skipped* by `vitest run` — they only execute in bench mode, which
 * would drop these files out of the normal suite while still leaving them on
 * disk looking covered. This shim instead runs each benchmark body a fixed
 * number of times inside an ordinary test, reports the per-iteration timing, and
 * asserts it stays under a budget — so the code is exercised by `vitest run`
 * and an obvious regression fails the suite.
 *
 * ---------------------------------------------------------------------------
 * Emitting results to disk
 * ---------------------------------------------------------------------------
 * Timings are also written to `tests/performance/results/<file>.json` in an
 * `afterAll` hook. That file is what `check-budgets.ts` scores. Before this,
 * `check-budgets.ts` scored a hardcoded `mockResults` array and therefore
 * reported the same verdict no matter what the run measured — a gate that
 * validated nothing.
 *
 * The write happens in `afterAll` rather than at process exit so that it also
 * runs when a benchmark FAILS its own `maxMeanMs` assertion: a regression must
 * still produce results, otherwise the budget checker would read a stale file
 * from a previous green run and pass.
 *
 * Each test file gets its own JSON file because vitest isolates modules per
 * file — `benchResults` in one worker cannot see another's.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, expect, test } from 'vitest';

/** `tests/performance/results/`, resolved from this file, not from `cwd`. */
const RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');

export interface BenchOptions {
  /** Iterations to time (after warmup). Default 50. */
  iterations?: number;
  /** Untimed warmup iterations. Default 5. */
  warmup?: number;
  /** Fail if the mean iteration exceeds this many ms. Default 50. */
  maxMeanMs?: number;
  /** Per-test timeout in ms. Default 30_000. */
  timeout?: number;
  /**
   * Budget key from `performance-budgets.ts`.
   *
   * Supplying it is what connects this benchmark to the budget gate. A budget
   * whose metric is never emitted makes `check-budgets.ts` fail rather than
   * silently skip, so a renamed or deleted benchmark is caught instead of
   * quietly dropping its own gate.
   */
  metric?: string;
}

export interface BenchResult {
  name: string;
  /** Budget key, when the benchmark is tied to one. */
  metric?: string;
  iterations: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  totalMs: number;
}

/** Timings collected by every `bench()` in the current file. */
export const benchResults: BenchResult[] = [];

/**
 * Serialise this file's results.
 *
 * Registered at module scope, so it is installed by the mere act of importing
 * the harness — a bench file cannot forget to opt in.
 */
afterAll(() => {
  // `expect.getState().testPath` is the file currently being run; used to give
  // each worker's output a distinct, stable name.
  const testPath = expect.getState().testPath ?? 'unknown.test.ts';
  const stem = basename(testPath).replace(/\.(test|spec)\.[tj]sx?$/, '');

  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    join(RESULTS_DIR, `${stem}.json`),
    JSON.stringify(
      {
        file: basename(testPath),
        // Consumed by `check-budgets.ts` to reject results left over from an
        // earlier run instead of scoring them as if they were fresh.
        generatedAt: new Date().toISOString(),
        results: benchResults,
      },
      null,
      2
    )
  );
});

/**
 * Declare a benchmark. Registers a normal vitest test that times `fn`.
 */
export function bench(
  name: string,
  fn: () => void | Promise<void>,
  options: BenchOptions = {}
): void {
  const {
    iterations = 50,
    warmup = 5,
    maxMeanMs = 50,
    timeout = 30_000,
    metric,
  } = options;

  test(
    name,
    // Passed as options rather than a positional number: vitest's default
    // timeout is 5s, well under the 30s these loops can need on a cold runner.
    { timeout },
    async () => {
      for (let i = 0; i < warmup; i += 1) {
        await fn();
      }

      const samples: number[] = [];
      for (let i = 0; i < iterations; i += 1) {
        const start = performance.now();
        await fn();
        samples.push(performance.now() - start);
      }

      const totalMs = samples.reduce((sum, s) => sum + s, 0);
      const result: BenchResult = {
        name,
        ...(metric ? { metric } : {}),
        iterations,
        meanMs: totalMs / iterations,
        minMs: Math.min(...samples),
        maxMs: Math.max(...samples),
        totalMs,
      };

      // Pushed BEFORE the assertion: a benchmark that blows its budget must
      // still appear in the emitted results, or `check-budgets.ts` would report
      // the metric as missing rather than as over budget.
      benchResults.push(result);

      // Surfaced in the test output so runs stay comparable over time.
      // eslint-disable-next-line no-console
      console.log(
        `  ${name}: mean ${result.meanMs.toFixed(3)}ms ` +
          `(min ${result.minMs.toFixed(3)} / max ${result.maxMs.toFixed(3)}, n=${iterations})`
      );

      expect(result.meanMs).toBeLessThan(maxMeanMs);
    }
  );
}
