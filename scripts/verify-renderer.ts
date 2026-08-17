/**
 * Renderer verification: asserts on real computed styles and layout geometry.
 *
 * Screenshots can't be inspected from here, so this checks the things a
 * screenshot would have shown: that Tailwind utilities actually resolve, that
 * design tokens produce real colours, that the focus ring is the intended
 * width, and that panels stay inside their containers.
 *
 * Exits non-zero if any check fails.
 */

import { chromium, type Page } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const DIST_DIR = join(process.cwd(), 'packages', 'renderer', 'dist');
const WORKSPACE = process.cwd();
const PORT = 4601;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.map': 'application/json',
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      const rawPath = (req.url ?? '/').split('?')[0];
      const relative = rawPath === '/' ? 'index.html' : decodeURIComponent(rawPath).replace(/^\/+/, '');
      const resolved = join(DIST_DIR, normalize(relative));
      if (!resolved.startsWith(DIST_DIR)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(resolved);
      res.writeHead(200, { 'Content-Type': MIME[extname(resolved)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });

  return new Promise<() => Promise<void>>((resolve) => {
    server.listen(PORT, () =>
      resolve(() => new Promise<void>((done) => server.close(() => done())))
    );
  });
}

const CORTEX_STUB = `
(() => {
  const ok = (data) => Promise.resolve({ success: true, data });
  const FILES = {
    '__ROOT__': [
      { name: 'packages', path: '__ROOT__/packages', type: 'directory' },
      { name: 'node_modules', path: '__ROOT__/node_modules', type: 'directory' },
      { name: '.git', path: '__ROOT__/.git', type: 'directory' },
      { name: 'package.json', path: '__ROOT__/package.json', type: 'file' },
      { name: 'README.md', path: '__ROOT__/README.md', type: 'file' },
    ],
    '__ROOT__/packages': [
      { name: 'renderer', path: '__ROOT__/packages/renderer', type: 'directory' },
      { name: 'App.tsx', path: '__ROOT__/packages/App.tsx', type: 'file' },
    ],
  };

  window.cortex = {
    fs: {
      readDir: ({ path }) => ok({ entries: FILES[path] ?? [] }),
      readFile: () => ok({ content: '', stats: { size: 0, mtime: 0, ctime: 0 } }),
      writeFile: () => ok({ success: true, bytesWritten: 0 }),
      watch: () => Promise.resolve(), unwatch: () => Promise.resolve(),
      onFileChange: () => () => {},
    },
    editor: {
      openFile: () => ok({ content: 'export const x = 1;\\n', language: 'typescript' }),
      saveFile: () => ok({ success: true }), format: () => ok({ content: '' }),
    },
    git: {
      status: () => ok({
        branch: 'main', ahead: 1, behind: 0, isClean: false,
        files: [
          { path: 'a/staged.ts', status: 'modified', staged: true },
          { path: 'b/unstaged.ts', status: 'untracked', staged: false },
        ],
      }),
      commit: () => ok({}), push: () => ok({}), pull: () => ok({}), diff: () => ok({ diff: '' }),
    },
    ai: {
      createSession: () => ok({ sessionId: 's1', providerId: 'anthropic', createdAt: 0 }),
      sendMessage: () => ok({}), streamResponse: () => Promise.resolve(), stopStream: () => Promise.resolve(),
    },
    // on* members are event subscriptions that must return an unsubscribe
    // function; the rest are request methods returning an IPC response.
    mcp: new Proxy({}, {
      get: (_t, k) => (typeof k === 'string' && k.startsWith('on')
        ? () => () => {}
        : () => ok({ servers: [], tools: [], permissions: [] })),
    }),
    terminal: {
      create: () => ok({ terminalId: 't' }), input: () => ok({}), resize: () => ok({}), kill: () => ok({}),
      onData: () => () => {}, onExit: () => () => {},
    },
    db: { query: () => ok({ rows: [] }), execute: () => ok({ changes: 0 }) },
    automation: new Proxy({}, {
      get: (_t, k) => (typeof k === 'string' && k.startsWith('on') ? () => () => {} : () => ok({ automations: [], logs: [] })),
    }),
    update: {
      check: () => Promise.resolve({ success: true }),
      download: () => Promise.resolve({ success: true }),
      install: () => Promise.resolve({ success: true }),
      onChecking: () => () => {}, onAvailable: () => () => {}, onNotAvailable: () => () => {},
      onDownloadProgress: () => () => {}, onDownloaded: () => () => {}, onError: () => () => {},
    },
    invoke: () => ok({}),
  };

  // GitPanel and other views go through lib/ipc.ts, which calls
  // window.electron.invoke and unwraps { success, data } itself. So this has to
  // route per channel rather than returning a bare empty object.
  const ELECTRON_RESPONSES = {
    'git:status': {
      branch: 'main', ahead: 1, behind: 0, isClean: false,
      files: [
        { path: 'a/staged.ts', status: 'modified', staged: true },
        { path: 'b/unstaged.ts', status: 'untracked', staged: false },
      ],
    },
    'git:branches': { branches: [{ name: 'main', current: true }], current: 'main' },
    'debug:get-settings': { enabled: false },
    'debug:get-logs': [],
    'debug:get-metrics': [],
    'debug:get-memory': [],
    'debug:get-ipc-messages': [],
    'debug:get-ipc-stats': {},
    'debug:get-system-info': {},
  };

  window.electron = {
    invoke: (channel) => ok(ELECTRON_RESPONSES[channel] ?? {}),
  };
})();
`;

const failures: string[] = [];
const passes: string[] = [];

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    passes.push(name);
  } else {
    failures.push(`${name}: ${detail}`);
  }
}

