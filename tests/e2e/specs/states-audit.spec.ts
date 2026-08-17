/**
 * Round two: the states the activity bar cannot reach.
 *
 * Debug panels, the dialogs, and a deliberately broken workspace. Same probe
 * contract as `view-audit.spec.ts` — screenshot plus a measured record, because
 * the images are not inspectable by the agent producing this report.
 *
 * The debug panel is opened with Cmd+Shift+D, NOT the header's Bug button: that
 * button calls `toggleDebugMode`, which only writes `settings.enabled` and never
 * sets `showDebugPanel`. Verified in round one — clicking it flipped the
 * button's aria-label to "Disable debug mode" while `[data-testid="debug-panel"]`
 * stayed absent from the DOM.
 */

import { test } from '../fixtures/electron';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_ROOT = join(process.cwd(), 'screenshots', 'audit');

interface Rec {
  name: string;
  screenshot: string;
  present: boolean;
  text: string;
  textLength: number;
  testIds: string[];
  buttons: { label: string; disabled: boolean }[];
  inputs: number;
  emptyMessages: string[];
  consoleErrors: string[];
  notes: Record<string, unknown>;
}

const records: Rec[] = [];

async function snap(
  page: Page,
  errors: string[],
  name: string,
  selector: string,
  notes: Record<string, unknown> = {}
): Promise<Rec> {
  const dir = join(OUT_ROOT, 'states');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: file, animations: 'disabled' });

  const data = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    const scope = el ?? (document.body as HTMLElement);
    const text = (scope.innerText ?? '').replace(/\s+/g, ' ').trim();

    // Phrases that indicate a panel chose to say "nothing here" — collected so
    // the report can judge whether each one explains WHY it is empty.
    const emptyMessages = Array.from(scope.querySelectorAll('*'))
      .map((n) => (n.childElementCount === 0 ? (n.textContent ?? '').trim() : ''))
      .filter((t) => /^(no |none|empty|nothing)/i.test(t))
      .slice(0, 12);

    return {
      present: Boolean(el),
      text: text.slice(0, 1500),
      textLength: text.length,
      testIds: Array.from(scope.querySelectorAll('[data-testid]'))
        .map((n) => n.getAttribute('data-testid') || '')
        .filter(Boolean),
      buttons: Array.from(scope.querySelectorAll('button')).map((b) => ({
        label: (b.getAttribute('aria-label') || b.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60),
        disabled: (b as HTMLButtonElement).disabled,
      })),
      inputs: scope.querySelectorAll('input,textarea,select').length,
      emptyMessages,
    };
  }, selector);

  const rec: Rec = {
    name,
    screenshot: file.replace(process.cwd() + '/', ''),
    ...data,
    consoleErrors: [...errors],
    notes,
  };
  records.push(rec);
  return rec;
}

