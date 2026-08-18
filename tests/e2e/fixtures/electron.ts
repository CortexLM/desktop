import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'path';

import { createFixtureWorkspace, removeFixtureDir } from './workspace';

/**
 * Electron fixture for launching Cortex IDE.
 *
 * Every test gets its own workspace directory AND its own Electron `userData`
 * directory. Both were previously shared across the four parallel workers, and
 * both leaked:
 *
 *   - the shared Git repo made execution order part of the contract (see
 *     `workspace.ts` for the detail);
 *   - the shared `userData` carried localStorage between launches, which is how
 *     'should manage multiple tabs' came to count 4 tabs instead of 3 once the
 *     editor store started persisting open tabs.
 */
export interface ElectronFixtures {
  /** This test's private workspace: a freshly seeded Git repo. */
  workspacePath: string;
  /** This test's private Electron `userData` directory. */
  userDataDir: string;
  electronApp: ElectronApplication;
  page: Page;
}

export const test = base.extend<ElectronFixtures>({
  workspacePath: async ({}, use) => {
    const workspace = createFixtureWorkspace();
    await use(workspace);
    removeFixtureDir(workspace);
  },

  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'cortex-e2e-udd-'));
    await use(dir);
    // After `electronApp`'s own teardown: Playwright disposes fixtures in
    // reverse dependency order, so the app is already closed by the time this
    // runs and nothing is still writing here.
    removeFixtureDir(dir);
  },

  electronApp: async ({ userDataDir }, use) => {
    // Path to the built Electron main process
    const electronPath = join(process.cwd(), 'node_modules', '.bin', 'electron');
    const mainPath = join(process.cwd(), 'packages', 'main', 'dist', 'index.js');

    // Chromium refuses to start as root unless the sandbox is disabled:
    // "Running as root without --no-sandbox is not supported" is a FATAL abort,
    // so `firstWindow()` can only ever time out. CI containers commonly run as
    // root, hence the flag — but it lives here, in the test launcher, and never
    // in the app itself. Real users keep their sandbox.
    const runningAsRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    // Headless Cloud VMs need this even when not root (no user namespace).

    // `--user-data-dir` is what makes this launch's state private. Verified by
    // probe rather than assumed: with the flag, `app.getPath('userData')`
    // reports the directory passed here (default is /root/.config/Electron),
    // and `cortex-ide.db` plus `Local Storage/` are created inside it.
    //
    // It precedes `mainPath` because Electron treats the first non-flag
    // argument as the app path and passes everything after it to the app.
    const launchArgs = [
      `--user-data-dir=${userDataDir}`,
      ...(runningAsRoot || process.env.DISPLAY ? ['--no-sandbox'] : []),
      mainPath,
    ];

    // Launch Electron app
    const app = await electron.launch({
      executablePath: electronPath,
      args: launchArgs,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
      },
      timeout: 60000 // Increase timeout to 60s
    });

    // Wait for the app to be ready with increased timeout
    await app.firstWindow({ timeout: 60000 });

    await use(app);

    // Cleanup: close the app
    await app.close();
  },

  page: async ({ electronApp, workspacePath }, use) => {
    // Get the first window
    const page = await electronApp.firstWindow({ timeout: 60000 });

    // Wait for the app to be fully loaded
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 });

    // Optional: wait for specific element to ensure app is ready
    await page.waitForSelector('body', { timeout: 60000 });

    // The app asks for a folder before showing the workbench, so seed one and
    // reload. Without this every test would stall on the workspace selector
    // instead of reaching the view under test.
    //
    // Onboarding flags are set at the same time: the welcome modal overlays the
    // workbench and would intercept clicks on the views being tested.
    //
    // No editor-session cleanup is needed here any more. `userData` is private
    // to this launch, so localStorage starts empty and there is no previous
    // spec's session to inherit — the `addInitScript` that used to clear
    // `cortex:editor-session` was working around the shared directory that this
    // fixture no longer uses.
    await page.evaluate((workspace) => {
      window.localStorage.setItem('cortex:workspace-path', workspace);
      window.localStorage.setItem('cortex:skip-welcome', 'true');
      window.localStorage.setItem(
        'cortex:onboarding',
        JSON.stringify({
          hasSeenWelcome: true,
          hasCompletedTutorial: true,
          hasConfiguredProvider: true,
        })
      );
    }, workspacePath);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });

    await use(page);
  }
});

export { expect } from '@playwright/test';