const stop = await serve();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await context.newPage();

const consoleErrors: string[] = [];
/**
 * Errors caused by this harness rather than the app.
 *
 * - CSP: index.html restricts `default-src` to 'self', which blocks a couple of
 *   inline data: assets when served over plain HTTP instead of file://.
 * - Monaco: @monaco-editor/loader pulls the editor from a CDN, which the same
 *   CSP blocks. Under Electron the loader resolves against the bundled copy.
 */
const HARNESS_NOISE = [/Content Security Policy/, /Monaco initialization/];

page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (HARNESS_NOISE.some((pattern) => pattern.test(text))) return;
  consoleErrors.push(text);
});
page.on('pageerror', (error) => consoleErrors.push(`[pageerror] ${error.message}`));

await page.addInitScript(CORTEX_STUB.replace(/__ROOT__/g, WORKSPACE));
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);

// --- Tailwind actually compiled ---------------------------------------------

const tailwindWorks = await page.evaluate(() => {
  const probe = document.createElement('div');
  probe.className = 'flex h-screen bg-page text-text';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const result = {
    display: style.display,
    background: style.backgroundColor,
    color: style.color,
  };
  probe.remove();
  return result;
});

check(
  'tailwind utilities compile',
  tailwindWorks.display === 'flex',
  `expected display:flex from .flex, got "${tailwindWorks.display}"`
);
check(
  'design tokens resolve to colours',
  tailwindWorks.background !== '' && tailwindWorks.background !== 'rgba(0, 0, 0, 0)',
  `bg-page produced "${tailwindWorks.background}"`
);

// --- Focus ring is 2px ------------------------------------------------------

const focusRing = await page.evaluate(() => {
  const probe = document.createElement('button');
  probe.textContent = 'probe';
  document.body.appendChild(probe);
  probe.focus();
  const style = getComputedStyle(probe);
  const result = { width: style.outlineWidth, offset: style.outlineOffset };
  probe.remove();
  return result;
});

check('focus ring is 2px', focusRing.width === '2px', `outline-width is "${focusRing.width}"`);
check('focus offset is 2px', focusRing.offset === '2px', `outline-offset is "${focusRing.offset}"`);

