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

/** Switches the shell to the Code product and waits for its sidebar. */
async function openCode(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.location.hash = '#/code';
  });
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
}

test.describe('the app Electron loads', () => {
  test('is the SolidJS renderer, not the retired React one', async ({ page }) => {
    // `#root` with the Solid bundle attached. The React app mounted a different tree, so
    // this fails loudly if `main` is pointed back at the old dist.
    await expect(page.locator('#root')).toBeAttached();

    // The C3 shell: a navigation rail carrying the Chat|Code product switcher.
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bot', exact: true })).toHaveCount(0);

    // The Code product keeps the five workspace destinations.
    await openCode(page);
    await expect(page.getByRole('button', { name: 'Sessions' })).toBeVisible();
  });

  test('opens leftover Bot routes as a cloud computer, not This PC', async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#/bot';
    });
    await expect(page.getByRole('heading', { name: 'Bot', exact: true })).toBeVisible();
    await expect(page.getByText(/cloud computer/i)).toBeVisible();
    await expect(page.getByText(/\bThis PC\b/i)).toHaveCount(0);
    await expect(page.getByText(/\bThis desktop\b/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bot', exact: true })).toHaveCount(0);
  });

  test('opens Planning as a real page', async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#/planning';
    });
    // `exact` because the signed-out gate is also a heading that contains "Planning".
    await expect(page.getByRole('heading', { name: 'Planning', exact: true })).toBeVisible();

    // The schedule itself lives on the account — a job has to run when this window is
    // closed — so signed out this says so instead of listing tasks as if they were
    // scheduled. The Cortex-authored jobs stay visible as templates, which is the
    // product rule: shown and locked, never hidden.
    await expect(page.getByText('Planning needs a Cortex account')).toBeVisible();
    await expect(page.getByText("Today's notes")).toBeVisible();
    await expect(page.getByText('Subnet 100 news')).toBeVisible();
  });

  test('is usable with no account at all', async ({ page }) => {
    // The anonymous path is a product requirement, not a fallback: the Chat composer
    // greets first, and the Code composer has to be reachable without signing in too.
    await expect(page.getByPlaceholder(/Ask anything/i)).toBeVisible();

    await openCode(page);
    await expect(page.getByPlaceholder(/Describe a task/i)).toBeVisible();
  });

  test('gates what an account is needed for, and says why', async ({ page }) => {
    await openCode(page);

    // Locked rather than hidden: hiding these would make the signed-out app look like a
    // smaller product, whereas a locked row advertises what an account adds.
    for (const label of ['Automations', 'Review', 'Usage']) {
      const item = page.getByRole('button', { name: label });
      await expect(item).toHaveAttribute('aria-disabled', 'true');
      await expect(item).toHaveAttribute('title', `Sign in to Cortex to use ${label}`);

      // Focusable, which `disabled` would have prevented. This is the assertion that matters:
      // a row nobody can reach cannot advertise anything, and the reason it is locked was
      // previously unreachable for exactly the users who cannot see that it is dimmed.
      await item.focus();
      await expect(item).toBeFocused();
    }

    // Reachable but inert. `force` because Playwright's own actionability check already
    // refuses to click an `aria-disabled` control — which is itself the confirmation that the
    // state is expressed properly. Forcing past it proves the click guard, not just the
    // attribute: `aria-disabled` is advisory and the browser does still fire the event.
    await page.getByRole('button', { name: 'Usage' }).click({ force: true });
    await expect(page.getByPlaceholder(/Describe a task/i)).toBeVisible();


    // And the destinations that need nothing stay usable.
    await expect(page.getByRole('button', { name: 'Home' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Sessions' })).toBeEnabled();
  });

  test('offers a way to sign in from inside the workspace', async ({ page }) => {
    // Anonymous used to be a one-way door. The footer only rendered for a signed-in user, and
    // every other route to sign-in hangs off Usage, Review and Automations — all locked
    // precisely because nobody is signed in. There was no reachable path at all.
    await page.getByRole('button', { name: /Sign in/ }).click();

    await expect(page.getByRole('heading', { name: /Sign in|Welcome/i })).toBeVisible();
    expect(page.url()).toContain('#/sign-in');
  });

  test('lets a signed-out user reach the dark palette', async ({ page }) => {
    // The theme toggle lived in the signed-in footer row, so dark mode was unreachable
    // without an account — for a design that draws every screen in it.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: 'Toggle theme' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('keeps a typed prompt when you leave Home and come back', async ({ page }) => {
    // The draft used to live in the route's own scope, which Solid disposes on navigation, so
    // checking Sessions mid-thought silently emptied the composer.
    await openCode(page);
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

test.describe('the custom window chrome', () => {
  test('draws its own window controls on Linux, with the frame gone', async ({ page }) => {
    // The native frame carried the File/Edit menu strip; the custom bar is what
    // replaces it. On Linux the app draws all three controls itself.
    await expect(page.getByRole('button', { name: 'Minimize' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Maximize' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close window' })).toBeVisible();
  });

  test('reports the OS verdict on maximize rather than assuming it', async ({ page }) => {
    // The harness's X server runs no window manager, and without one X11 refuses
    // to maximize — which makes it the perfect stage for the honesty check: the
    // bridge must report what the OS actually did, and the button must keep
    // saying "Maximize" instead of flipping to "Restore" on hope. (The real
    // flip is covered by the unit suite over both the event and response paths.)
    const verdict = await page.evaluate(async () => {
      const bridge = (window as unknown as {
        cortex: { windowControls: { toggleMaximize: () => Promise<{ success: boolean; data?: { maximized: boolean } }> } };
      }).cortex;
      return bridge.windowControls.toggleMaximize();
    });

    expect(verdict.success).toBe(true);
    expect(typeof verdict.data?.maximized).toBe('boolean');

    await expect(
      page.getByRole('button', { name: verdict.data?.maximized ? 'Restore' : 'Maximize' }),
    ).toBeVisible();
  });

  test('keeps the bar on the bare screens too', async ({ page }) => {
    // Sign-in renders outside the workspace shell, but it still lives in a
    // frameless window: without the bar there, the window could not be dragged
    // or closed from that screen.
    await page.evaluate(() => {
      window.location.hash = '#/sign-in';
    });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close window' })).toBeVisible();
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

test.describe('runs', () => {
  test('starts one, records it, and lists it', async ({ page }) => {
    // No provider is configured in a fresh userData, and that is the case worth
    // covering: the old path threw out of `start`, surfaced a raw error and recorded
    // nothing, so the user had a toast to re-read and no trace of the attempt.
    await openCode(page);
    await page.getByPlaceholder(/Describe a task/i).fill('Add a hello function');
    // The submit is a glyph button; its accessible name is what makes it findable.
    await page.getByRole('button', { name: 'Start session' }).click();

    // Lands on the run's own screen, which means the id existed before navigation.
    await expect(page).toHaveURL(/#\/code\/sessions\/session_/);

    // The failure is recorded and says what to do about it, rather than being a
    // generic "something went wrong".
    await expect(page.getByText(/No model is configured/i)).toBeVisible({ timeout: 15000 });

    // And it is in the inbox, which is what persistence buys. Scoped to the main
    // pane: the title also appears in the sidebar's recent list, and an unscoped
    // locator matches both.
    // `exact` because the detail screen's back button is labelled 'Back to sessions',
    // which a substring match also finds.
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await expect(page.getByRole('main').getByText('Add a hello function')).toBeVisible();
  });

  test('survives a reload, because the run is in the database', async ({ page }) => {
    await openCode(page);
    await page.getByPlaceholder(/Describe a task/i).fill('Persisted across reload');
    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page).toHaveURL(/#\/code\/sessions\/session_/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.location.hash = '#/code/sessions';
    });

    // The old in-memory store showed an empty list on every launch while the rows
    // sat in SQLite unread. Scoped to the main pane, since the sidebar's recent list
    // carries the same title.
    await expect(
      page.getByRole('main').getByText('Persisted across reload'),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('the command palette', () => {
  test('opens on Cmd/Ctrl+K and marks what needs an account', async ({ page }) => {
    // It existed as a tested component that nothing rendered, so there was no
    // shortcut and no way to reach it at all.
    await page.keyboard.press('Control+k');

    const search = page.getByPlaceholder(/Search sessions and commands/i);
    await expect(search).toBeVisible();

    await expect(page.getByText('Needs an account').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();
  });

  test('navigates to what you pick', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder(/Search sessions and commands/i).fill('Settings');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });
});

test.describe('settings', () => {
  test('persists a run setting through main', async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#/code/settings';
    });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Written through IPC and read back from `app_state`, not from localStorage:
    // these settings gate what the agent may do, so the renderer must not own them.
    const prefix = page.getByLabel(/Branch prefix/i);
    await prefix.fill('agent/');
    await prefix.blur();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.location.hash = '#/code/settings';
    });

    await expect(page.getByLabel(/Branch prefix/i)).toHaveValue('agent/', { timeout: 15000 });
  });
});

test.describe('the Shell tab', () => {
  test('runs a real shell', async ({ page }) => {
    // The tab rendered nothing before: the workbench declared it and passed
    // `undefined` as its content, so the design's four tabs were three.
    await openCode(page);
    await page.getByPlaceholder(/Describe a task/i).fill('shell');
    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page).toHaveURL(/#\/code\/sessions\/session_/);

    await page.getByRole('tab', { name: /Shell/ }).click();

    // The PTY lives in main. Its id is assigned there and reported once, at
    // creation — filtering output on a locally-invented id is what made an earlier
    // version mount, size itself correctly and stay blank forever.
    const screen = page.locator('.xterm-screen');
    await expect(screen).toBeVisible();

    // `force`: while the bundled fonts land, xterm refits and the screen's box
    // moves for a moment, which Playwright's stability check waits out forever.
    // The echo round-trip below is the real assertion; the click only focuses.
    await screen.click({ force: true });
    await page.keyboard.type('echo wired-ok');
    await page.keyboard.press('Enter');

    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            [...document.querySelectorAll('.xterm-rows > div')]
              .map((row) => (row.textContent ?? '').replace(/\u00a0/g, ' '))
              .join('\n'),
          ),
        { timeout: 20000 },
      )
      .toContain('wired-ok');
  });
});
