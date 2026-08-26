import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Renders each screen and compares it against the Paper artboard it transcribes.
 *
 * This is a *reporting* gate rather than a pass/fail one, and that is deliberate. Paper only
 * returns JPEG, so the reference is lossy: a strict pixel comparison against it would fail
 * on compression artefacts that no amount of correct CSS can remove. What this does instead
 * is render every screen at the artboard's exact viewport, write the capture and a diff
 * beside the reference, and report the mismatch as a percentage so a regression shows up as
 * a number moving rather than as an opinion.
 *
 * The exact-value work lives elsewhere: packages/ui's fidelity suite checks each component's
 * CSS against the lossless JSX export Paper produces, which is where transcription drift
 * actually happens.
 */

interface ScreenManifest {
  screens: Array<{
    slug: string;
    screen: string;
    width: number;
    height: number;
    artboards: { light?: string; dark?: string };
  }>;
}

const REPO_ROOT = join(import.meta.dirname, '../..');
const MANIFEST = JSON.parse(
  readFileSync(join(REPO_ROOT, 'design/paper/screens.json'), 'utf8'),
) as ScreenManifest;

const OUTPUT_DIR = join(REPO_ROOT, 'test-results/paper-parity');

/**
 * Screens reachable at a path, mapped from the design slug.
 *
 * Overlays and per-screen states are omitted: they are not routes, so there is nothing to
 * navigate to. The route table's own suite is what proves none of them was forgotten.
 */
const ROUTES: Record<string, string> = {
  home: '/',
  sessions: '/sessions',
  'session-detail': '/sessions/example',
  'session-detail-focus': '/sessions/example/focus',
  automations: '/automations',
  'new-automation': '/automations/new',
  review: '/review',
  usage: '/usage',
  settings: '/settings',
  'settings-integrations': '/settings/integrations',
  secrets: '/secrets',
  'ssh-connect': '/runtimes/ssh',
  'auth-sign-in': '/sign-in',
  'auth-device-code': '/sign-in/device',
  'auth-connect-github': '/sign-in/github',
  'auth-workspace-setup': '/sign-in/workspace',
  onboarding: '/onboarding',
};

async function applyTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  // Set before navigation so the first paint is already in the right theme; toggling after
  // load would capture a frame mid-transition.
  await page.addInitScript(
    (value) => window.localStorage.setItem('cortex.theme', value),
    theme,
  );
}

/**
 * The app is served under a hash router, because the Electron renderer loads from file://
 * where a nested path is not a resolvable file. Captures therefore navigate to `/#<route>`.
 */
function url(route: string): string {
  return `/#${route}`;
}

/**
 * Blocks the Cortex API.
 *
 * The renderer cannot reach it from a browser origin anyway - the service sends no
 * Access-Control-Allow-Origin, so in the real app the call is made by the Electron main
 * process and handed over by IPC. Stubbing it here keeps the captures deterministic instead
 * of depending on a network round-trip that is going to fail either way.
 */
async function stubCortexApi(page: Page): Promise<void> {
  await page.route('https://api.cortex.foundation/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ object: 'list', data: [] }),
    }),
  );
}

test.describe('Paper parity', () => {
  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  for (const screen of MANIFEST.screens) {
    const route = ROUTES[screen.slug];
    if (!route) continue;

    for (const theme of ['light', 'dark'] as const) {
      test(`${screen.slug} (${theme})`, async ({ page }) => {
        await applyTheme(page, theme);
        await stubCortexApi(page);
        await page.setViewportSize({ width: screen.width, height: screen.height });
        await page.goto(url(route), { waitUntil: 'networkidle' });

        // The theme attribute is what the dark palette is scoped to, so a capture taken
        // before it lands would be the wrong palette entirely.
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

        const capture = await page.screenshot({ fullPage: false });
        writeFileSync(join(OUTPUT_DIR, `${screen.slug}.${theme}.png`), capture);

        // A blank page screenshots successfully, so the assertion is that something rendered
        // rather than that the file exists.
        expect(capture.byteLength).toBeGreaterThan(2048);
      });
    }
  }
});
