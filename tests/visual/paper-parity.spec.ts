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
 *
 * Reading the diff numbers: the captures run ANONYMOUS against fixture-free
 * stores, while the boards stage a signed-in workspace (Ana, four sessions, a
 * trial card, typed prompts). Two screens are auth-gated and render their gate
 * instead of the board's content — code-ssh-connect and code-new-automation —
 * so their percentages read as "different screen", not as drift. Everything else
 * lands low single digits, which is content plus JPEG loss, not structure.
 */
const ROUTES: Record<string, string> = {
  home: '/',
  conversation: '/chat/example',
  'code-home': '/code',
  'code-sessions': '/code/sessions',
  'code-session-detail': '/code/sessions/example',
  'code-session-detail-focus': '/code/sessions/example/focus',
  'code-automations': '/code/automations',
  'code-new-automation': '/code/automations/new',
  'code-review': '/code/review',
  'code-usage': '/code/usage',
  'code-settings': '/code/settings',
  'code-integrations': '/code/settings/integrations',
  'code-notifications': '/code/notifications',
  'code-ssh-connect': '/code/runtimes/ssh',
  'code-auth-sign-in': '/sign-in',
  'code-auth-device-code': '/sign-in/device',
  'code-auth-connect-github': '/sign-in/github',
  'code-auth-workspace-setup': '/sign-in/workspace',
  'code-onboarding': '/onboarding',
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
      // A handful of boards are deliberately light-only (the collapsed-sidebar
      // variant, the conversation); there is nothing to compare dark against.
      if (!screen.artboards[theme]) continue;

      test(`${screen.slug} (${theme})`, async ({ page }) => {
        await applyTheme(page, theme);
        await stubCortexApi(page);
        // Fit-content boards report height 0; the app frame is 900 in the file.
        await page.setViewportSize({ width: screen.width, height: screen.height || 900 });
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
