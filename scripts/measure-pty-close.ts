/**
 * Verifies the other half of the terminal fix: explicit close still kills.
 *
 * Reattaching on mount (instead of killing on unmount) is only correct if the
 * close button genuinely terminates the PTY. Otherwise the leak has just moved:
 * terminals that survive a view switch but can never be disposed of.
 *
 * Also checks that the PTYs are gone once the app quits, which is the point
 * where "no longer needed" is actually true.
 *
 *   bun run build
 *   xvfb-run --auto-servernum tsx scripts/measure-pty-close.ts
 */

import { _electron as electron, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const SHELL_PATTERN = /(bash|zsh|sh|fish)$/;

interface ProcRow {
  pid: number;
  ppid: number;
  command: string;
}

function snapshotProcesses(): ProcRow[] {
  return execFileSync('ps', ['-eo', 'pid=,ppid=,comm='], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [pid, ppid, ...rest] = line.split(/\s+/);
      return { pid: Number(pid), ppid: Number(ppid), command: rest.join(' ') };
    });
}

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

/** Live shell pids under the app, so survivors can be identified after quit. */
function shellPids(appPid: number): number[] {
  const rows = snapshotProcesses();
  const descendants = descendantPids(rows, appPid);
  return rows
    .filter((row) => descendants.has(row.pid) && SHELL_PATTERN.test(row.command))
    .map((row) => row.pid);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function openTerminalView(page: Page) {
  await page.click('[data-testid="sidebar-terminal"]');
  await page.waitForSelector('[data-testid="terminal-grid"]', { timeout: 15_000 });
}

async function main() {
  const app = await electron.launch({
    executablePath: join(REPO_ROOT, 'node_modules', '.bin', 'electron'),
    args: ['--no-sandbox', join(REPO_ROOT, 'packages', 'main', 'dist', 'index.js')],
    env: { ...process.env, NODE_ENV: 'test', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 60_000,
  });

  const page = await app.firstWindow({ timeout: 60_000 });
  await page.waitForLoadState('domcontentloaded');
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

  let failed = false;

  try {
    await openTerminalView(page);

    await page.click('[data-testid="new-terminal"]');
    await page.waitForTimeout(700);
    await page.click('[data-testid="new-terminal"]');
    await page.waitForTimeout(700);

    const afterCreate = shellPids(pid);
    console.log(`created 2 terminals -> ${afterCreate.length} PTY process(es)`);

    // Close the visible terminal through the UI.
    await page.click('[data-testid="close-terminal"]');
    await page.waitForTimeout(1000);

    const afterClose = shellPids(pid);
    const tabsAfterClose = await page.locator('[data-testid="terminal-tab"]').count();
    console.log(`after closing one   -> ${afterClose.length} PTY process(es), ${tabsAfterClose} tab(s)`);

    if (afterClose.length !== afterCreate.length - 1) {
      console.log(
        `❌ close did not kill exactly one PTY (${afterCreate.length} -> ${afterClose.length})`
      );
      failed = true;
    } else {
      console.log('✅ explicit close kills its PTY');
    }

    if (tabsAfterClose !== afterClose.length) {
      console.log(`❌ tab count (${tabsAfterClose}) does not match live PTYs (${afterClose.length})`);
      failed = true;
    }

    // Remaining PTYs must not survive the app.
    const survivorsCandidates = afterClose;
    await app.close();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const survivors = survivorsCandidates.filter(isAlive);
    if (survivors.length > 0) {
      console.log(`❌ ${survivors.length} PTY process(es) survived app quit: ${survivors.join(', ')}`);
      failed = true;
    } else {
      console.log('✅ no PTY survived app quit');
    }
  } catch (error) {
    console.error(error);
    failed = true;
    await app.close().catch(() => {});
  }

  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
