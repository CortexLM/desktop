/**
 * Renderer screenshot capture, without Electron.
 *
 * Electron refuses to start as root in this environment, so the usual E2E and
 * screenshot paths can't run. The renderer is a plain web bundle though: served
 * over HTTP with `window.cortex` stubbed, it renders exactly what the Electron
 * window would, which is enough to verify the UI and capture before/after
 * evidence.
 *
 * Usage: npx tsx scripts/capture-renderer-screenshots.ts [outputDir]
 */

import { chromium, type Page } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const DIST_DIR = join(process.cwd(), 'packages', 'renderer', 'dist');
const OUT_DIR = join(process.cwd(), process.argv[2] ?? 'screenshots/after');
const WORKSPACE = process.cwd();
const PORT = 4599;

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

/** Static file server for the built renderer. */
function serve() {
  const server = createServer(async (req, res) => {
    try {
      const rawPath = (req.url ?? '/').split('?')[0];
      const relative = rawPath === '/' ? 'index.html' : decodeURIComponent(rawPath).replace(/^\/+/, '');

      // Contain requests to the dist directory.
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
      resolve(
        () =>
          new Promise<void>((done) => {
            server.close(() => done());
          })
      )
    );
  });
}

/**
 * Stubs the preload bridge.
 *
 * Injected before any app script runs, so the first render already sees it.
 * Responses mirror the real IPC shapes (`{ success, data }`) closely enough
 * that views take their success paths and render real content.
 */
