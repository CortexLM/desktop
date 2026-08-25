/**
 * The desktop app, end to end: Electron main -> preload bridge -> SolidJS renderer.
 *
 * This is the spec that would have caught the two failures that made "it runs under
 * Electron" untrue while every unit test stayed green:
 *
 *   1. **The wrong renderer.** `main` loaded `packages/renderer/dist/index.html` (the old
 *      React UI) long after `packages/app` became the real one. Nothing in the unit suites
 *      reads that path, so nothing noticed.
 *   2. **A renderer that cannot reach the API.** The account context called
 *      `api.cortex.foundation` directly and swallowed the failure. From a `file://` origin
 *      every one of those calls fails the CORS check, so the model picker was permanently
 *      empty — and looked exactly like "signed out", which is a state the app is supposed
 *      to support.
 *
 * So the assertions here are deliberately about the seams rather than about pixels: which
 * document loaded, whether the bridge exists, whether a channel round-trips, and whether a
 * hash route survives a reload. Layout is covered by the Paper parity suite.
 */

import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

/** The envelope every IPC handler returns. */
type Envelope<T> = { success: true; data: T } | { success: false; error: { message: string } };

/**
 * Calls a `cortex.*` bridge method from inside the renderer.
 *
 * Goes through `window.cortex` rather than Playwright's `electronApp.evaluate`, because the
 * bridge is the thing under test: reaching into main directly would pass even if the preload
 * never exposed anything.
 */
async function viaBridge<T>(page: Page, method: string): Promise<Envelope<T>> {
  return page.evaluate(async (name) => {
    const bridge = (window as unknown as { cortex?: { cortex?: Record<string, () => unknown> } })
      .cortex?.cortex;
    if (!bridge) throw new Error('window.cortex.cortex is not exposed');
    return (await bridge[name]()) as Envelope<T>;
  }, method);
}