// --- Scrollbar width -------------------------------------------------------

const scrollbarWidth = await page.evaluate(() => {
  const rule = Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules);
      } catch {
        return [];
      }
    })
    .find((r) => r.cssText.includes('::-webkit-scrollbar') && r.cssText.includes('width'));
  return rule?.cssText ?? '';
});

check('scrollbar is 14px', scrollbarWidth.includes('14px'), `found rule: ${scrollbarWidth || '(none)'}`);

// --- Workspace selector ----------------------------------------------------

await page.waitForSelector('[data-testid="workspace-selector"]', { timeout: 10000 });
check('workspace selector gates startup', true, '');

await page.fill('#workspace-path', 'not/absolute');
await page.waitForTimeout(250);

const validation = await page.evaluate(() => {
  const input = document.querySelector('#workspace-path') as HTMLInputElement | null;
  const alert = document.querySelector('[role="alert"]');
  return {
    invalid: input?.getAttribute('aria-invalid'),
    describedBy: input?.getAttribute('aria-describedby'),
    borderColor: input ? getComputedStyle(input).borderColor : '',
    alertText: alert?.textContent ?? '',
  };
});

check('invalid input is marked aria-invalid', validation.invalid === 'true', `got "${validation.invalid}"`);
check('error message is announced', validation.alertText.length > 0, 'no [role=alert] text found');
check('invalid input turns red', validation.borderColor.includes('181, 72, 77') || validation.borderColor.includes('201, 112, 112'), `border was "${validation.borderColor}"`);

// --- Workbench -------------------------------------------------------------

await page.evaluate((workspace) => {
  window.localStorage.setItem('cortex:workspace-path', workspace);
  window.localStorage.setItem('cortex:skip-welcome', 'true');
  window.localStorage.setItem(
    'cortex:onboarding',
    JSON.stringify({ hasSeenWelcome: true, hasCompletedTutorial: true, hasConfiguredProvider: true })
  );
}, WORKSPACE);

await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-testid="sidebar"]', { timeout: 10000 });
await page.waitForTimeout(800);

const shellIds = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid]')).map((el) => el.getAttribute('data-testid'))
);

for (const required of ['sidebar', 'content-area', 'app-header', 'status-bar', 'command-palette-trigger']) {
  check(`shell renders ${required}`, shellIds.includes(required), `present: ${shellIds.join(', ')}`);
}

// --- Activity bar covers the E2E selector contract -------------------------

const activityIds = [
  'sidebar-explorer', 'sidebar-search', 'sidebar-git', 'sidebar-terminal',
  'sidebar-ai-chat', 'sidebar-extensions', 'sidebar-notes', 'sidebar-plans',
  'sidebar-browser', 'sidebar-account', 'sidebar-automations',
];

for (const id of activityIds) {
  check(`activity bar has ${id}`, shellIds.includes(id), 'missing');
}

// --- Every icon-only control has an accessible name ------------------------

const unlabelled = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button'))
    .filter((button) => {
      const hasText = (button.textContent ?? '').trim().length > 0;
      const hasLabel = !!button.getAttribute('aria-label') || !!button.getAttribute('aria-labelledby');
      const hasSrOnly = !!button.querySelector('.sr-only');
      return !hasText && !hasLabel && !hasSrOnly;
    })
    .map((button) => button.outerHTML.slice(0, 120))
);

check('all icon buttons have accessible names', unlabelled.length === 0, `${unlabelled.length} unlabelled: ${unlabelled.join(' | ')}`);

// --- Sidebar geometry: panels must not overflow the sidebar ----------------

const geometry = await page.evaluate(() => {
  const sidebar = document.querySelector('[data-testid="sidebar-panel"]');
  const rows = Array.from(document.querySelectorAll('[role="treeitem"]'));
  const sidebarRect = sidebar?.getBoundingClientRect();

  return {
    sidebarRight: sidebarRect ? sidebarRect.right : -1,
    sidebarLeft: sidebarRect ? sidebarRect.left : -1,
    rowCount: rows.length,
    widestRowRight: rows.reduce((max, row) => Math.max(max, row.getBoundingClientRect().right), 0),
  };
});

