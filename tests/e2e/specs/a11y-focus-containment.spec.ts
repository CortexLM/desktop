/**
 * Collapsed-sidebar focus containment.
 *
 * `AppShell` animates the sidebar's width to 0 rather than unmounting it, so the
 * panel keeps its scroll position — a deliberate trade. But the subtree is only
 * marked `aria-hidden`; `overflow-hidden` clips it visually without removing it
 * from the tab order. This measures whether a keyboard user can still reach and
 * activate controls inside a sidebar they cannot see.
 */

import { test } from '../fixtures/electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'screenshots', 'audit');

test('collapsed sidebar keyboard containment', async ({ page }) => {
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });
  await page.waitForSelector('[data-testid="file-item"]', { timeout: 20000 });

  // Collapse via the documented shortcut.
  await page.keyboard.press('Control+B');
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => {
    const aside = document.querySelector('[data-testid="sidebar-panel"]') as HTMLElement;
    const rows = Array.from(document.querySelectorAll('[data-testid="file-item"]'));
    const focusables = Array.from(
      aside?.querySelectorAll(
        'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
      ) ?? []
    );

    return {
      asideWidth: Math.round(aside?.getBoundingClientRect().width ?? -1),
      asideAriaHidden: aside?.getAttribute('aria-hidden'),
      asideInert: aside?.hasAttribute('inert'),
      // The count that matters: focusable elements inside a hidden container.
      focusableInsideHidden: focusables.length,
      sampleFocusables: focusables.slice(0, 8).map((el) => ({
        tag: el.tagName.toLowerCase(),
        testId: el.getAttribute('data-testid'),
        tabIndex: (el as HTMLElement).tabIndex,
        name: el.getAttribute('data-filename') ?? el.getAttribute('aria-label') ?? '',
      })),
      rowCount: rows.length,
    };
  });

  // Now attempt the real interaction: focus a row inside the collapsed sidebar
  // and activate it. If a tab opens, hidden content was operable.
  const openedByKeyboard = await (async () => {
    const row = page.locator('[data-testid="file-item"]').first();
    if ((await row.count()) === 0) return 'no rows present';
    try {
      await row.focus({ timeout: 3000 });
    } catch {
      return 'focus() rejected';
    }
    const focusedName = await page.evaluate(
      () => (document.activeElement as HTMLElement)?.getAttribute('data-filename') ?? null
    );
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2200);
    const tabs = await page
      .locator('[data-testid="status-open-tabs"]')
      .textContent();
    return { focusedName, statusAfterEnter: (tabs ?? '').trim() };
  })();

  // Sequential Tab traversal from the header: does focus ever land in the
  // hidden aside on the natural tab path?
  await page.keyboard.press('Control+B'); // expand
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+B'); // collapse again, clean state
  await page.waitForTimeout(500);

  await page.locator('[data-testid="toggle-sidebar"]').focus();
  const tabPath: string[] = [];
  let landedInHiddenAside = false;
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { desc: 'none', inAside: false };
      const aside = document.querySelector('[data-testid="sidebar-panel"]');
      return {
        desc: `${el.tagName.toLowerCase()}${
          el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''
        }${el.getAttribute('data-filename') ? `{${el.getAttribute('data-filename')}}` : ''}`,
        inAside: Boolean(aside && aside.contains(el)),
      };
    });
    tabPath.push(`${info.inAside ? 'HIDDEN>' : ''}${info.desc}`);
    if (info.inAside) landedInHiddenAside = true;
  }

  const report = { state, openedByKeyboard, landedInHiddenAside, tabPath };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'a11y-focus-containment.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
});
