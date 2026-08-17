/**
 * Focused geometry probe for the Explorer's tree rows.
 *
 * Playwright could not click a file row: the click point resolved to
 * `editor-empty-state`, which lives in the main area. That only happens if the
 * row's centre falls outside the 320px sidebar, so this measures the rows
 * against their scroll container instead of assuming.
 */

import { test } from '../fixtures/electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test('explorer tree row geometry', async ({ page }) => {
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });
  await page.locator('[data-testid="sidebar-explorer"]').click();
  await page.waitForSelector('[data-testid="file-item"]', { timeout: 20000 });
  await page.waitForTimeout(800);

  const report = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="sidebar-panel"]') as HTMLElement;
    const panel = document.querySelector('[data-testid="file-explorer"]') as HTMLElement;
    const rows = Array.from(document.querySelectorAll('[data-testid="file-item"],[data-testid="directory-item"]'));

    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        right: Math.round(r.right),
        centerX: Math.round(r.x + r.width / 2),
      };
    };

    const sidebarRect = rect(sidebar);
    const panelRect = rect(panel);

    const rowData = rows.slice(0, 14).map((el) => {
      const r = rect(el)!;
      const name = el.getAttribute('data-filename') ?? el.textContent?.trim() ?? '';
      // What the browser says is on top at the row's click point.
      const hit = document.elementFromPoint(r.centerX, r.y + r.height / 2);
      return {
        name,
        testId: el.getAttribute('data-testid'),
        ...r,
        overflowsPanel: panelRect ? r.right > panelRect.right + 1 : null,
        centerOutsideSidebar: sidebarRect ? r.centerX > sidebarRect.right : null,
        elementAtCenter: hit
          ? `${hit.tagName.toLowerCase()}${hit.getAttribute('data-testid') ? `[${hit.getAttribute('data-testid')}]` : ''}`
          : null,
        // Nested role=treeitem is itself an a11y defect; record the nesting.
        parentRole: (el.parentElement?.getAttribute('role')) ?? null,
        role: el.getAttribute('role'),
        computedWidth: window.getComputedStyle(el).width,
        whiteSpace: window.getComputedStyle(el).whiteSpace,
      };
    });

    return {
      sidebar: sidebarRect,
      panel: panelRect,
      panelScrollWidth: panel?.scrollWidth ?? null,
      panelClientWidth: panel?.clientWidth ?? null,
      rows: rowData,
    };
  });

  const dir = join(process.cwd(), 'screenshots', 'audit');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'explorer-geometry.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));

  // Prove the row is reachable by a real user gesture at all, using the
  // keyboard path (rows carry tabindex=0), and record what happened.
  const first = page.locator('[data-testid="file-item"]').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const afterEnter = await page.evaluate(() => ({
    openTabs: document.querySelector('[data-testid="status-open-tabs"]')?.textContent?.trim() ?? null,
    hasEmptyState: Boolean(document.querySelector('[data-testid="editor-empty-state"]')),
    tabStrip: Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim()),
  }));
  writeFileSync(join(dir, 'explorer-open-attempt.json'), JSON.stringify(afterEnter, null, 2), 'utf8');
  console.log('after Enter:', JSON.stringify(afterEnter));
});
