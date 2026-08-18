/**
 * View audit: captures every reachable view in both themes AND records a
 * structured, machine-readable probe of what each one actually rendered.
 *
 * WHY THE PROBE EXISTS
 * --------------------
 * The screenshots produced here cannot be inspected by the agent that wrote
 * this spec (no vision capability available in this environment). A PNG is
 * therefore a deliverable for a human, not evidence. Every claim made about a
 * view in the accompanying report has to come from something asserted here.
 *
 * So each capture is paired with a `ViewProbe` that records the things a
 * screenshot would have shown:
 *   - did the view actually mount, or did the error boundary replace it
 *     (`ErrorState` renders "This view failed to load");
 *   - is it still on its Suspense spinner (`view-loading`) after settling;
 *   - is it empty, and if so does the empty state say WHY it is empty — the
 *     defect that hid both the unfed IPC Inspector and the PerformancePanel
 *     opened on a category no producer emits;
 *   - real computed styles and geometry, so an unstyled render (the state
 *     ~300 earlier screenshots were taken in, before Tailwind was compiled)
 *     is distinguishable from a styled one;
 *   - console errors and page errors raised while the view was open.
 *
 * Output: screenshots/<theme>/<NN-name>.png plus screenshots/audit-<theme>.json
 */

import { test, expect } from '../fixtures/electron';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_ROOT = join(process.cwd(), 'screenshots', 'audit');

/** Console/page errors collected per test, reset in beforeEach. */
type ErrorLog = { consoleErrors: string[]; pageErrors: string[] };

interface ViewProbe {
  name: string;
  theme: string;
  screenshot: string;
  /** Root class list — proves which theme was actually applied. */
  rootClasses: string;
  /** The error boundary's ErrorState replaced the view. */
  errorBoundaryVisible: boolean;
  errorBoundaryText: string | null;
  /** Still on the Suspense fallback after settling. */
  stillLoading: boolean;
  /** Visible text of the probed container, trimmed and collapsed. */
  text: string;
  textLength: number;
  /** Interactive affordances found inside the container. */
  buttons: { label: string; disabled: boolean; visible: boolean }[];
  inputs: number;
  /** Elements carrying a data-testid, for reachability evidence. */
  testIds: string[];
  /** Computed styles proving CSS resolved (not the unstyled baseline). */
  styles: {
    bodyBg: string;
    bodyColor: string;
    containerBg: string;
    fontFamily: string;
    /** A Tailwind utility must produce a real value, not the initial one. */
    headerHeight: string;
  };
  geometry: {
    container: { x: number; y: number; width: number; height: number } | null;
    /** Children overflowing their container horizontally or vertically. */
    overflowingChildren: number;
    /** Elements with zero area that still contain text — invisible content. */
    collapsedWithText: number;
  };
  /** Heuristic empty-state detection plus whether it explains itself. */
  emptiness: {
    looksEmpty: boolean;
    emptyStateTestIds: string[];
    hasHeading: boolean;
    hasDescription: boolean;
    hasAction: boolean;
  };
  consoleErrors: string[];
  pageErrors: string[];
}

const probes: ViewProbe[] = [];

