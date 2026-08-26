#!/usr/bin/env bun
/**
 * Fails the build when a test file on disk is not claimed by any runner.
 *
 * The failure this exists to catch is silent: a suite that no config's `include` glob
 * matches is not reported as skipped, it simply never loads, and the run goes green with
 * the file sitting right there. That has happened in this repo before - the root config's
 * `projects` glob only matched `packages/*​/vitest.config.ts`, so every suite under the
 * repo-root `tests/` directory went unloaded for weeks.
 *
 * Rather than reimplement each runner's glob resolution and risk agreeing with a bug, this
 * asks the runners themselves what they collected — `vitest list --json` and
 * `playwright test --list` per config — and diffs that against the files on disk.
 *
 * Playwright used to be handled by *declaring* which directories it owned. That reproduced
 * the very failure this script exists to catch, one level up: `tests/accessibility/` was
 * listed as Playwright territory while no Playwright config had a `testDir` pointing at it,
 * and `playwright.visual.config.ts` narrowed `testMatch` to a single file. Four specs, ~1500
 * lines, were reported as "owned by playwright" while no runner ever loaded them. A
 * directory declaration asserts intent; asking the runner measures reality.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/;

/** Directories never worth walking. */
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  'test-results',
  'playwright-report',
  'quality-reports',
]);

/**
 * Playwright configs to interrogate.
 *
 * A new config has to be added here, which is the point: an unlisted config's specs show up
 * as unclaimed rather than passing as somebody else's problem.
 */
const PLAYWRIGHT_CONFIGS = ['playwright.config.ts', 'playwright.visual.config.ts'];

interface CollectedTest {
  name: string;
  file: string;
  projectName?: string;
}

function walk(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      walk(path, found);
      continue;
    }

    if (TEST_FILE_PATTERN.test(entry.name)) found.push(path);
  }
  return found;
}

/**
 * The spec files Playwright actually collects, across every config.
 *
 * `--list --reporter=json` rather than parsing `testDir`/`testMatch` ourselves: those
 * interact (a narrow `testMatch` silently excludes most of a `testDir`) and reimplementing
 * the interaction is how a checker ends up agreeing with the bug it is meant to find.
 */
function collectFromPlaywright(): Set<string> {
  const collected = new Set<string>();

  for (const config of PLAYWRIGHT_CONFIGS) {
    const result = spawnSync(
      'bunx',
      ['playwright', 'test', '--config', config, '--list', '--reporter=json'],
      { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    );

    if (result.error) {
      throw new Error(`could not list Playwright specs for ${config}: ${result.error.message}`);
    }

    const stdout = result.stdout ?? '';
    const start = stdout.indexOf('{');
    if (start === -1) {
      throw new Error(
        `"playwright test --list" produced no JSON for ${config}.\nstdout:\n${stdout.slice(
          0,
          2000,
        )}\nstderr:\n${(result.stderr ?? '').slice(0, 2000)}`,
      );
    }

    const report = JSON.parse(stdout.slice(start)) as {
      config?: { rootDir?: string };
    };

    // Reported file paths are relative to `config.rootDir` — the *resolved* testDir, not the
    // repo root. Joining them onto the repo root instead yields paths that exist nowhere and
    // match nothing, which reads exactly like "collected but unclaimed".
    const rootDir = report.config?.rootDir;
    if (typeof rootDir !== 'string') {
      throw new Error(`"playwright test --list" for ${config} reported no config.rootDir`);
    }

    // The report nests specs under `suites[].suites[]…`, each carrying the file it came from.
    // Only the paths matter, so every `file` key at any depth is collected rather than the
    // shape being walked.
    const files = new Set<string>();
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node !== 'object' || node === null) return;

      const record = node as Record<string, unknown>;
      if (typeof record.file === 'string') files.add(record.file);
      Object.values(record).forEach(visit);
    };
    visit(report);

    for (const file of files) {
      collected.add(relative(REPO_ROOT, join(rootDir, file)));
    }
  }

  return collected;
}

function collectFromVitest(fast: boolean): Set<string> {
  const args = ['vitest', 'list', '--json'];
  // `--fast` trades a little accuracy for speed by skipping the type-test projects, which
  // dominate collection time. The full form is what CI should run.
  if (fast) args.push('--typecheck.enabled=false');

  const result = spawnSync('bunx', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`could not run "bunx ${args.join(' ')}": ${result.error.message}`);
  }

  // Vitest prints config warnings to stdout ahead of the JSON, so the payload starts at the
  // first bracket rather than at byte zero.
  const stdout = result.stdout ?? '';
  const start = stdout.indexOf('[');
  if (start === -1) {
    throw new Error(
      `"vitest list" produced no JSON.\nstdout:\n${stdout.slice(0, 2000)}\nstderr:\n${(
        result.stderr ?? ''
      ).slice(0, 2000)}`,
    );
  }

  let collected: CollectedTest[];
  try {
    collected = JSON.parse(stdout.slice(start)) as CollectedTest[];
  } catch (error) {
    throw new Error(`could not parse "vitest list" output: ${String(error)}`);
  }

  return new Set(collected.map((test) => relative(REPO_ROOT, test.file)));
}

function main(): void {
  const fast = process.argv.includes('--fast');

  const onDisk = walk(REPO_ROOT).map((path) => relative(REPO_ROOT, path));

  const byVitest = collectFromVitest(fast);
  const byPlaywright = collectFromPlaywright();

  // A file counts as covered when *some* runner reports collecting it. Both sets are
  // measured, so a file cannot slip through by being nobody's declared territory.
  const unclaimed = onDisk.filter((path) => !byVitest.has(path) && !byPlaywright.has(path));

  process.stdout.write(
    [
      `test files on disk        ${onDisk.length}`,
      `collected by vitest       ${byVitest.size}`,
      `collected by playwright   ${byPlaywright.size}`,
      `unclaimed                 ${unclaimed.length}`,
      '',
    ].join('\n'),
  );

  if (unclaimed.length === 0) {
    process.stdout.write('Every test file is claimed by a runner.\n');
    return;
  }

  process.stderr.write(
    [
      '',
      'These test files are not claimed by any runner. They will never execute, and the',
      'suite will report green with them sitting on disk:',
      '',
      ...unclaimed.map((path) => `  ${path}`),
      '',
      'Fix by either adding a packages/<name>/vitest.config.ts whose include glob matches',
      'them, widening an existing config, or - if they belong to Playwright - making sure a',
      'listed config actually collects them: check its testDir AND its testMatch, since a',
      'narrow testMatch silently excludes most of a testDir. New Playwright configs go in',
      'PLAYWRIGHT_CONFIGS in this script.',
      '',
    ].join('\n'),
  );

  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`check-test-discovery: ${String(error)}\n`);
  process.exitCode = 1;
}