const CORTEX_STUB = `
(() => {
  const ok = (data) => Promise.resolve({ success: true, data });

  const FILES = {
    '__ROOT__': [
      { name: 'packages', path: '__ROOT__/packages', type: 'directory' },
      { name: 'scripts', path: '__ROOT__/scripts', type: 'directory' },
      { name: 'tests', path: '__ROOT__/tests', type: 'directory' },
      { name: '.git', path: '__ROOT__/.git', type: 'directory' },
      { name: 'node_modules', path: '__ROOT__/node_modules', type: 'directory' },
      { name: 'package.json', path: '__ROOT__/package.json', type: 'file' },
      { name: 'README.md', path: '__ROOT__/README.md', type: 'file' },
      { name: 'tsconfig.json', path: '__ROOT__/tsconfig.json', type: 'file' },
      { name: 'vite.config.ts', path: '__ROOT__/vite.config.ts', type: 'file' },
      { name: 'logo.svg', path: '__ROOT__/logo.svg', type: 'file' },
    ],
    '__ROOT__/packages': [
      { name: 'renderer', path: '__ROOT__/packages/renderer', type: 'directory' },
      { name: 'main', path: '__ROOT__/packages/main', type: 'directory' },
      { name: 'preload', path: '__ROOT__/packages/preload', type: 'directory' },
    ],
    '__ROOT__/packages/renderer': [
      { name: 'App.tsx', path: '__ROOT__/packages/renderer/App.tsx', type: 'file' },
      { name: 'CommandPalette.tsx', path: '__ROOT__/packages/renderer/CommandPalette.tsx', type: 'file' },
      { name: 'AppShell.tsx', path: '__ROOT__/packages/renderer/AppShell.tsx', type: 'file' },
      { name: 'EmptyState.tsx', path: '__ROOT__/packages/renderer/EmptyState.tsx', type: 'file' },
    ],
    '__ROOT__/scripts': [
      { name: 'capture-renderer-screenshots.ts', path: '__ROOT__/scripts/capture-renderer-screenshots.ts', type: 'file' },
    ],
    '__ROOT__/tests': [
      { name: 'workspace.spec.ts', path: '__ROOT__/tests/workspace.spec.ts', type: 'file' },
    ],
  };

  window.cortex = {
    fs: {
      readDir: ({ path }) => ok({ entries: FILES[path] ?? [] }),
      readFile: () => ok({ content: '// stub\\n', stats: { size: 9, mtime: Date.now(), ctime: Date.now() } }),
      writeFile: () => ok({ success: true, bytesWritten: 0 }),
      watch: () => Promise.resolve(),
      unwatch: () => Promise.resolve(),
      onFileChange: () => () => {},
    },
    editor: {
      openFile: ({ path }) => ok({
        content: [
          '/**',
          ' * ' + path,
          ' */',
          '',
          'export function greet(name: string): string {',
          '  return \`Hello, \${name}\`;',
          '}',
        ].join('\\n'),
        language: 'typescript',
      }),
      saveFile: () => ok({ success: true }),
      format: () => ok({ content: '' }),
    },
    git: {
      status: () => ok({
        branch: 'main',
        ahead: 2,
        behind: 1,
        isClean: false,
        files: [
          { path: 'packages/renderer/src/App.tsx', status: 'modified', staged: true },
          { path: 'packages/renderer/src/components/layout/AppShell.tsx', status: 'added', staged: true },
          { path: 'packages/renderer/src/components/CommandPalette.tsx', status: 'added', staged: false },
          { path: 'packages/renderer/src/styles/globals.css', status: 'modified', staged: false },
          { path: 'notes.txt', status: 'untracked', staged: false },
        ],
      }),
      commit: () => ok({ hash: 'abc1234' }),
      push: () => ok({ pushed: true }),
      pull: () => ok({ pulled: true }),
      diff: () => ok({ diff: '' }),
    },
    ai: {
      createSession: () => ok({ sessionId: 'stub-session', providerId: 'anthropic', createdAt: Date.now() }),
      sendMessage: () => ok({ content: 'stub', model: 'stub', usage: {} }),
      streamResponse: () => Promise.resolve(),
      stopStream: () => Promise.resolve(),
    },
    // on* members must return an unsubscribe function; everything else returns
    // an IPC response.
    mcp: new Proxy({}, {
      get: (_t, k) => (typeof k === 'string' && k.startsWith('on')
        ? () => () => {}
        : () => ok({ servers: [], tools: [], permissions: [] })),
    }),
    terminal: {
      create: () => ok({ terminalId: 't1' }),
      input: () => ok({}),
      resize: () => ok({}),
      kill: () => ok({}),
      onData: () => () => {},
      onExit: () => () => {},
    },
    db: { query: () => ok({ rows: [] }), execute: () => ok({ changes: 0 }) },
    automation: new Proxy({}, {
      get: (_t, key) => (typeof key === 'string' && key.startsWith('on') ? () => () => {} : () => ok({ automations: [], logs: [] })),
    }),
    update: {
      check: () => Promise.resolve({ success: true }),
      download: () => Promise.resolve({ success: true }),
      install: () => Promise.resolve({ success: true }),
      // UpdateNotification subscribes to all six on mount and calls the
      // returned unsubscribe on cleanup, so each must return a function.
      onChecking: () => () => {},
      onAvailable: () => () => {},
      onNotAvailable: () => () => {},
      onDownloadProgress: () => () => {},
      onDownloaded: () => () => {},
      onError: () => () => {},
    },
    invoke: () => ok({}),
  };

  // Views using lib/ipc.ts call window.electron.invoke and unwrap
  // { success, data } themselves, so responses are routed per channel.
  const ELECTRON_RESPONSES = {
    'git:status': {
      branch: 'main', ahead: 2, behind: 1, isClean: false,
      files: [
        { path: 'packages/renderer/src/App.tsx', status: 'modified', staged: true },
        { path: 'packages/renderer/src/components/layout/AppShell.tsx', status: 'added', staged: true },
        { path: 'packages/renderer/src/components/CommandPalette.tsx', status: 'added', staged: false },
        { path: 'packages/renderer/src/styles/globals.css', status: 'modified', staged: false },
        { path: 'notes.txt', status: 'untracked', staged: false },
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

  window.electron = { invoke: (channel) => ok(ELECTRON_RESPONSES[channel] ?? {}) };
})();
`;

