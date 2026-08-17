/**
 * Performance budget definitions.
 *
 * Every budget here corresponds to a benchmark in `tests/performance/*-bench.test.ts`
 * tagged with the same `metric` key. That pairing is enforced in both
 * directions by `check-budgets.ts`: a budget with no measurement fails, and a
 * measurement with no budget fails. Adding a benchmark without a budget, or
 * deleting a benchmark and leaving its budget behind, is therefore a build
 * error rather than a silent loss of coverage.
 *
 * ---------------------------------------------------------------------------
 * How these thresholds were set, and what they can actually catch
 * ---------------------------------------------------------------------------
 * The previous set was aspirational: `file_read_single` was budgeted at 50ms
 * and `ai_chat_small` at 2000ms, against benchmarks that measure 0.002ms and
 * 0.013ms respectively. Those numbers are 1 000x–150 000x above what the code
 * does, so nothing short of a total collapse could have breached them — and
 * they were being scored against a hardcoded array anyway.
 *
 * The benchmarks exercise the in-memory mocks from `@cortex-ide/test-utils`,
 * not Electron IPC or real disk. So a budget here means "this code path did not
 * get dramatically slower", not "the product is fast enough for a user". The
 * end-to-end figures live in the profiling scripts (`bun run perf:all`).
 *
 * Thresholds below are the mean over 3 local runs, rounded up, then multiplied
 * by 20 and floored at 1ms. The headroom is deliberately generous: CI runners
 * are slower and noisier than this machine, and a budget that flakes gets
 * deleted, which is worse than a loose one. What it still catches is an
 * order-of-magnitude regression — an accidental O(n²), a mock that starts
 * touching the filesystem, a sync call added to a hot loop.
 *
 * Locally measured means, for reference (3 runs, ms):
 *   file_read_single 0.002 | file_write_single 0.001 | dir_listing 0.020-0.026
 *   file_read_sequential_10 0.011-0.013 | file_read_parallel_10 0.007-0.008
 *   file_write_parallel_10 0.006-0.008 | file_stat_10 0.010-0.052
 *   file_read_1mb 0.001-0.003 | file_write_1mb 0.001 | file_write_100 0.048-0.064
 *   ipc_invoke_small 0.002 | ipc_invoke_large 0.115-0.155
 *   ipc_invoke_batch_10 0.009-0.013 | ipc_send 0.002
 *   ipc_invoke_sequential_20 0.011-0.012 | ipc_listener_churn 0.008-0.012
 *   ai_chat_small 0.011-0.013 | ai_chat_large 0.012-0.014
 *   ai_stream 0.011-0.013 | ai_chat_batch_10 0.023-0.025
 */

export interface PerformanceBudget {
  name: string;
  metric: string;
  threshold: number;
  unit: string;
}

