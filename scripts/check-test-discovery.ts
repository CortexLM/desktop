#!/usr/bin/env bun
/**
 * Test-discovery guard-rail.
 *
 * Fails the build when a test file exists on disk but no runner project claims
 * it. This is the check that makes a silently-shrinking suite impossible: a
 * green CI that quietly skips files is more dangerous than a red one, because it
 * reports confidence it has not earned.
 *
 * Two independent failure modes are covered:
 *
 *   1. UNCLAIMED — a file matches the on-disk test glob but no project's
 *      `include` pattern matches it (wrong directory, restrictive `include`, or
 *      a directory with no vitest config at all).
 *   2. UNLOADABLE — a file is claimed but throws while loading (unresolvable
 *      import such as `bun:test` under vitest, syntax error, missing module).
 *      Vitest reports these as failed *suites* with zero tests; this script
 *      surfaces them as a discovery failure in its own right.
 *
 * Scope note: "no project" means no member of the root config's `projects` list —
 * every `packages/*​/vitest.config.ts` plus `tests/vitest.config.ts`. Both the
 * on-disk walk and the claim check cover `packages/` and the repo-root `tests/`.
 * Checking only `packages/` is how the eight root `tests/` suites previously went
 * unreported by this script *and* unloaded by the runner.
 *
 * Usage:
 *   bun scripts/check-test-discovery.ts            # report + exit 1 on drift
 *   bun scripts/check-test-discovery.ts --json     # machine-readable output
 *
 * Exit codes: 0 = every test file claimed and loadable, 1 = drift detected.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

/**
 * Directories walked for test files on disk.
 *
 * `tests/` is here as well as `packages/`: this script used to walk only
 * `packages/`, and the eight suites under the repo-root `tests/` (integration,
 * performance, visual-regression) sat outside both its scope and the root
 * config's `projects` glob. They were reported nowhere and loaded by nothing —
 * the guard was blind to exactly the failure it exists to catch. They are now
 * claimed by `tests/vitest.config.ts` and verified here.
 */
const TEST_ROOTS = ['packages', 'tests'];

/** Test-file shape on disk. Kept deliberately broad — broader than any single
 *  package `include` — so a misplaced file shows up as unclaimed rather than
 *  vanishing. */
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/;

/** Directories that never hold unit tests run by vitest. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.turbo']);

/**
 * Suites owned by other runners. Playwright specs use their own runner and
 * cannot link under vitest, so they are legitimately outside this check.
 * Anything excluded here MUST be covered by another CI job.
 */
