#!/usr/bin/env bun

/**
 * Score measured benchmark timings against the performance budgets.
 *
 * ---------------------------------------------------------------------------
 * What this replaced
 * ---------------------------------------------------------------------------
 * This script used to score a hardcoded `mockResults` array — seven entries,
 * every one comfortably under budget, with the comment "in real implementation,
 * read from bench output". It therefore printed the same verdict and exited 0
 * regardless of what the benchmarks measured, or whether they ran at all. It was
 * wired into CI as a step named "Check performance budgets", so it reported
 * confidence it had not earned.
 *
 * It now reads `tests/performance/results/*.json`, written by
 * `bench-harness.ts` during `bun run test:performance`.
 *
 * ---------------------------------------------------------------------------
 * Three failure modes, all fatal
 * ---------------------------------------------------------------------------
 * 1. NO RESULTS — the directory is absent or empty. Means the benchmarks did not
 *    run. Exiting 0 here would rebuild the original bug in a subtler form: a
 *    gate that passes precisely because nothing was measured.
 * 2. STALE RESULTS — a file older than `--max-age-seconds` (default 3600).
 *    Without this, a checkout carrying results from an earlier green run would
 *    be scored as if fresh.
 * 3. MISSING or UNKNOWN metric — a budget with no measurement, or a measurement
 *    with no budget. A renamed or deleted benchmark takes its own gate with it
 *    otherwise, which is silent by construction.
 *
 * Usage:
 *   bun run test:performance:budgets     # runs the benches, then this
 *   bun tests/performance/check-budgets.ts --max-age-seconds=600
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateReport, performanceBudgets } from './performance-budgets';

const RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');

const DEFAULT_MAX_AGE_SECONDS = 3600;

interface ResultFile {
  file?: string;
  generatedAt?: string;
  results?: Array<{ name: string; metric?: string; meanMs: number }>;
}

function parseMaxAge(): number {
  const arg = process.argv.find((a) => a.startsWith('--max-age-seconds='));
  if (!arg) return DEFAULT_MAX_AGE_SECONDS;

  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`Invalid --max-age-seconds: ${arg}`);
    process.exit(1);
  }
  return value;
}

function fail(message: string, hint?: string): never {
  console.error(`\n❌ ${message}`);
  if (hint) console.error(`   ${hint}`);
  console.error('');
  process.exit(1);
}

const maxAgeSeconds = parseMaxAge();

// ---------------------------------------------------------------------------
// 1. Results must exist
// ---------------------------------------------------------------------------
if (!existsSync(RESULTS_DIR)) {
  fail(
    'No benchmark results found: tests/performance/results/ does not exist.',
    'Run `bun run test:performance` first (or `bun run test:performance:budgets`).'
  );
}

const files = readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'));

if (files.length === 0) {
  fail(
    'No benchmark results found: tests/performance/results/ is empty.',
    'Run `bun run test:performance` first.'
  );
}

// ---------------------------------------------------------------------------
// 2. Results must be fresh, and must parse
// ---------------------------------------------------------------------------
const now = Date.now();
const measured: Array<{ metric: string; value: number; name: string }> = [];
const untagged: string[] = [];

for (const file of files) {
  const path = join(RESULTS_DIR, file);
  const ageSeconds = (now - statSync(path).mtimeMs) / 1000;

  if (ageSeconds > maxAgeSeconds) {
    fail(
      `Stale benchmark results: ${file} is ${Math.round(ageSeconds)}s old ` +
        `(limit ${maxAgeSeconds}s).`,
      'Scoring results from a previous run would report a verdict about code that is no longer there.'
    );
  }

  let parsed: ResultFile;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as ResultFile;
  } catch (error) {
    fail(`Unreadable benchmark results in ${file}: ${(error as Error).message}`);
  }

  if (!Array.isArray(parsed.results) || parsed.results.length === 0) {
    fail(
      `Empty benchmark results in ${file}.`,
      'The harness writes results even when a benchmark fails its own budget, so an empty file means no benchmark ran.'
    );
  }

  for (const result of parsed.results) {
    if (typeof result.meanMs !== 'number' || !Number.isFinite(result.meanMs)) {
      fail(`Invalid meanMs for "${result.name}" in ${file}: ${result.meanMs}`);
    }

    if (!result.metric) {
      // Not fatal on its own — a benchmark may legitimately be exploratory —
      // but it is listed so an untagged addition is visible.
      untagged.push(`${result.name} (${file})`);
      continue;
    }

    measured.push({ metric: result.metric, value: result.meanMs, name: result.name });
  }
}

// ---------------------------------------------------------------------------
// 3. Score
// ---------------------------------------------------------------------------
const report = generateReport(measured);

console.log('\n📊 Performance Budget Report');
console.log(`   source: ${files.length} result file(s) in tests/performance/results/`);
console.log(`   budgets defined: ${performanceBudgets.length}`);
console.log(`   metrics measured: ${report.total}\n`);

for (const entry of measured.slice().sort((a, b) => a.metric.localeCompare(b.metric))) {
  const budget = performanceBudgets.find((b) => b.metric === entry.metric);
  if (!budget) continue;

  const pct = (entry.value / budget.threshold) * 100;
  const mark = entry.value <= budget.threshold ? '✅' : '❌';
  console.log(
    `  ${mark} ${entry.metric.padEnd(26)} ` +
      `${entry.value.toFixed(3).padStart(8)}ms / ${String(budget.threshold).padStart(4)}${budget.unit}` +
      `  (${pct.toFixed(1)}% of budget)`
  );
}

console.log('');
console.log(`✅ Passed: ${report.passed}`);
console.log(`❌ Failed: ${report.failed}`);

if (untagged.length > 0) {
  console.log(`\nℹ️  ${untagged.length} benchmark(s) with no budget key (not gated):`);
  for (const name of untagged) console.log(`     ${name}`);
}

let exitCode = 0;

if (report.violations.length > 0) {
  console.error('\n⚠️  Budget violations:\n');
  for (const violation of report.violations) {
    console.error(`  ${violation.metric}`);
    console.error(`    measured:  ${violation.value.toFixed(3)} ms`);
    console.error(`    threshold: ${violation.threshold} ms`);
    console.error(`    over by:   ${(violation.percentage - 100).toFixed(1)}%`);
    console.error('');
  }
  exitCode = 1;
}

if (report.missingMetrics.length > 0) {
  console.error(
    `\n⚠️  ${report.missingMetrics.length} budget(s) with no measurement — ` +
      'the benchmark was renamed, deleted, or did not run:\n'
  );
  for (const metric of report.missingMetrics) console.error(`  ${metric}`);
  console.error(
    '\n  A budget nobody measures is not a gate. Either tag a benchmark with' +
      '\n  this metric key, or remove the budget from performance-budgets.ts.\n'
  );
  exitCode = 1;
}

if (report.unknownMetrics.length > 0) {
  console.error(
    `\n⚠️  ${report.unknownMetrics.length} measured metric(s) with no budget:\n`
  );
  for (const metric of report.unknownMetrics) console.error(`  ${metric}`);
  console.error('\n  Add a budget in performance-budgets.ts or drop the metric tag.\n');
  exitCode = 1;
}

if (exitCode === 0) {
  console.log('\n✅ All performance budgets met.\n');
}

process.exit(exitCode);