export const performanceBudgets: PerformanceBudget[] = [
  // ==========================================================================
  // File operations (mock FS, in-memory)
  // ==========================================================================
  { name: 'File Read - Single', metric: 'file_read_single', threshold: 1, unit: 'ms' },
  { name: 'File Write - Single', metric: 'file_write_single', threshold: 1, unit: 'ms' },
  { name: 'Directory Listing (100 entries)', metric: 'dir_listing', threshold: 1, unit: 'ms' },
  {
    name: 'File Read - 10 Sequential',
    metric: 'file_read_sequential_10',
    threshold: 1,
    unit: 'ms',
  },
  {
    name: 'File Read - 10 Parallel',
    metric: 'file_read_parallel_10',
    threshold: 1,
    unit: 'ms',
  },
  {
    name: 'File Write - 10 Parallel',
    metric: 'file_write_parallel_10',
    threshold: 1,
    unit: 'ms',
  },
  // 5x the others: observed 0.010-0.052ms, the widest spread of the set.
  { name: 'File Stat - 10 Parallel', metric: 'file_stat_10', threshold: 5, unit: 'ms' },
  { name: 'File Read - 1MB', metric: 'file_read_1mb', threshold: 1, unit: 'ms' },
  { name: 'File Write - 1MB', metric: 'file_write_1mb', threshold: 1, unit: 'ms' },
  { name: 'File Write - 100 Files', metric: 'file_write_100', threshold: 2, unit: 'ms' },

  // ==========================================================================
  // IPC (mock channel, no Electron)
  // ==========================================================================
  { name: 'IPC Invoke - Small Payload', metric: 'ipc_invoke_small', threshold: 1, unit: 'ms' },
  // 1000-item payload: the only benchmark whose mean exceeds 0.1ms.
  { name: 'IPC Invoke - Large Payload', metric: 'ipc_invoke_large', threshold: 4, unit: 'ms' },
  { name: 'IPC Invoke - 10 Batched', metric: 'ipc_invoke_batch_10', threshold: 1, unit: 'ms' },
  { name: 'IPC Send - Fire and Forget', metric: 'ipc_send', threshold: 1, unit: 'ms' },
  {
    name: 'IPC Invoke - 20 Sequential',
    metric: 'ipc_invoke_sequential_20',
    threshold: 1,
    unit: 'ms',
  },
  {
    name: 'IPC Listener Add/Remove Churn',
    metric: 'ipc_listener_churn',
    threshold: 1,
    unit: 'ms',
  },

  // ==========================================================================
  // AI provider (mock provider, no network)
  // ==========================================================================
  { name: 'AI Chat - Small Prompt', metric: 'ai_chat_small', threshold: 1, unit: 'ms' },
  { name: 'AI Chat - Large Prompt', metric: 'ai_chat_large', threshold: 1, unit: 'ms' },
  { name: 'AI Stream - Full Consume', metric: 'ai_stream', threshold: 1, unit: 'ms' },
  { name: 'AI Chat - 10 Batched', metric: 'ai_chat_batch_10', threshold: 1, unit: 'ms' },
];

/**
 * Check if a metric exceeds its budget.
 *
 * An unknown metric returns `known: false` rather than `passed: true`. The
 * previous version returned `{ passed: true }` for anything it did not
 * recognise, so a typo in a metric name produced a pass — the caller could not
 * tell "within budget" from "no budget exists".
 */
export function checkBudget(
  metric: string,
  value: number
): { known: boolean; passed: boolean; budget?: PerformanceBudget; percentage: number } {
  const budget = performanceBudgets.find((b) => b.metric === metric);

  if (!budget) {
    return { known: false, passed: false, percentage: 0 };
  }

  return {
    known: true,
    passed: value <= budget.threshold,
    budget,
    percentage: (value / budget.threshold) * 100,
  };
}

export interface BudgetViolation {
  metric: string;
  value: number;
  threshold: number;
  percentage: number;
}

export interface BudgetReport {
  total: number;
  passed: number;
  failed: number;
  violations: BudgetViolation[];
  /** Metrics that were measured but have no budget defined. */
  unknownMetrics: string[];
  /** Budgets that no measurement covered. */
  missingMetrics: string[];
}

/**
 * Score measured results against the budget table.
 *
 * Both directions of the pairing are reported. `missingMetrics` is the one that
 * matters most: a benchmark that is renamed, deleted, or never runs would
 * otherwise take its own gate with it and leave the report green.
 */
export function generateReport(
  results: Array<{ metric: string; value: number }>
): BudgetReport {
  const violations: BudgetViolation[] = [];
  const unknownMetrics: string[] = [];
  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const check = checkBudget(result.metric, result.value);

    if (!check.known) {
      unknownMetrics.push(result.metric);
      failed += 1;
      continue;
    }

    if (check.passed) {
      passed += 1;
    } else {
      failed += 1;
      violations.push({
        metric: result.metric,
        value: result.value,
        threshold: check.budget!.threshold,
        percentage: check.percentage,
      });
    }
  }

  const measured = new Set(results.map((r) => r.metric));
  const missingMetrics = performanceBudgets
    .map((b) => b.metric)
    .filter((metric) => !measured.has(metric));

  return {
    total: results.length,
    passed,
    failed,
    violations,
    unknownMetrics,
    missingMetrics,
  };
}
