/**
 * Targeted re-probe of the two suspects round two flagged.
 *
 * 1. BranchSelector's popover: round two counted `[role="menu"],[role="listbox"]`
 *    and found 0. Radix Popover renders `role="dialog"`, so that count proved
 *    nothing. This looks for the component's own `branch-list` testid instead.
 * 2. The staged list showed `untracked.txt` twice, as both M and A. Recorded
 *    here from the git status the renderer actually received.
 */

import { test } from '../fixtures/electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'screenshots', 'audit');

test('branch popover really opens, and what it lists', async ({ page }) => {
  await page.evaluate(() => window.localStorage.setItem('cortex-theme', 'dark'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });
  await page.locator('[data-testid="sidebar-git"]').click();
  await page.waitForSelector('[data-testid="git-panel"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const before = {
    branchListCount: await page.locator('[data-testid="branch-list"]').count(),
    dialogCount: await page.locator('[role="dialog"]').count(),
  };

  await page.locator('[data-testid="branch-selector"]').click();
  await page.waitForTimeout(1200);

  mkdirSync(join(OUT, 'states'), { recursive: true });
  await page.screenshot({
    path: join(OUT, 'states', 'branch-popover-open.png'),
    animations: 'disabled',
  });

  const after = await page.evaluate(() => {
    const list = document.querySelector('[data-testid="branch-list"]');
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    return {
      branchListPresent: Boolean(list),
      branchListText: (list as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
      branchEntries: list
        ? Array.from(list.querySelectorAll('button')).map((b) =>
            (b.textContent ?? '').replace(/\s+/g, ' ').trim()
          )
        : [],
      dialogCount: dialogs.length,
      dialogRoles: dialogs.map((d) => d.getAttribute('data-testid') ?? d.className.slice(0, 60)),
    };
  });

  // Does clicking a non-current branch change anything observable?
  let checkoutEffect: unknown = 'not attempted';
  if (after.branchEntries.length > 1) {
    const target = page
      .locator('[data-testid="branch-list"] button')
      .filter({ hasText: 'develop' })
      .first();
    if ((await target.count()) > 0) {
      await target.click();
      await page.waitForTimeout(1800);
      checkoutEffect = {
        branchLabelAfterCheckout: (
          (await page.locator('[data-testid="branch-selector"]').textContent()) ?? ''
        ).trim(),
        // If checkout were real, git status would follow the new branch.
        note: 'BranchSelector.handleCheckout only console.logs; label should stay unchanged',
      };
    }
  }

  const report = { before, after, checkoutEffect };
  writeFileSync(join(OUT, 'branch-selector-probe.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
});

test('git status duplicate entries after staging', async ({ page }) => {
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });
  await page.locator('[data-testid="sidebar-git"]').click();
  await page.waitForSelector('[data-testid="git-panel"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const readRows = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="changed-file"]')).map((el) =>
        (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
      )
    );

  const beforeStage = await readRows();

  // Ask the main process for the same status the panel renders, so the duplicate
  // can be attributed to the data or to the rendering.
  const rawBefore = await page.evaluate(async () => {
    const path = window.localStorage.getItem('cortex:workspace-path');
    const res = await window.cortex.git.status({ repoPath: path! });
    return res;
  });

  await page.locator('[data-testid="stage-all-button"]').click();
  await page.waitForTimeout(2000);

  const afterStage = await readRows();
  const rawAfter = await page.evaluate(async () => {
    const path = window.localStorage.getItem('cortex:workspace-path');
    const res = await window.cortex.git.status({ repoPath: path! });
    return res;
  });

  const report = {
    renderedBeforeStage: beforeStage,
    renderedAfterStage: afterStage,
    rawStatusBefore: rawBefore,
    rawStatusAfter: rawAfter,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'git-duplicate-probe.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
});
