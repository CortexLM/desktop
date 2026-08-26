import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Paper parity captures.
 *
 * Separate from playwright.config.ts, which launches Electron and drives the packaged app.
 * These tests render the renderer on its own in a browser, which is the only way to set an
 * exact viewport per screen - an Electron window's size is negotiated with the OS, and the
 * artboards are specified to the pixel.
 *
 * `deviceScaleFactor: 1` is explicit: the default follows the host, and a 2x host would
 * produce captures at twice the artboard size.
 */
export default defineConfig({
  testDir: './tests/visual',
  // Scoped to this one spec. The other files in tests/visual drive the React renderer this
  // work replaces, and they run under the Electron config until that renderer is removed.
  testMatch: 'paper-parity.spec.ts',

  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,

  reporter: [
    ['html', { outputFolder: 'test-results/visual-report', open: 'never' }],
    ['list'],
  ],

  // Vite's preview server over the built bundle rather than the dev server: a capture should
  // reflect what ships, and dev-mode style injection differs from the built stylesheet.
  webServer: {
    command: 'bun run --filter @cortex-ide/app build && bun run --filter @cortex-ide/app preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },

  use: {
    baseURL: 'http://localhost:4173',
    deviceScaleFactor: 1,
    screenshot: 'off',
    video: 'off',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },

  outputDir: 'test-results/visual-artifacts',
});