test.describe('the app Electron loads', () => {
  test('is the SolidJS renderer, not the retired React one', async ({ page }) => {
    // `#root` with the Solid bundle attached. The React app mounted a different tree, so
    // this fails loudly if `main` is pointed back at the old dist.
    await expect(page.locator('#root')).toBeAttached();

    // The workspace chrome the design draws: a navigation rail with the primary
    // destinations. Asserted by role and name so it survives class renames.
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sessions' })).toBeVisible();
  });

  test('is usable with no account at all', async ({ page }) => {
    // The anonymous path is a product requirement, not a fallback: the composer has to be
    // reachable without signing in.
    await expect(page.getByPlaceholder(/Describe a task/i)).toBeVisible();
  });

  test('gates what an account is needed for, and says why', async ({ page }) => {
    // Locked rather than hidden: hiding these would make the signed-out app look like a
    // smaller product, whereas a locked row advertises what an account adds. The tooltip is
    // what makes the dead click explicable.
    for (const label of ['Automations', 'Review', 'Usage']) {
      const item = page.getByRole('button', { name: label });
      await expect(item).toBeDisabled();
      await expect(item).toHaveAttribute('title', new RegExp(`Sign in to Cortex to use ${label}`));
    }

    // And the destinations that need nothing stay usable.
    await expect(page.getByRole('button', { name: 'Home' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Sessions' })).toBeEnabled();
  });

  test('keeps a typed prompt when you leave Home and come back', async ({ page }) => {
    // The draft used to live in the route's own scope, which Solid disposes on navigation, so
    // checking Sessions mid-thought silently emptied the composer.
    const composer = page.getByPlaceholder(/Describe a task/i);
    await composer.fill('Fix the flaky auth test');

    await page.getByRole('button', { name: 'Sessions' }).click();
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

    await page.getByRole('button', { name: 'Home' }).click();

    await expect(page.getByPlaceholder(/Describe a task/i)).toHaveValue(
      'Fix the flaky auth test',
    );
  });

  test('opens at the viewport the design is drawn at', async ({ page }) => {
    const size = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));

    // Every Paper artboard is 1440x900, and `createWindow` asks for exactly that. A window
    // that opened narrower would show a reflowed approximation of the layout rather than
    // the layout, which is the sort of difference nobody files a bug about.
    //
    // Asserted as a lower bound: a display smaller than the requested size clamps the
    // window, and that is the environment's constraint rather than a regression. The point
    // is that nothing in the app narrows it.
    expect(size.width).toBeGreaterThanOrEqual(1000);
    expect(size.height).toBeGreaterThanOrEqual(600);
  });

  test('exposes the preload bridge', async ({ page }) => {
    const namespaces = await page.evaluate(() => {
      const api = (window as unknown as { cortex?: Record<string, unknown> }).cortex;
      return api ? Object.keys(api).sort() : null;
    });

    // A sandboxed preload has to be CommonJS and the path in `webPreferences` has to match
    // the emitted `.cjs`. Pointing at `.js` loads nothing at all, silently: `window.cortex`
    // stays undefined and the renderer degrades instead of erroring.
    expect(namespaces).not.toBeNull();
    expect(namespaces).toContain('cortex');
  });
});

test.describe('the Cortex account channels', () => {
  test('answer with no payload, as the bridge invokes them', async ({ page }) => {
    // The bridge calls `invoke(channel)` with no argument, so main receives `undefined`.
    // A strict object schema would reject every call — at runtime only.
    const state = await viaBridge<{ user: unknown; reachable: boolean }>(page, 'getState');

    expect(state.success).toBe(true);
    if (!state.success) return;
    expect(state.data).toHaveProperty('reachable');
  });

  test('carry the model catalogue across the process boundary', async ({ page }) => {
    const response = await viaBridge<{ models: { id: string }[]; error?: string }>(
      page,
      'listModels',
    );

    expect(response.success).toBe(true);
    if (!response.success) return;

    // Either the catalogue loaded or it says why. Both are valid — `/v1/models` is public
    // but the network may not be — and the pair is what makes this assertion impossible to
    // satisfy vacuously. Before this wiring existed the renderer produced an empty list
    // with no error, which is the one combination ruled out here.
    const { models, error } = response.data;
    expect(Array.isArray(models)).toBe(true);
    expect(models.length > 0 || (error ?? '').length > 0).toBe(true);
  });

  test('report a signed-out session rather than a token', async ({ page }) => {
    const state = await viaBridge<Record<string, unknown>>(page, 'getState');

    expect(state.success).toBe(true);
    if (!state.success) return;

    // The invariant the whole design rests on: main holds the session, the renderer is
    // told who is signed in and nothing more.
    expect(JSON.stringify(state.data)).not.toMatch(/accessToken|access_token/);
  });
});

test.describe('routing from a file:// origin', () => {
  test('serves a nested route on reload instead of 404ing', async ({ page }) => {
    // The reason the app routes on the hash. `/sign-in/device` is not a resolvable file, so
    // a history router would make Electron fail the load outright — on first navigation and
    // on every reload after it.
    await page.evaluate(() => {
      window.location.hash = '#/sign-in/device';
    });
    await expect(page.getByRole('heading', { name: /Approve this device/i })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Approve this device/i })).toBeVisible();
    expect(page.url()).toContain('#/sign-in/device');
  });

  test('starts a real device flow rather than showing a placeholder code', async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#/sign-in/device';
    });

    // The screen used to render a hard-coded '--------' forever. Now it either shows a code
    // the service issued or says the flow could not start; both are honest, and the
    // placeholder is neither.
    const code = page.locator('.cx-device__code');
    const status = page.locator('.cx-device__status');

    await expect(status).toBeVisible();
    await expect
      .poll(async () => {
        const text = (await code.textContent())?.trim() ?? '';
        if (/^[A-Z0-9-]{4,}$/.test(text)) return 'issued';
        const statusText = (await status.textContent()) ?? '';
        return /could not be started/i.test(statusText) ? 'reported' : 'pending';
      }, { timeout: 20000 })
      .not.toBe('pending');

    expect(await code.textContent()).not.toContain('--------');
  });
});