test.describe('States audit', () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().replace(/\s+/g, ' ').slice(0, 300));
    });
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.name}: ${e.message}`.slice(0, 300)));
    await page.evaluate(() => window.localStorage.setItem('cortex-theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });
  });

  test('debug panel via Cmd+Shift+D, every tab', async ({ page }) => {
    // Contrast the two entry points explicitly, so the report can state which
    // one works rather than inferring it.
    await page.locator('[data-testid="toggle-debug"]').click();
    await page.waitForTimeout(900);
    const viaBugButton = await page.locator('[data-testid="debug-panel"]').count();
    const bugButtonLabel = await page
      .locator('[data-testid="toggle-debug"]')
      .getAttribute('aria-label');

    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(1200);
    const viaShortcut = await page.locator('[data-testid="debug-panel"]').count();

    await snap(page, errors, 'debug-entry-points', 'body', {
      panelCountAfterBugButton: viaBugButton,
      bugButtonAriaLabelAfterClick: bugButtonLabel,
      panelCountAfterCmdShiftD: viaShortcut,
    });

    if (viaShortcut === 0) return;

    const panel = page.locator('[data-testid="debug-panel"]');
    const tabs = panel.getByRole('tab');
    const tabCount = await tabs.count();
    const tabNames: string[] = [];
    for (let i = 0; i < tabCount; i += 1) {
      tabNames.push(((await tabs.nth(i).textContent()) ?? '').trim());
    }

    await snap(page, errors, 'debug-panel-open', '[data-testid="debug-panel"]', {
      tabCount,
      tabNames,
    });

    for (let i = 0; i < tabCount; i += 1) {
      const label = tabNames[i] || `tab-${i}`;
      await tabs.nth(i).click();
      // The console and IPC panels poll on a 1–2s interval; wait past one tick
      // so an empty render is a real empty, not a pre-first-fetch render.
      await page.waitForTimeout(2600);
      const slug = (label || `tab${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-') || `tab${i}`;
      await snap(page, errors, `debug-tab-${i}-${slug}`, '[data-testid="debug-panel"]', {
        tabIndex: i,
        tabLabel: label,
      });
    }
  });

  test('commit dialog', async ({ page }) => {
    await page.locator('[data-testid="sidebar-git"]').click();
    await page.waitForSelector('[data-testid="git-panel"]', { timeout: 20000 });
    await page.waitForTimeout(1500);

    // Commit is disabled until something is staged, so stage first and record
    // whether that actually enables it.
    const commitBefore = await page
      .locator('[data-testid="commit-button"]')
      .isDisabled()
      .catch(() => null);

    await page.locator('[data-testid="stage-all-button"]').click();
    await page.waitForTimeout(1800);

    const commitAfter = await page
      .locator('[data-testid="commit-button"]')
      .isDisabled()
      .catch(() => null);

    await snap(page, errors, 'git-after-stage-all', '[data-testid="git-panel"]', {
      commitDisabledBeforeStaging: commitBefore,
      commitDisabledAfterStaging: commitAfter,
    });

    if (commitAfter === false) {
      await page.locator('[data-testid="commit-button"]').click();
      await page.waitForTimeout(900);
      await snap(page, errors, 'commit-dialog', 'body', {
        openedFrom: 'commit-button',
      });
    }
  });

  test('branch selector open', async ({ page }) => {
    await page.locator('[data-testid="sidebar-git"]').click();
    await page.waitForSelector('[data-testid="git-panel"]', { timeout: 20000 });
    await page.waitForTimeout(1500);

    // The regression to check: the branch name renders, and the dropdown is
    // closed until asked for.
    const label = ((await page.locator('[data-testid="branch-selector"]').textContent()) ?? '').trim();
    const menusBefore = await page.locator('[role="menu"],[role="listbox"]').count();

    await page.locator('[data-testid="branch-selector"]').click();
    await page.waitForTimeout(900);
    const menusAfter = await page.locator('[role="menu"],[role="listbox"]').count();

    await snap(page, errors, 'branch-selector-open', 'body', {
      branchLabelText: label,
      openMenusBeforeClick: menusBefore,
      openMenusAfterClick: menusAfter,
    });
  });

  test('dirty tab close confirmation', async ({ page }) => {
    await page.waitForSelector('[data-testid="file-item"]', { timeout: 20000 });
    await page.locator('[data-testid="file-item"]').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);

    const opened = await page.locator('[data-testid="editor-tab"]').count();

    // Type into Monaco to make the tab dirty.
    await page.locator('.monaco-editor textarea').first().click({ timeout: 10000 }).catch(() => {});
    await page.keyboard.type('// audit edit\n');
    await page.waitForTimeout(900);

    const dirtyMark = await page.evaluate(() => {
      const tab = document.querySelector('[data-testid="editor-tab"]');
      return {
        tabText: tab?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        tabHtmlHasDot: tab?.innerHTML.includes('rounded-full') ?? null,
      };
    });

    await snap(page, errors, 'editor-dirty-tab', '[data-testid="editor-area"]', {
      openedTabs: opened,
      ...dirtyMark,
    });

    // Close it and see whether the confirmation appears.
    await page.locator('[data-testid="tab-close"]').first().click();
    await page.waitForTimeout(1100);

    await snap(page, errors, 'close-confirmation', 'body', {
      dialogRoleCount: await page.locator('[role="dialog"],[role="alertdialog"]').count(),
    });
  });

  test('settings tabs and provider config', async ({ page }) => {
    await page.locator('[data-testid="sidebar-settings"]').click();
    await page.waitForSelector('[data-testid="settings-panel"]', { timeout: 20000 });
    await page.waitForTimeout(1200);

    const tabLabels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="settings-panel"] button'))
        .map((b) => (b.textContent ?? '').trim())
        .filter(Boolean)
    );

    await snap(page, errors, 'settings-general', '[data-testid="settings-panel"]', { tabLabels });

    for (const name of ['AI Providers', 'Editor', 'Keyboard Shortcuts']) {
      const btn = page.locator('[data-testid="settings-panel"] button', { hasText: name }).first();
      if ((await btn.count()) === 0) continue;
      await btn.click();
      await page.waitForTimeout(1000);
      await snap(
        page,
        errors,
        `settings-${name.toLowerCase().replace(/\s+/g, '-')}`,
        '[data-testid="settings-panel"]'
      );
    }
  });

  test('terminal opened', async ({ page }) => {
    await page.locator('[data-testid="sidebar-terminal"]').click();
    await page.waitForSelector('[data-testid="terminal-panel"]', { timeout: 20000 });
    await page.waitForTimeout(800);

    await page.locator('[data-testid="new-terminal"]').click();
    await page.waitForTimeout(3000);

    await snap(page, errors, 'terminal-active', '[data-testid="terminal-panel"]', {
      hasXterm: await page.locator('.xterm').count(),
    });
  });

  test('extensions marketplace tab', async ({ page }) => {
    await page.locator('[data-testid="sidebar-extensions"]').click();
    await page.waitForSelector('[data-testid="extensions-panel"]', { timeout: 20000 });
    await page.waitForTimeout(1000);

    await snap(page, errors, 'extensions-installed', '[data-testid="extensions-panel"]');

    await page.locator('[data-testid="extensions-marketplace-tab"]').click();
    await page.waitForTimeout(1800);
    await snap(page, errors, 'extensions-marketplace', '[data-testid="extensions-panel"]');
  });

  test('notes and plans with content attempted', async ({ page }) => {
    await page.locator('[data-testid="sidebar-plans"]').click();
    await page.waitForSelector('[data-testid="plans-view"]', { timeout: 20000 });
    await page.waitForTimeout(1000);

    // Does adding a task actually persist a row?
    const input = page.locator('[data-testid="new-task-input"]');
    if ((await input.count()) > 0) {
      await input.fill('Audit probe task');
      await page.locator('[data-testid="add-task"]').click();
      await page.waitForTimeout(1800);
    }
    await snap(page, errors, 'plans-after-add', '[data-testid="plans-view"]');

    await page.locator('[data-testid="sidebar-notes"]').click();
    await page.waitForSelector('[data-testid="notes-view"]', { timeout: 20000 });
    await page.waitForTimeout(1200);
    await snap(page, errors, 'notes-initial', '[data-testid="notes-view"]');
  });

  test('search with results', async ({ page }) => {
    await page.locator('[data-testid="sidebar-search"]').click();
    await page.waitForSelector('[data-testid="search-panel"]', { timeout: 20000 });
    await page.waitForTimeout(800);

    const box = page.locator('[data-testid="search-panel"] input').first();
    await box.fill('export');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    await snap(page, errors, 'search-results', '[data-testid="search-panel"]');
  });

  test.afterEach(async ({}, testInfo) => {
    const slug = testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    mkdirSync(join(OUT_ROOT, 'state-probes'), { recursive: true });
    writeFileSync(
      join(OUT_ROOT, 'state-probes', `${slug}.json`),
      JSON.stringify(records.splice(0), null, 2),
      'utf8'
    );
  });
});