const OTHER_RUNNER_PATTERNS: Array<{ pattern: RegExp; runner: string; job: string }> = [
  { pattern: /(^|\/)tests\/e2e\//, runner: 'playwright', job: 'test:e2e' },
  { pattern: /(^|\/)tests\/visual\//, runner: 'playwright', job: 'test:e2e' },
  { pattern: /(^|\/)tests\/accessibility\//, runner: 'playwright', job: 'test:e2e' },
];

interface Findings {
  onDisk: string[];
  claimed: string[];
  unclaimed: string[];
  otherRunner: Array<{ file: string; runner: string; job: string }>;
  unloadable: Array<{ file: string; reason: string }>;
  packages: Array<{ name: string; claimed: number }>;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (TEST_FILE_RE.test(entry)) out.push(relative(REPO_ROOT, full));
  }
  return out;
}

/** A member of the root config's `projects` list. */
interface Project {
  /** Label for the report, e.g. `main` or `tests`. */
  name: string;
  /** Directory holding the `vitest.config.ts`, relative to the repo root. */
  dir: string;
}

/**
 * Every directory that exposes a vitest config, i.e. the root `projects`
 * members: each `packages/*` plus the repo-root `tests/`.
 *
 * Kept as a discovery walk rather than a hardcoded list so that adding a package
 * cannot silently leave it out of this check.
 */
function vitestProjects(): Project[] {
  const projects: Project[] = [];

  if (existsSync(PACKAGES_DIR)) {
    for (const p of readdirSync(PACKAGES_DIR).sort()) {
      if (existsSync(join(PACKAGES_DIR, p, 'vitest.config.ts'))) {
        projects.push({ name: p, dir: join('packages', p) });
      }
    }
  }

  // `tests/` is not under `packages/`, so the loop above never reaches it.
  if (existsSync(join(REPO_ROOT, 'tests', 'vitest.config.ts'))) {
    projects.push({ name: 'tests', dir: 'tests' });
  }

  return projects;
}

/** Ask vitest which files it would load for a project. */
function claimedBy(project: Project): string[] {
  const cwd = join(REPO_ROOT, project.dir);
  const res = spawnSync('bunx', ['vitest', 'list', '--filesOnly'], {
    cwd,
    encoding: 'utf8',
    // `vitest list` still loads config; give it room on a cold cache.
    timeout: 180_000,
  });

  if (res.status !== 0) {
    const detail = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
    throw new Error(
      `\`vitest list\` failed in ${project.dir} (exit ${res.status}).\n` +
        `A config that cannot even be loaded hides its whole suite.\n${detail}`
    );
  }

  return (res.stdout ?? '')
    .split('\n')
    .map((l) => l.trim())
    // `vitest list` prefixes each line with the project name in brackets when a
    // config declares one (`[root-tests] integration/foo.test.ts`). Strip it
    // before resolving, or the path is garbage and the file reads as unclaimed.
    .map((l) => l.replace(/^\[[^\]]*\]\s*/, ''))
    .filter((l) => TEST_FILE_RE.test(l))
    .map((l) => relative(REPO_ROOT, resolve(cwd, l)));
}

/**
 * Detect claimed-but-unloadable suites: vitest reports zero collected tests for
 * a file whose module graph throws. Parsed from the JSON reporter.
 */
function unloadableIn(project: Project): Array<{ file: string; reason: string }> {
  const cwd = join(REPO_ROOT, project.dir);

  // Written to a real file, not /dev/stdout: vitest interleaves its own console
  // output on stdout, which corrupts the JSON document mid-stream.
  const reportPath = join(
    tmpdir(),
    `cortex-discovery-${project.name}-${process.pid}-${Date.now()}.json`
  );

  const res = spawnSync(
    'bunx',
    ['vitest', 'run', '--reporter=json', `--outputFile=${reportPath}`],
    { cwd, encoding: 'utf8', timeout: 600_000 }
  );

  let report: {
    testResults?: Array<{ name: string; status: string; message?: string; assertionResults?: unknown[] }>;
  };
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (error) {
    // No parsable report means the run died before reporting. That is itself a
    // discovery failure — staying silent here is the exact bug this guard
    // exists to prevent.
    const detail = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n').slice(-3).join(' ');
    return [
      {
        file: project.dir,
        reason: `no parsable JSON report (${(error as Error).message}). Tail: ${detail}`,
      },
    ];
  } finally {
    rmSync(reportPath, { force: true });
  }

  const bad: Array<{ file: string; reason: string }> = [];
  for (const suite of report.testResults ?? []) {
    const count = Array.isArray(suite.assertionResults) ? suite.assertionResults.length : 0;
    if (suite.status === 'failed' && count === 0) {
      const first = (suite.message ?? 'suite failed to load').split('\n')[0].trim();
      bad.push({ file: relative(REPO_ROOT, resolve(cwd, suite.name)), reason: first });
    }
  }
  return bad;
}

function collect(deep: boolean): Findings {
  const onDisk = TEST_ROOTS.flatMap((root) => {
    const full = join(REPO_ROOT, root);
    return existsSync(full) ? walk(full) : [];
  }).sort();

  const otherRunner: Findings['otherRunner'] = [];
  const inScope: string[] = [];
  for (const f of onDisk) {
    const match = OTHER_RUNNER_PATTERNS.find((p) => p.pattern.test(f));
    if (match) otherRunner.push({ file: f, runner: match.runner, job: match.job });
    else inScope.push(f);
  }

  const claimed = new Set<string>();
  const packages: Findings['packages'] = [];
  const unloadable: Findings['unloadable'] = [];

  for (const project of vitestProjects()) {
    const files = claimedBy(project);
    files.forEach((f) => claimed.add(f));
    packages.push({ name: project.name, claimed: files.length });
    if (deep) unloadable.push(...unloadableIn(project));
  }

  return {
    onDisk,
    claimed: [...claimed].sort(),
    unclaimed: inScope.filter((f) => !claimed.has(f)),
    otherRunner,
    unloadable,
    packages,
  };
}

function main(): void {
  const json = process.argv.includes('--json');
  const deep = !process.argv.includes('--fast');
  const f = collect(deep);

  if (json) {
    console.log(JSON.stringify(f, null, 2));
  } else {
    const inScope = f.onDisk.length - f.otherRunner.length;
    console.log('Test discovery');
    console.log(`  on disk               ${f.onDisk.length}`);
    console.log(`  other runners         ${f.otherRunner.length} (playwright)`);
    console.log(`  in scope for vitest   ${inScope}`);
    console.log(`  claimed by a project  ${f.claimed.length}`);
    console.log('');
    for (const p of f.packages) {
      console.log(`    ${p.name.padEnd(14)} ${String(p.claimed).padStart(3)}`);
    }

    if (f.unclaimed.length) {
      console.log('');
      console.log(`UNCLAIMED — ${f.unclaimed.length} test file(s) no project loads:`);
      for (const file of f.unclaimed) console.log(`  ${file}`);
      console.log('');
      console.log('  Fix: add the directory to the project\'s `include`, or add a');
      console.log('  vitest.config.ts (and list it in the root config\'s `projects`)');
      console.log('  if the directory has none.');
    }

    if (f.unloadable.length) {
      console.log('');
      console.log(`UNLOADABLE — ${f.unloadable.length} claimed suite(s) throw while loading:`);
      for (const u of f.unloadable) console.log(`  ${u.file}\n      ${u.reason}`);
      console.log('');
      console.log('  These contribute zero tests. A runner that treats them as');
      console.log('  warnings reports green while skipping them.');
    }
  }

  const failures = f.unclaimed.length + f.unloadable.length;
  if (failures > 0) {
    if (!json) console.log(`\nFAIL: ${failures} discovery problem(s).`);
    process.exit(1);
  }
  if (!json) console.log('\nOK: every test file is claimed and loadable.');
}

main();
