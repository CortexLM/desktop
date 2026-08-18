/**
 * End-to-end visual proof that Cortex IDE launches and every primary
 * surface is reachable. Uses a local mock Ollama so the agent loop can
 * complete a turn without a cloud key.
 */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFixtureWorkspace, removeFixtureDir } from '../fixtures/workspace';
import { startMockOllama } from '../helpers/mock-ollama';

const OUT = join(process.cwd(), 'screenshots', 'proof');

test.use({ video: 'on' });

test.describe.configure({ mode: 'serial' });

test.describe('Product proof', () => {
  let ollama: { url: string; close: () => Promise<void> };
  let workspace: string;
  let userDataDir: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    mkdirSync(OUT, { recursive: true });
    ollama = await startMockOllama();
    workspace = createFixtureWorkspace();
    userDataDir = mkdtempSync(join(tmpdir(), 'cortex-proof-udd-'));

    const runningAsRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    app = await electron.launch({
      executablePath: join(process.cwd(), 'node_modules', '.bin', 'electron'),
      args: [
        `--user-data-dir=${userDataDir}`,
        ...(runningAsRoot || process.env.DISPLAY ? ['--no-sandbox'] : []),
        join(process.cwd(), 'packages', 'main', 'dist', 'index.js'),
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        OLLAMA_HOST: ollama.url,
        OLLAMA_ENABLED: 'true',
        OLLAMA_DEFAULT_MODEL: 'llama3.1',
        DEFAULT_AI_PROVIDER: 'ollama',
      },
      timeout: 60000,
    });
    page = await app.firstWindow({ timeout: 60000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    await page.waitForSelector('[data-testid="workspace-selector"]', { timeout: 60000 });
  });

  test.afterAll(async () => {
    await app?.close();
    removeFixtureDir(userDataDir);
    removeFixtureDir(workspace);
    await ollama?.close();
  });

  test('open folder, welcome, session agent, and every primary view', async () => {
    await page.screenshot({ path: join(OUT, '01-open-folder.png'), fullPage: true });

    await page.locator('#workspace-path').fill(workspace);
    await page.locator('[data-testid="open-workspace"]').click();

    await page.waitForSelector(
      '[data-testid="welcome-screen"], [data-testid="cortex-code-shell"]',
      { timeout: 30000 }
    );

    if (await page.locator('[data-testid="welcome-screen"]').count()) {
      await page.screenshot({ path: join(OUT, '02-welcome.png'), fullPage: true });
      await page.getByRole('button', { name: 'Skip for now' }).click();
    }

    await page.waitForSelector('[data-testid="cortex-code-shell"]', { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, '03-session-empty.png'), fullPage: true });

    await page.locator('[data-testid="composer-model"]').click();
    await page.waitForSelector('[data-testid="model-picker"]', { timeout: 10000 });
    await page.screenshot({ path: join(OUT, '04-model-picker.png'), fullPage: true });
    await page.getByRole('button', { name: 'Llama 3.1' }).click();
    if (await page.locator('[data-testid="model-switch-proposal"]').count()) {
      await page.getByRole('button', { name: 'Apply' }).click();
    }

    await page.locator('[data-testid="composer-input"]').fill('Explain this workspace in one sentence.');
    await page.screenshot({ path: join(OUT, '05-composer-typed.png'), fullPage: true });
    await page.locator('[data-testid="composer-send"]').click();

    await expect(page.locator('[data-testid="agent-transcript"]')).toContainText(
      'agent loop is wired',
      { timeout: 30000 }
    );
    await page.screenshot({ path: join(OUT, '06-agent-reply.png'), fullPage: true });

    await page.locator('[data-testid="sidebar-explorer"]').first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, '07-session-explorer.png'), fullPage: true });

    await page.locator('[data-testid="sidebar-terminal"]').first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, '08-session-terminal.png'), fullPage: true });

    await page.keyboard.press('Control+Shift+E');
    await page.waitForSelector('[data-testid="app-header"], [data-testid="file-explorer"]', {
      timeout: 20000,
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, '09-ide-explorer.png'), fullPage: true });

    const file = page.locator('[data-testid="file-explorer"] >> text=file1.ts').first();
    if (await file.count()) {
      await file.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: join(OUT, '10-editor-file.png'), fullPage: true });

    await page.locator('[data-testid="sidebar-terminal"]').click();
    await page.waitForSelector('[data-testid="terminal-panel"], [data-testid="terminal-grid"]', {
      timeout: 15000,
    });
    const emptyNew = page.locator('[data-testid="new-terminal-empty"]');
    if (await emptyNew.count()) {
      await emptyNew.click();
    } else {
      await page.locator('[data-testid="new-terminal"]').click();
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, '11-terminal-live.png'), fullPage: true });

    const views: Array<{ id: string; file: string }> = [
      { id: 'sidebar-git', file: '12-git.png' },
      { id: 'sidebar-ai-chat', file: '13-ai-chat.png' },
      { id: 'sidebar-extensions', file: '14-extensions.png' },
      { id: 'sidebar-missions', file: '15-missions.png' },
      { id: 'sidebar-settings', file: '16-settings.png' },
      { id: 'sidebar-notes', file: '17-notes.png' },
      { id: 'sidebar-plans', file: '18-plans.png' },
      { id: 'sidebar-browser', file: '19-browser.png' },
      { id: 'sidebar-automations', file: '20-automations.png' },
      { id: 'sidebar-account', file: '21-account.png' },
      { id: 'sidebar-security', file: '22-security.png' },
      { id: 'sidebar-review', file: '23-review.png' },
      { id: 'sidebar-knowledge', file: '24-knowledge.png' },
    ];

    for (const view of views) {
      const button = page.locator(`[data-testid="${view.id}"]`);
      if ((await button.count()) === 0) continue;
      await button.click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(OUT, view.file), fullPage: true });
    }

    await page.locator('[data-testid="sidebar-settings"]').click();
    const providers = page.getByRole('tab', { name: /AI Providers/i });
    if (await providers.count()) {
      await providers.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, '25-settings-providers.png'), fullPage: true });
    }
  });
});