interface Shot {
  name: string;
  description: string;
  setup?: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  {
    name: '01-workspace-selector',
    description: 'Startup gate: pick a folder',
    setup: async (page) => {
      await page.evaluate(() => window.localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-testid="workspace-selector"]');
    },
  },
  {
    name: '02-workspace-selector-validation',
    description: 'Inline validation on a bad path',
    setup: async (page) => {
      await page.fill('#workspace-path', 'relative/path');
      await page.waitForTimeout(200);
    },
  },
  {
    name: '03-explorer-empty-editor',
    description: 'Workbench: explorer + no files open',
    setup: async (page) => {
      await seedWorkspace(page);
      await page.waitForSelector('[data-testid="sidebar"]');
      await page.waitForSelector('[data-testid="editor-empty-state"]');
    },
  },
  {
    name: '04-explorer-tree',
    description: 'File tree with a directory expanded',
    setup: async (page) => {
      await page.click('[data-testid="sidebar-explorer"]');
      await page.waitForSelector('[role="treeitem"]', { timeout: 10000 });
      // Clicked at an explicit offset near the row's label. react-arborist rows
      // are full-width, so Playwright's default centre point can land outside
      // the sidebar where the main area swallows the click.
      const packages = page.locator('[role="treeitem"]', { hasText: 'packages' }).first();
      await packages.click({ position: { x: 40, y: 12 }, timeout: 10000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: '05-editor-open-file',
    description: 'File opened in the editor via the command palette',
    setup: async (page) => {
      // Opened through the palette rather than the tree: it exercises the
      // palette's file-open path end to end, and doesn't depend on a given row
      // being scrolled into view.
      await page.click('[data-testid="command-palette-trigger"]');
      await page.waitForSelector('[data-testid="command-palette-input"]', { timeout: 10000 });
      await page.fill('[data-testid="command-palette-input"]', 'package.json');
      await page.waitForTimeout(600);
      await page.keyboard.press('Enter');
      // Monaco is lazily loaded, so allow for the chunk fetch plus first paint.
      await page.waitForTimeout(3500);
    },
  },
  {
    name: '06-command-palette-files',
    description: 'Command palette: file search',
    setup: async (page) => {
      await page.click('[data-testid="command-palette-trigger"]');
      await page.waitForSelector('[data-testid="command-palette"]');
      await page.waitForTimeout(600);
    },
  },
  {
    name: '07-command-palette-fuzzy',
    description: 'Fuzzy match with highlighted characters',
    setup: async (page) => {
      await page.fill('[data-testid="command-palette-input"]', 'apptsx');
      await page.waitForTimeout(400);
    },
  },
  {
    name: '08-command-palette-commands',
    description: 'Command mode via the > prefix',
    setup: async (page) => {
      await page.fill('[data-testid="command-palette-input"]', '>theme');
      await page.waitForTimeout(400);
    },
  },
  {
    name: '09-git-panel',
    description: 'Source control with staged and unstaged changes',
    setup: async (page) => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.click('[data-testid="sidebar-git"]');
      await page.waitForSelector('[data-testid="git-panel"]');
      await page.waitForTimeout(700);
    },
  },
  {
    name: '10-ai-chat-empty',
    description: 'AI chat empty state with a CTA',
    setup: async (page) => {
      await page.click('[data-testid="sidebar-ai-chat"]');
      await page.waitForSelector('[data-testid="ai-chat-panel"]');
      await page.waitForTimeout(700);
    },
  },
  {
    name: '11-sidebar-collapsed',
    description: 'Cmd+B collapses the sidebar',
    setup: async (page) => {
      await page.click('[data-testid="sidebar-explorer"]');
      await page.waitForTimeout(300);
      await page.keyboard.press('Control+b');
      await page.waitForTimeout(500);
    },
  },
  {
    name: '12-light-theme',
    description: 'Light theme',
    setup: async (page) => {
      await page.keyboard.press('Control+b');
      await page.waitForTimeout(300);
      await page.click('[data-testid="theme-switcher"]');
      await page.waitForTimeout(600);
    },
  },
];

async function seedWorkspace(page: Page) {
  await page.evaluate((workspace) => {
    window.localStorage.setItem('cortex:workspace-path', workspace);
    window.localStorage.setItem('cortex:skip-welcome', 'true');
    window.localStorage.setItem(
      'cortex:onboarding',
      JSON.stringify({ hasSeenWelcome: true, hasCompletedTutorial: true, hasConfiguredProvider: true })
    );
  }, WORKSPACE);

  await page.reload({ waitUntil: 'load' });
}

const stop = await serve();
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});

const page = await context.newPage();

const consoleErrors: string[] = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => consoleErrors.push(`[pageerror] ${error.message}`));

await page.addInitScript(CORTEX_STUB.replace(/__ROOT__/g, WORKSPACE));
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const captured: string[] = [];

for (const shot of SHOTS) {
  try {
    await shot.setup?.(page);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`) });
    captured.push(`${shot.name} - ${shot.description}`);
    console.log(`captured ${shot.name}`);
  } catch (error) {
    console.error(`FAILED ${shot.name}: ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`\n${captured.length}/${SHOTS.length} screenshots written to ${OUT_DIR}`);

if (consoleErrors.length > 0) {
  console.log('\n=== CONSOLE ERRORS ===');
  console.log([...new Set(consoleErrors)].join('\n'));
} else {
  console.log('\nNo console errors.');
}

await browser.close();
await stop();
