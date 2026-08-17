/**
 * Measures PTY leakage across view switches, against the real app.
 *
 * ## Why a script and not a unit test
 *
 * The leak is a *process* leak: the renderer forgets its terminals, and nothing
 * ever sends `terminal:kill`, so the shell processes stay alive with no reader.
 * A mock cannot show that. This launches the built Electron app, counts the
 * shell processes spawned under it, drives the UI through view switches, and
 * counts again.
 *
 * ## What it reports
 *
 * - `live`      — shell processes alive under the app.
 * - `reachable` — terminals the UI still offers (tab count).
 * - `orphans`   — `live - reachable`: processes nobody can read or close. This is
 *                 the leak. Any value above 0 is a leaked PTY.
 *
 * ## Usage
 *
 *   bun run build
 *   xvfb-run --auto-servernum tsx scripts/measure-pty-leak.ts [cycles]
 *
 * Exits non-zero when orphans remain, so it can gate a fix.
 */

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const CYCLES = Number(process.argv[2] ?? 3);
const TERMINALS_PER_CYCLE = 2;
const REPO_ROOT = join(import.meta.dirname, '..');

/** Shell processes are the PTY children; node-pty spawns $SHELL. */
const SHELL_PATTERN = /(bash|zsh|sh|fish)$/;

interface ProcRow {
  pid: number;
  ppid: number;
  command: string;
}

function snapshotProcesses(): ProcRow[] {
  const output = execFileSync('ps', ['-eo', 'pid=,ppid=,comm='], { encoding: 'utf8' });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [pid, ppid, ...rest] = line.split(/\s+/);
      return { pid: Number(pid), ppid: Number(ppid), command: rest.join(' ') };
    });
}

/** Every descendant pid of `root`, so PTYs nested under a helper still count. */
function descendantPids(rows: ProcRow[], root: number): Set<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const row of rows) {
    const siblings = childrenByParent.get(row.ppid) ?? [];
    siblings.push(row.pid);
    childrenByParent.set(row.ppid, siblings);
  }

  const seen = new Set<number>();
  const queue = [root];

  while (queue.length > 0) {
    const pid = queue.pop()!;
    for (const child of childrenByParent.get(pid) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        queue.push(child);
      }
    }
  }

  return seen;
}

function countShells(appPid: number): number {
  const rows = snapshotProcesses();
  const descendants = descendantPids(rows, appPid);

  return rows.filter((row) => descendants.has(row.pid) && SHELL_PATTERN.test(row.command)).length;
}

async function launch(): Promise<{ app: ElectronApplication; page: Page; pid: number }> {
  const app = await electron.launch({
    executablePath: join(REPO_ROOT, 'node_modules', '.bin', 'electron'),
    args: ['--no-sandbox', join(REPO_ROOT, 'packages', 'main', 'dist', 'index.js')],
    env: { ...process.env, NODE_ENV: 'test', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 60_000,
  });

  const page = await app.firstWindow({ timeout: 60_000 });
  await page.waitForLoadState('domcontentloaded');

  // Same seeding as the E2E fixture: the app gates on a chosen folder, and the
  // welcome modal would intercept clicks.
  await page.evaluate((workspacePath) => {
    window.localStorage.setItem('cortex:workspace-path', workspacePath);
    window.localStorage.setItem('cortex:skip-welcome', 'true');
    window.localStorage.setItem(
      'cortex:onboarding',
      JSON.stringify({
        hasSeenWelcome: true,
        hasCompletedTutorial: true,
        hasConfiguredProvider: true,
      })
    );
  }, REPO_ROOT);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });

  const pid = app.process().pid;
  if (pid === undefined) throw new Error('Electron process has no pid');

  return { app, page, pid };
}

async function tabCount(page: Page): Promise<number> {
  return page.locator('[data-testid="terminal-tab"]').count();
}

async function main() {
  console.log(`PTY leak measurement — ${CYCLES} cycle(s), ${TERMINALS_PER_CYCLE} terminal(s) each\n`);

  const { app, page, pid } = await launch();

  try {
    const baseline = countShells(pid);
    console.log(`baseline: ${baseline} shell process(es) under pid ${pid}\n`);

    let created = 0;

    for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
      await page.click('[data-testid="sidebar-terminal"]');
      await page.waitForSelector('[data-testid="terminal-grid"]', { timeout: 15_000 });

      for (let i = 0; i < TERMINALS_PER_CYCLE; i += 1) {
        await page.click('[data-testid="new-terminal"]');
        await page.waitForTimeout(600);
        created += 1;
      }

      const tabsBefore = await tabCount(page);

      // Leave the Terminal view: this unmounts TerminalGrid.
      await page.click('[data-testid="sidebar-explorer"]');
      await page.waitForTimeout(800);

      // Come back.
      await page.click('[data-testid="sidebar-terminal"]');
      await page.waitForSelector('[data-testid="terminal-grid"]', { timeout: 15_000 });
      await page.waitForTimeout(1200);

      const tabsAfter = await tabCount(page);
      const live = countShells(pid) - baseline;
      const orphans = live - tabsAfter;

      console.log(
        `cycle ${cycle}: created=${created}  tabs before switch=${tabsBefore}  ` +
          `tabs after switch=${tabsAfter}  live PTYs=${live}  orphans=${orphans}`
      );
    }

    const finalTabs = await tabCount(page);
    const finalLive = countShells(pid) - baseline;
    const finalOrphans = finalLive - finalTabs;

    console.log('\n--- result ---');
    console.log(`terminals created : ${created}`);
    console.log(`PTYs alive        : ${finalLive}`);
    console.log(`reachable in UI   : ${finalTabs}`);
    console.log(`ORPHANED PTYs     : ${finalOrphans}`);

    if (finalOrphans > 0) {
      console.log(`\n❌ LEAK: ${finalOrphans} PTY process(es) alive with no way to reach or close them.`);
      process.exitCode = 1;
    } else {
      console.log('\n✅ No orphaned PTYs: every live PTY is reachable from the UI.');
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
