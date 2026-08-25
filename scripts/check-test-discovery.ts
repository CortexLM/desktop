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
 * Rather than reimplement Vitest's glob resolution and risk agreeing with a bug, this asks
 * Vitest itself which files it collected (`vitest list --json`) and diffs that against the
 * files actually on disk. Playwright's territory is declared explicitly, so those files are
 * accounted for rather than merely absent.
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
 * Suites owned by Playwright rather than Vitest. They import `@playwright/test`, cannot
 * link under Vitest, and run in the `test:e2e` job. Declared here so they are accounted
 * for; a new directory of Playwright specs has to be added, which is the point.
 */
const PLAYWRIGHT_DIRECTORIES = [
  join('tests', 'e2e'),
  join('tests', 'visual'),
  join('tests', 'accessibility'),
];

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

function isPlaywrightOwned(relativePath: string): boolean {
  return PLAYWRIGHT_DIRECTORIES.some(
    (directory) => relativePath === directory || relativePath.startsWith(`${directory}${sep}`),
  );
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
  const playwrightOwned = onDisk.filter(isPlaywrightOwned);
  const vitestCandidates = onDisk.filter((path) => !isPlaywrightOwned(path));

  const claimed = collectFromVitest(fast);
  const unclaimed = vitestCandidates.filter((path) => !claimed.has(path));

  process.stdout.write(
    [
      `test files on disk        ${onDisk.length}`,
      `claimed by vitest         ${claimed.size}`,
      `owned by playwright       ${playwrightOwned.length}`,
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
      'them, widening an existing config, or - if they belong to Playwright - adding their',
      'directory to PLAYWRIGHT_DIRECTORIES in this script.',
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
