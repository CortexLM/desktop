import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'path';

/**
 * Electron fixture for launching Cortex Code.
 *
 * Every test gets its own Electron `userData` directory. It used to be shared across the
 * four parallel workers and it leaked: `localStorage` and the SQLite file carried between
 * launches, which is how one spec came to count four open tabs instead of three once the
 * editor store started persisting them.
 *
 * That matters more now, not less: `userData` is where the Cortex session token is
 * persisted, so a shared directory would let one test's sign-in state decide what another
 * test sees.
 */
export interface ElectronFixtures {
  /** This test's private Electron `userData` directory. */
  userDataDir: string;
  electronApp: ElectronApplication;
  page: Page;
}

/**
 * Removes a disposable directory created for one test.
 *
 * `maxRetries` covers the userData case: Electron has just been asked to close, and on a
 * slow machine a Crashpad handler or a cache writer can still hold a file open for a few
 * milliseconds after `app.close()` resolves. Cleanup is best-effort by design — a leftover
 * temp directory is noise, whereas throwing here would fail a test that already passed.
 */
function removeFixtureDir(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    console.warn(
      `⚠️  Could not remove the fixture directory ${path}:`,
      error instanceof Error ? error.message : error
    );
  }
}

export const test = base.extend<ElectronFixtures>({
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

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow({ timeout: 60000 });

    await page.waitForLoadState('domcontentloaded', { timeout: 60000 });

    // The renderer mounts into `#root`, so waiting on `body` would return before there is
    // anything to assert against.
    //
    // Nothing is seeded into `localStorage` here. The retired React renderer gated its
    // workbench behind `cortex:workspace-path` and a set of onboarding flags, which this
    // fixture had to fake before any view was reachable. The current renderer opens
    // straight onto a usable, signed-out workspace — being usable with no account is a
    // product requirement — so there is no gate left to unlock, and faking one would test
    // a state the app no longer has.
    await page.waitForSelector('#root', { timeout: 60000 });

    await use(page);
  }
});

export { expect } from '@playwright/test';