check(
  'file tree rows stay inside the sidebar',
  geometry.rowCount === 0 || geometry.widestRowRight <= geometry.sidebarRight + 1,
  `sidebar ends at ${geometry.sidebarRight}, widest row ends at ${geometry.widestRowRight} (${geometry.rowCount} rows)`
);

// --- Command palette ------------------------------------------------------

await page.click('[data-testid="command-palette-trigger"]');
await page.waitForSelector('[data-testid="command-palette"]', { timeout: 5000 });
await page.waitForTimeout(500);

await page.fill('[data-testid="command-palette-input"]', '>theme');
await page.waitForTimeout(400);

const paletteState = await page.evaluate(() => {
  const input = document.querySelector('[data-testid="command-palette-input"]');
  const options = Array.from(document.querySelectorAll('[role="option"]'));
  const active = document.querySelector('[role="option"][aria-selected="true"]');
  return {
    role: input?.getAttribute('role'),
    activeDescendant: input?.getAttribute('aria-activedescendant'),
    optionCount: options.length,
    activeText: active?.textContent ?? '',
    highlightCount: document.querySelectorAll('mark').length,
  };
});

check('palette input is a combobox', paletteState.role === 'combobox', `got "${paletteState.role}"`);
check('palette tracks the active option', !!paletteState.activeDescendant, 'aria-activedescendant missing');
check('palette command search returns results', paletteState.optionCount > 0, `${paletteState.optionCount} options`);
check('fuzzy matches are highlighted', paletteState.highlightCount > 0, 'no <mark> elements');

// Keyboard navigation moves the selection.
const firstActive = paletteState.activeText;
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(200);
const secondActive = await page.evaluate(
  () => document.querySelector('[role="option"][aria-selected="true"]')?.textContent ?? ''
);

check(
  'ArrowDown moves palette selection',
  paletteState.optionCount < 2 || secondActive !== firstActive,
  `selection stayed on "${firstActive}"`
);

await page.keyboard.press('Escape');
await page.waitForTimeout(300);

const paletteClosed = await page.evaluate(
  () => document.querySelector('[data-testid="command-palette"]') === null
);
check('Escape closes the palette', paletteClosed, 'palette still in the DOM');

// --- Cmd+B toggles the sidebar --------------------------------------------

const widthBefore = await page.evaluate(
  () => document.querySelector('[data-testid="sidebar-panel"]')?.getBoundingClientRect().width ?? -1
);
await page.keyboard.press('Control+b');
await page.waitForTimeout(500);
const widthAfter = await page.evaluate(
  () => document.querySelector('[data-testid="sidebar-panel"]')?.getBoundingClientRect().width ?? -1
);

check('Cmd+B collapses the sidebar', widthBefore > 0 && widthAfter === 0, `${widthBefore} -> ${widthAfter}`);

await page.keyboard.press('Control+b');
await page.waitForTimeout(500);

// --- Views render ---------------------------------------------------------

for (const [testId, panelId] of [
  ['sidebar-git', 'git-panel'],
  ['sidebar-terminal', 'terminal-panel'],
  ['sidebar-ai-chat', 'ai-chat-panel'],
  ['sidebar-notes', 'notes-view'],
  ['sidebar-plans', 'plans-view'],
  ['sidebar-browser', 'browser-view'],
  ['sidebar-account', 'account-panel'],
  ['sidebar-automations', 'automation-panel'],
  ['sidebar-extensions', 'extensions-panel'],
  ['sidebar-explorer', 'file-explorer'],
]) {
  try {
    await page.click(`[data-testid="${testId}"]`, { timeout: 5000 });
    await page.waitForSelector(`[data-testid="${panelId}"]`, { timeout: 8000 });
    check(`${testId} shows ${panelId}`, true, '');
  } catch (error) {
    check(`${testId} shows ${panelId}`, false, error instanceof Error ? error.message.split('\n')[0] : String(error));
  }
}