/** Collapse whitespace so recorded text is comparable and compact. */
function squash(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  // `use-theme` persists to `cortex-theme` and mirrors it onto the root class.
  // Setting storage then reloading is what a returning user experiences, and it
  // avoids depending on the toggle button's position.
  await page.evaluate((value) => {
    window.localStorage.setItem('cortex-theme', value);
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector(
    '[data-testid="sidebar"], [data-testid="cortex-code-shell"]',
    { timeout: 60000 }
  );
  await page.waitForFunction(
    (value) => document.documentElement.classList.contains(value),
    theme,
    { timeout: 15000 }
  );
}

/**
 * Probes a container and writes a screenshot beside it.
 *
 * `selector` is the element whose contents are judged; the screenshot is always
 * full-window, because a cropped shot hides whether the surrounding chrome
 * survived.
 */
async function capture(
  page: Page,
  errors: ErrorLog,
  opts: { name: string; theme: string; selector: string }
): Promise<ViewProbe> {
  const { name, theme, selector } = opts;
  const dir = join(OUT_ROOT, theme);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);

  // Let lazy chunks resolve and any first paint settle. Deliberately generous:
  // an under-waited probe would report `stillLoading` for a healthy view.
  await page.waitForTimeout(900);

  await page.screenshot({ path: file, animations: 'disabled' });

  const probe = await page.evaluate(
    ({ sel }) => {
      const root = document.documentElement;
      const container = document.querySelector(sel) as HTMLElement | null;
      const scope: HTMLElement = container ?? (document.body as HTMLElement);

      const cs = (el: Element) => window.getComputedStyle(el);
      const bodyStyle = cs(document.body);
      const scopeStyle = cs(scope);
      const header = document.querySelector('[data-testid="app-header"]');

      const errorBoundary = Array.from(scope.querySelectorAll('*')).find((el) =>
        (el.textContent ?? '').includes('This view failed to load')
      );

      const buttons = Array.from(scope.querySelectorAll('button')).map((b) => {
        const rect = b.getBoundingClientRect();
        return {
          label: (b.getAttribute('aria-label') || b.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80),
          disabled: (b as HTMLButtonElement).disabled,
          visible: rect.width > 0 && rect.height > 0,
        };
      });

      const testIds = Array.from(scope.querySelectorAll('[data-testid]'))
        .map((el) => el.getAttribute('data-testid') || '')
        .filter(Boolean);

      // Overflow + collapsed-content geometry.
      const scopeRect = scope.getBoundingClientRect();
      let overflowingChildren = 0;
      let collapsedWithText = 0;
      for (const el of Array.from(scope.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => (n.textContent ?? '').trim())
            .join('');
          if (own.length > 0) collapsedWithText += 1;
          continue;
        }
        if (
          scopeRect.width > 0 &&
          (r.right > scopeRect.right + 2 || r.bottom > scopeRect.bottom + 2)
        ) {
          overflowingChildren += 1;
        }
      }

      const text = (scope.innerText ?? scope.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();

      // Empty-state detection: an explicit EmptyState testid, or a container
      // with essentially no text and no controls.
      const emptyStateTestIds = testIds.filter((id) => id.includes('empty'));
      const looksEmpty = emptyStateTestIds.length > 0 || text.length < 24;
      const headings = Array.from(scope.querySelectorAll('h1,h2,h3,h4'));

      return {
        rootClasses: root.className,
        errorBoundaryVisible: Boolean(errorBoundary),
        errorBoundaryText: errorBoundary
          ? (errorBoundary.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
          : null,
        stillLoading: Boolean(scope.querySelector('[data-testid="view-loading"]')),
        text: text.slice(0, 1200),
        textLength: text.length,
        buttons,
        inputs: scope.querySelectorAll('input,textarea,select').length,
        testIds,
        styles: {
          bodyBg: bodyStyle.backgroundColor,
          bodyColor: bodyStyle.color,
          containerBg: scopeStyle.backgroundColor,
          fontFamily: bodyStyle.fontFamily.slice(0, 120),
          headerHeight: header ? cs(header).height : 'no-header',
        },
        geometry: {
          container: container
            ? {
                x: Math.round(scopeRect.x),
                y: Math.round(scopeRect.y),
                width: Math.round(scopeRect.width),
                height: Math.round(scopeRect.height),
              }
            : null,
          overflowingChildren,
          collapsedWithText,
        },
        emptiness: {
          looksEmpty,
          emptyStateTestIds,
          hasHeading: headings.length > 0,
          // An explanation is a paragraph beyond the heading itself.
          hasDescription: scope.querySelectorAll('p').length > 0,
          hasAction: buttons.some((b) => b.visible && !b.disabled),
        },
      };
    },
    { sel: selector }
  );

  const record: ViewProbe = {
    name,
    theme,
    screenshot: file.replace(process.cwd() + '/', ''),
    ...probe,
    consoleErrors: [...errors.consoleErrors],
    pageErrors: [...errors.pageErrors],
  };

  probes.push(record);
  return record;
}

/** The activity bar's views, read off the registry in `layout/views.ts`. */
const ACTIVITY_VIEWS: { id: string; testId: string; panel: string; sidebar: boolean }[] = [
  { id: 'explorer', testId: 'sidebar-explorer', panel: 'file-explorer', sidebar: true },
  { id: 'search', testId: 'sidebar-search', panel: 'search-panel', sidebar: true },
  { id: 'git', testId: 'sidebar-git', panel: 'git-panel', sidebar: true },
  { id: 'terminal', testId: 'sidebar-terminal', panel: 'terminal-panel', sidebar: false },
  { id: 'ai-chat', testId: 'sidebar-ai-chat', panel: 'ai-chat-panel', sidebar: false },
  { id: 'extensions', testId: 'sidebar-extensions', panel: 'extensions-panel', sidebar: false },
  { id: 'missions', testId: 'sidebar-missions', panel: 'missions-panel', sidebar: false },
  { id: 'notes', testId: 'sidebar-notes', panel: 'notes-view', sidebar: false },
  { id: 'plans', testId: 'sidebar-plans', panel: 'plans-view', sidebar: false },
  { id: 'browser', testId: 'sidebar-browser', panel: 'browser-view', sidebar: false },
  { id: 'automations', testId: 'sidebar-automations', panel: 'automation-panel', sidebar: false },
  { id: 'account', testId: 'sidebar-account', panel: 'account-panel', sidebar: false },
  { id: 'settings', testId: 'sidebar-settings', panel: 'settings-panel', sidebar: false },
  { id: 'security', testId: 'sidebar-security', panel: 'security-panel', sidebar: false },
  { id: 'review', testId: 'sidebar-review', panel: 'review-panel', sidebar: false },
  { id: 'knowledge', testId: 'sidebar-knowledge', panel: 'knowledge-panel', sidebar: false },
];

const SESSION_SURFACES = [
  'git',
  'prs',
  'explorer',
  'terminal',
  'notes',
  'plans',
  'preview',
  'ai-chat',
  'browser',
] as const;

async function enterIdeShell(page: Page) {
  const session = page.locator('[data-testid="cortex-code-shell"]');
  if (await session.count()) {
    await page.keyboard.press('Control+Shift+E');
    await page.waitForSelector('[data-testid="app-header"]', { timeout: 20000 });
  }
}

test.describe('View audit', () => {
  let errors: ErrorLog;

  test.beforeEach(async ({ page }) => {
    errors = { consoleErrors: [], pageErrors: [] };
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.consoleErrors.push(squash(msg.text()).slice(0, 400));
    });
    page.on('pageerror', (err) => {
      errors.pageErrors.push(squash(`${err.name}: ${err.message}`).slice(0, 400));
    });
    await page.waitForSelector(
      '[data-testid="sidebar"], [data-testid="cortex-code-shell"]',
      { timeout: 60000 }
    );
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`activity bar views - ${theme}`, async ({ page }) => {
      await setTheme(page, theme);

      if (await page.locator('[data-testid="cortex-code-shell"]').count()) {
        await capture(page, errors, {
          name: '00-session',
          theme,
          selector: '[data-testid="cortex-code-shell"]',
        });
        for (const [index, surface] of SESSION_SURFACES.entries()) {
          await page.locator(`[data-testid="sidebar-${surface}"]`).first().click();
          await capture(page, errors, {
            name: `00-session-${String(index + 1).padStart(2, '0')}-${surface}`,
            theme,
            selector: '[data-testid="cortex-code-shell"]',
          });
        }
        await enterIdeShell(page);
      }

      // Shell first: chrome is the reference for "styles resolved at all".
      await capture(page, errors, {
        name: '00-shell',
        theme,
        selector: '[data-testid="app-header"]',
      });

      for (const [index, view] of ACTIVITY_VIEWS.entries()) {
        await page.locator(`[data-testid="${view.testId}"]`).click();

        // Clicking the *already active* icon collapses the sidebar instead of
        // navigating (AppShell.handleSelect). Explorer is active on load, so the
        // first iteration would otherwise capture a collapsed sidebar and the
        // probe would read a 0-width panel. Re-expand before capturing.
        const collapsed = await page
          .locator('[data-testid="toggle-sidebar"]')
          .getAttribute('aria-expanded');
        if (collapsed === 'false') {
          await page.locator('[data-testid="toggle-sidebar"]').click();
          await page.waitForTimeout(400);
        }

        // The panel testid lives on a wrapper outside the error boundary, so it
        // is present even when the view inside it throws — which is exactly
        // what makes it a safe anchor to probe.
        const selector = `[data-testid="${view.panel}"]`;
        await page.waitForSelector(selector, { timeout: 20000 });

        await capture(page, errors, {
          name: `${String(index + 1).padStart(2, '0')}-${view.id}`,
          theme,
          selector,
        });
      }
    });
  }

  test('account tabs', async ({ page }) => {
    await setTheme(page, 'dark');
    await enterIdeShell(page);
    await page.locator('[data-testid="sidebar-account"]').click();
    await page.waitForSelector('[data-testid="account-panel"]', { timeout: 20000 });

    for (const tab of ['profile', 'team', 'billing']) {
      await page.locator(`[data-testid="${tab}-tab"]`).click();
      await capture(page, errors, {
        name: `account-${tab}`,
        theme: 'dark',
        selector: '[data-testid="account-panel"]',
      });
    }
  });

  test('command palette - files and commands', async ({ page }) => {
    await setTheme(page, 'dark');
    await enterIdeShell(page);

    // Cmd+P / Ctrl+P — file mode.
    await page.keyboard.press('Control+P');
    await page.waitForTimeout(600);
    await capture(page, errors, {
      name: 'palette-files',
      theme: 'dark',
      selector: 'body',
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Cmd+Shift+P — command mode.
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(600);
    await capture(page, errors, {
      name: 'palette-commands',
      theme: 'dark',
      selector: 'body',
    });
    await page.keyboard.press('Escape');

    // And the visible header affordance, which is the discoverable path.
    await page.locator('[data-testid="command-palette-trigger"]').click();
    await page.waitForTimeout(600);
    await capture(page, errors, {
      name: 'palette-via-header',
      theme: 'dark',
      selector: 'body',
    });
  });

  test('debug panel - all tabs', async ({ page }) => {
    await setTheme(page, 'dark');
    await enterIdeShell(page);

    await page.locator('[data-testid="toggle-debug"]').click();
    await page.waitForTimeout(800);

    const panel = page.locator('[data-testid="debug-panel"]');
    const opened = await panel.count();

    await capture(page, errors, {
      name: 'debug-00-after-toggle',
      theme: 'dark',
      selector: opened > 0 ? '[data-testid="debug-panel"]' : 'body',
    });

    if (opened === 0) {
      // Recorded rather than asserted: whether the debug toggle alone opens the
      // panel is part of what this audit is measuring.
      return;
    }

    for (const tab of ['Console', 'IPC Inspector', 'Performance', 'Memory']) {
      const trigger = panel.getByRole('tab', { name: tab });
      if ((await trigger.count()) === 0) continue;
      await trigger.click();
      await page.waitForTimeout(700);
      await capture(page, errors, {
        name: `debug-${tab.toLowerCase().replace(/\s+/g, '-')}`,
        theme: 'dark',
        selector: '[data-testid="debug-panel"]',
      });
    }

    // The settings tab's trigger is icon-only (no accessible name), so address
    // it positionally as the last tab.
    const tabs = panel.getByRole('tab');
    const count = await tabs.count();
    if (count > 0) {
      await tabs.nth(count - 1).click();
      await page.waitForTimeout(700);
      await capture(page, errors, {
        name: 'debug-settings',
        theme: 'dark',
        selector: '[data-testid="debug-panel"]',
      });
    }
  });

  test('editor with a file open, and tab close', async ({ page }) => {
    await setTheme(page, 'dark');
    await enterIdeShell(page);
    // Explorer is the remembered sidebar view after leaving the session shell.
    await page.waitForSelector('[data-testid="file-explorer"]', { timeout: 20000 });

    // Empty editor first — this is the state the workbench starts in.
    await capture(page, errors, {
      name: 'editor-empty',
      theme: 'dark',
      selector: '[data-testid="editor-area"]',
    });

    // Open whatever the fixture workspace seeded. `file-item` is the leaf
    // testid; `directory-item` carries the same `role="treeitem"`, which is why
    // a role-based locator matched folders and the click landed on a collapsed
    // row behind the empty state.
    const fileNodes = page.locator('[data-testid="file-explorer"] [data-testid="file-item"]');
    await fileNodes.first().waitFor({ state: 'visible', timeout: 20000 });
    await fileNodes.first().click();
    await page.waitForTimeout(2500);

    await capture(page, errors, {
      name: 'editor-file-open',
      theme: 'dark',
      selector: '[data-testid="editor-area"]',
    });

    // Sidebar collapsed — the Cmd+B layout state.
    await page.keyboard.press('Control+B');
    await page.waitForTimeout(600);
    await capture(page, errors, {
      name: 'editor-sidebar-collapsed',
      theme: 'dark',
      selector: '[data-testid="content-area"]',
    });
  });

  test('git panel with changes, and commit affordance', async ({ page }) => {
    await setTheme(page, 'dark');
    await enterIdeShell(page);
    await page.locator('[data-testid="sidebar-git"]').click();
    await page.waitForSelector('[data-testid="git-panel"]', { timeout: 20000 });
    await page.waitForTimeout(1500);

    await capture(page, errors, {
      name: 'git-panel',
      theme: 'dark',
      selector: '[data-testid="git-panel"]',
    });

    // Widen the probe to the whole window so the branch selector's rendering
    // (the `trigger`-prop regression) is part of the captured evidence.
    await capture(page, errors, {
      name: 'git-full-window',
      theme: 'dark',
      selector: 'body',
    });
  });

  test('no-folder empty states', async ({ page }) => {
    // Clearing the workspace path is the only way to reach the "No folder open"
    // branch of SidebarContent, and it is a real first-run state.
    await page.evaluate(() => {
      window.localStorage.removeItem('cortex:workspace-path');
      window.localStorage.setItem('cortex-theme', 'dark');
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    await capture(page, errors, {
      name: 'no-folder',
      theme: 'dark',
      selector: 'body',
    });
  });

  // One JSON per test, not one per run: the spec runs across four parallel
  // workers, each with its own module instance of `probes`. A single shared
  // `audit.json` written in afterAll would be whichever worker finished last.
  test.afterEach(async ({}, testInfo) => {
    const slug = testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    mkdirSync(join(OUT_ROOT, 'probes'), { recursive: true });
    writeFileSync(
      join(OUT_ROOT, 'probes', `${slug}.json`),
      JSON.stringify(probes.splice(0), null, 2),
      'utf8'
    );
  });
});