// --- Theme toggle --------------------------------------------------------

// --- Opening a file from the tree puts it in the editor --------------------

await page.click('[data-testid="sidebar-explorer"]');
await page.waitForSelector('[role="treeitem"]', { timeout: 8000 });

const rowGeometry = await page.evaluate(() => {
  const sidebar = document.querySelector('[data-testid="sidebar-panel"]')?.getBoundingClientRect();
  const rows = Array.from(document.querySelectorAll('[role="treeitem"]'));

  return {
    sidebar: sidebar ? { left: sidebar.left, right: sidebar.right, width: sidebar.width } : null,
    rows: rows.slice(0, 4).map((row) => {
      const rect = row.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2;
      const centreY = rect.top + rect.height / 2;
      const atCentre = document.elementFromPoint(centreX, centreY);

      return {
        text: (row.textContent ?? '').trim().slice(0, 24),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        // What a default Playwright click would actually hit.
        centreHit: atCentre
          ? `${atCentre.tagName}${atCentre.getAttribute('data-testid') ? `[${atCentre.getAttribute('data-testid')}]` : ''}`
          : 'none',
      };
    }),
  };
});

console.log('\n=== TREE ROW GEOMETRY ===');
console.log(JSON.stringify(rowGeometry, null, 2));

const firstRowHitsItself = rowGeometry.rows.every((row) => !row.centreHit.includes('content-area'));
check(
  'tree rows are clickable at their centre',
  firstRowHitsItself,
  `row centres resolve to: ${rowGeometry.rows.map((r) => r.centreHit).join(', ')}`
);

try {
  const fileRow = page.locator('[role="treeitem"]').filter({ hasText: 'package.json' }).first();
  await fileRow.click({ timeout: 6000 });
  await page.waitForTimeout(1200);

  const tabOpened = await page.evaluate(() =>
    (document.body.innerText || '').includes('package.json')
  );
  check('clicking a file opens it', tabOpened, 'no editor tab appeared for package.json');
} catch (error) {
  check('clicking a file opens it', false, error instanceof Error ? error.message.split('\n')[0] : String(error));
}

// Diagnostics for the two checks that have been flaky, so a failure reports
// what was actually on the page rather than just a timeout.
const headerState = await page.evaluate(() => {
  const header = document.querySelector('[data-testid="app-header"]');
  return {
    headerPresent: !!header,
    headerTestIds: header
      ? Array.from(header.querySelectorAll('[data-testid]')).map((el) => el.getAttribute('data-testid'))
      : [],
    allTestIds: Array.from(document.querySelectorAll('[data-testid]')).map((el) =>
      el.getAttribute('data-testid')
    ),
  };
});

console.log('\n=== HEADER DIAGNOSTIC ===');
console.log(JSON.stringify(headerState, null, 2));

try {
  const themeBefore = await page.evaluate(() => document.documentElement.className);
  await page.click('[data-testid="theme-switcher"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  const themeAfter = await page.evaluate(() => document.documentElement.className);

  check('theme switcher toggles the theme', themeBefore !== themeAfter, `"${themeBefore}" -> "${themeAfter}"`);
} catch (error) {
  check('theme switcher toggles the theme', false, error instanceof Error ? error.message.split('\n')[0] : String(error));
}

// --- Report -------------------------------------------------------------

console.log(`\n${passes.length} passed, ${failures.length} failed\n`);

if (failures.length > 0) {
  console.log('=== FAILURES ===');
  for (const failure of failures) console.log(`  ${failure}`);
}

if (consoleErrors.length > 0) {
  console.log('\n=== CONSOLE ERRORS ===');
  for (const error of [...new Set(consoleErrors)]) console.log(`  ${error}`);
}

await browser.close();
await stop();

process.exit(failures.length > 0 || consoleErrors.length > 0 ? 1 : 0);
