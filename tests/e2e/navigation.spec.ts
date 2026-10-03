import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";

test("skipped native route and theme transitions preserve updates and report callback errors", async () => {
  const { app, page } = await launch({ hash: "#/home?preview&theme=light", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await expect(page.locator(".home")).toBeVisible();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const probe = await page.evaluateHandle(() => {
      const start = document.startViewTransition.bind(document);
      const records: { kind: string; callbacks: number; readyHandled: boolean; readyError: string | null; transition: ViewTransition }[] = [];
      const unhandled: { source: string; kind?: string; name: string; message: string }[] = [];
      let failUpdates = false;
      addEventListener("unhandledrejection", (event) => {
        const record = records.find(({ transition }) => [transition.ready, transition.finished, transition.updateCallbackDone].includes(event.promise));
        const source = record && (["ready", "finished", "updateCallbackDone"] as const).find((key) => record.transition[key] === event.promise);
        unhandled.push({ source: source ?? "derived", kind: record?.kind, name: event.reason.name, message: event.reason.message });
      });
      document.startViewTransition = (update) => {
        const kind = document.documentElement.dataset.vt === "theme" ? "theme" : "route";
        const record = { kind, callbacks: 0, readyHandled: false, readyError: null as string | null };
        const transition = start(async () => {
          record.callbacks++;
          await (typeof update === "function" ? update() : update?.update?.());
          if (failUpdates) throw new Error(`Native ${kind} callback failed`);
        });
        records.push(Object.assign(record, { transition }));
        // Observe application handlers without attaching our own rejection handler or replacing native promises.
        const then = transition.ready.then.bind(transition.ready);
        transition.ready.then = (resolve, reject) => {
          record.readyHandled ||= typeof reject === "function";
          return then(resolve, reject && ((error) => { record.readyError = error.name; return reject(error); }));
        };
        transition.skipTransition();
        return transition;
      };
      return {
        records, fail: () => { failUpdates = true; },
        read: () => ({
          records: records.map(({ transition, ...record }) => ({ ...record, native: transition instanceof ViewTransition })),
          unhandled,
        }),
      };
    });
    const work = page.locator(".titlebar").getByRole("tab", { name: "Work", exact: true });
    await work.click();
    await expect(page.locator(".travail-filters")).toBeVisible();
    await expect(work).toHaveAttribute("aria-selected", "true");
    const dark = page.getByRole("radio", { name: "Dark", exact: true });
    await dark.focus();
    await dark.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page).toHaveURL(/#\/work-home\?.*theme=dark/);
    await expect(page.locator("html")).not.toHaveAttribute("data-vt", "theme");
    const skipped = await probe.evaluate(async (probe) => {
      await Promise.all(probe.records.map(({ transition }) => transition.finished));
      await new Promise(requestAnimationFrame);
      return probe.read();
    });
    await test.info().attach("skipped-native-transitions", { body: JSON.stringify({ ...skipped, errors }, null, 2), contentType: "application/json" });
    expect.soft(skipped.records).toEqual(["route", "theme"].map((kind) => ({ kind, callbacks: 1, readyHandled: true, readyError: "AbortError", native: true })));
    expect.soft(skipped.unhandled).toEqual([]);
    expect.soft(errors).toEqual([]);

    // A skipped animation must still expose an asynchronously rejected update callback.
    await probe.evaluate((probe) => probe.fail());
    await page.locator(".titlebar").getByRole("tab", { name: "Chat", exact: true }).click();
    await expect(page.locator(".home")).toBeVisible();
    const light = page.getByRole("radio", { name: "Light", exact: true });
    await light.focus();
    await light.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).not.toHaveAttribute("data-vt", "theme");
    await expect.poll(() => errors.length).toBeGreaterThanOrEqual(3);
    const failed = await probe.evaluate((probe) => probe.read());
    await test.info().attach("native-callback-errors", { body: JSON.stringify({ ...failed, errors }, null, 2), contentType: "application/json" });
    expect(errors).toEqual(["Native route callback failed", "Native route callback failed", "Native theme callback failed"]);
    expect(failed.records.slice(2)).toEqual(["route", "theme"].map((kind) => ({ kind, callbacks: 1, readyHandled: true, readyError: "AbortError", native: true })));
    await probe.dispose();
  } finally { await app.close(); }
});

test("Back cancels a pending tab choice even when its label matches an older request", async () => {
  const { app, page } = await launch({ hash: "#/home?preview&theme=light", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  try {
    await expect(page.locator(".home")).toBeVisible();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const chat = page.locator(".titlebar").getByRole("tab", { name: "Chat", exact: true });
    const work = page.locator(".titlebar").getByRole("tab", { name: "Work", exact: true });
    const first = await page.evaluate(() => (window as unknown as { navigation: { currentEntry: { key: string } } }).navigation.currentEntry.key);
    await work.click();
    await expect(page.locator(".travail-filters")).toBeVisible();
    const commit = await page.evaluateHandle(() => {
      const start = document.startViewTransition;
      let release: (() => void) | undefined;
      document.startViewTransition = (update) => {
        document.startViewTransition = start;
        const done = new Promise<void>((resolve) => { release = resolve; }).then(() => typeof update === "function" ? update() : update?.update?.());
        return { finished: done, ready: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} };
      };
      return () => { if (!release) throw new Error("Route update was not held"); release(); };
    });
    await chat.click();
    await expect(page).toHaveURL(/#\/home\?/);
    await work.click();
    await expect(work).toHaveAttribute("aria-selected", "true");
    await page.evaluate(() => history.go(-2));
    await expect(page.locator(".home")).toBeVisible();
    await commit.evaluate((release) => release());
    // Observe beyond the 610ms debounce; a stale timer must not override the Back action.
    expect(await page.evaluate(async (key) => {
      const nav = (window as unknown as { navigation: EventTarget & { currentEntry: { key: string } } }).navigation;
      let changed = nav.currentEntry.key !== key;
      const check = () => { if (nav.currentEntry.key !== key) changed = true; };
      nav.addEventListener("currententrychange", check);
      await new Promise((resolve) => setTimeout(resolve, 800));
      nav.removeEventListener("currententrychange", check);
      return changed;
    }, first)).toBe(false);
    await expect(chat).toHaveAttribute("aria-selected", "true");
    await commit.dispose();
  } finally { await app.close(); }
});

test("a newer keyboard tab choice survives the previous route commit", async () => {
  const { app, page } = await launch({ hash: "#/work-home?preview&theme=light", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator(".travail-filters")).toBeVisible();
    const chat = page.locator(".titlebar").getByRole("tab", { name: "Chat", exact: true });
    const work = page.locator(".titlebar").getByRole("tab", { name: "Work", exact: true });
    const commit = await page.evaluateHandle(() => {
      const start = document.startViewTransition;
      let release: (() => void) | undefined;
      document.startViewTransition = (update) => {
        document.startViewTransition = start;
        const done = new Promise<void>((resolve) => { release = resolve; }).then(() => typeof update === "function" ? update() : update?.update?.());
        return { finished: done, ready: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} };
      };
      return () => { if (!release) throw new Error("Route update was not held"); release(); };
    });
    await work.press("ArrowLeft");
    await chat.press("Enter");
    await expect(page).toHaveURL(/#\/home\?/);
    await expect(page.locator(".travail-filters")).toBeVisible();
    await chat.press("ArrowRight");
    await work.press("Enter");
    await expect(work).toHaveAttribute("aria-selected", "true");
    await commit.evaluate((release) => release());
    await expect(page).toHaveURL(/#\/work-home\?/);
    await expect(page.locator(".travail-filters")).toBeVisible();
    await expect(work).toHaveAttribute("aria-selected", "true");
    await expect(work).toBeFocused();
    await commit.dispose();
  } finally { await app.close(); }
});

test("a pending route commit preserves the outgoing Work tree and restores Bot activity", async () => {
  const { app, page } = await launch({ hash: "#/work-task?preview&theme=light&v=computer", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const bot = page.locator(".sidebar .row").filter({ hasText: "Nova" });
    await expect(page.locator(".travail-pane")).toHaveAttribute("aria-hidden", "false");
    await expect(bot.locator(".meta")).toHaveText("is browsing the CRM");
    const draft = page.getByTestId("composer-input");
    await draft.fill("Keep this outgoing task draft");
    const outgoing = await page.locator("main.content").elementHandle();
    const commit = await page.evaluateHandle(() => {
      const start = document.startViewTransition;
      let release: (() => void) | undefined;
      // Hold only the route update, making the browser/React snapshot gap deterministic.
      document.startViewTransition = (update) => {
        document.startViewTransition = start;
        const done = new Promise<void>((resolve) => { release = resolve; }).then(() => typeof update === "function" ? update() : update?.update?.());
        return { finished: done, ready: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} };
      };
      history.pushState(null, "", "#/home?preview&theme=light");
      return () => { if (!release) throw new Error("Route update was not held"); release(); };
    });
    await expect(page).toHaveURL(/#\/home\?/);
    // A shell-only update must not remount Work under Home's history entry.
    await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
    await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
    expect(await outgoing!.evaluate((el) => el.isConnected)).toBe(true);
    await expect(draft).toHaveValue("Keep this outgoing task draft");
    await expect(page.locator(".home")).toHaveCount(0);
    await commit.evaluate((release) => release());
    await expect(page.locator(".home")).toBeVisible();
    expect(await outgoing!.evaluate((el) => el.isConnected)).toBe(false);
    await expect(bot.locator(".meta")).toHaveText("sorting your email");
    await expect(bot.locator(".mascot")).toHaveAttribute("data-state", "working");
    await outgoing!.dispose();
    await commit.dispose();
  } finally { await app.close(); }
});

test("anchors, native menus and history preserve routes, variants and chat identities", async () => {
  const initialHash = "#/image-gen?preview&v=refused&theme=light";
  const { app, page } = await launch({ hash: initialHash, env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const menu = (label: string) => app.evaluate(({ Menu, BrowserWindow }, label) => {
    const item = Menu.getApplicationMenu()?.items.flatMap((item) => item.submenu?.items ?? []).find((item) => item.label === label);
    if (!item?.enabled) throw new Error(`Missing or disabled menu item: ${label}`);
    item.click(item, BrowserWindow.getAllWindows()[0], { triggeredByAccelerator: false });
  }, label);
  try {
    const rules = page.getByRole("link", { name: "Learn more about the creation rules" });
    const back = page.getByRole("button", { name: "Back", exact: true });
    const forward = page.getByRole("button", { name: "Forward", exact: true });
    await expect(rules).toBeVisible();
    await expect(back).toBeDisabled();
    await expect(forward).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
    const dark = page.getByRole("radio", { name: "Dark", exact: true });
    // Keyboard focus keeps the expanding rail control open across parallel native windows.
    await dark.focus();
    await dark.press("Space");
    await expect(dark).toHaveAttribute("aria-checked", "true");

    await rules.click();
    await expect(page).toHaveURL(/#\/about$/);
    await expect(page.locator("main .content-top")).toContainText("About");
    await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await back.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("#/image-gen?preview=&v=refused&theme=dark");
    await expect(rules).toBeVisible();
    await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
    await menu("Forward");
    await expect(page.locator("main .content-top")).toContainText("About");

    const native = await app.evaluate(({ Menu }) => {
      const items = Menu.getApplicationMenu()!.items;
      return {
        blocked: items.find((item) => item.label === "Go")!.submenu!.items.filter((item) => ["Space", "Scheduled", "Plugins and Skills"].includes(item.label)).map((item) => ({ label: item.label, enabled: item.enabled })),
        fullscreen: items.find((item) => item.label === "View")!.submenu!.items.filter((item) => item.role === "togglefullscreen").length,
      };
    });
    expect(native.blocked).toEqual([
      { label: "Space", enabled: false }, { label: "Scheduled", enabled: false }, { label: "Plugins and Skills", enabled: false },
    ]);
    // AppKit owns the macOS entry; its injected menu requires an OS-level capture.
    expect(native.fullscreen).toBe(process.platform === "darwin" ? 0 : 1);

    const sessions = await page.evaluate(async () => {
      const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
      return Promise.all(["Navigation first chat", "Navigation second chat"].map(async (title) => {
        const response = await bridge("cortex://local/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "chat", title, model: { providerID: "test", modelID: "test" } }) });
        if (!response.ok) throw new Error(`Session creation failed: ${response.status}`);
        return response.json() as Promise<{ id: string; title: string }>;
      }));
    });
    expect(sessions[0].id).not.toBe(sessions[1].id);
    await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
    for (const session of sessions) {
      await page.getByRole("button", { name: session.title, exact: true }).click();
      await expect(page.locator("main .content-top .title")).toHaveText(session.title);
      await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/chat?id=${session.id}`);
    }
    await back.click();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[0].title);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/chat?id=${sessions[0].id}`);
    await menu("Forward");
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[1].title);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/chat?id=${sessions[1].id}`);
    await expect(forward).toBeDisabled();
    await page.goBack();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[0].title);
    await page.goForward();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[1].title);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByTestId("settings-nav-connection").click();
    await expect(page.locator(".pg-panel .page-title")).toHaveText("Connection");
    await page.getByRole("button", { name: sessions[0].title, exact: true }).click();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[0].title);
    await back.click();
    await expect(page).toHaveURL(/#\/settings\?v=connection$/);
    await expect(page.locator(".pg-panel .page-title")).toHaveText("Connection");

    await menu("Design Gallery");
    await expect(page.locator(".gal")).toBeVisible();
    await expect(page.frameLocator(".gal iframe").first().locator(".desk")).toBeVisible();
    await expect(page.locator(".gal")).toHaveJSProperty("scrollTop", 0);
    expect(page.frames().filter((frame) => frame !== page.mainFrame() && frame.url().includes("&shot")).length).toBeLessThan(12);
    await expect(page.locator('.gal-head a[href="#/home"]')).toBeInViewport({ ratio: 1 });
    const canvasPreview = page.locator('[data-gallery-item="canvas~selection-dark"]');
    await canvasPreview.scrollIntoViewIfNeeded();
    await expect(canvasPreview.frameLocator("iframe").locator(".chat-selbar input")).toBeVisible();
    expect(page.frames().filter((frame) => frame !== page.mainFrame() && frame.url().includes("&shot")).length).toBeLessThan(12);
    await page.locator(".gal-head").scrollIntoViewIfNeeded();
    await expect.poll(() => canvasPreview.locator("iframe").evaluate((frame: HTMLIFrameElement) => frame.contentDocument?.URL)).toBe("about:blank");
    await expect(page.locator(".gal")).toHaveJSProperty("scrollTop", 0);
    await menu("Back");
    await expect(page.locator(".pg-panel .page-title")).toHaveText("Connection");
    await expect(forward).toBeEnabled();
    await page.getByRole("button", { name: sessions[1].title, exact: true }).click();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[1].title);
    await expect(forward).toBeDisabled();
    await menu("Design Gallery");
    await expect(page.locator(".gal")).toBeVisible();
    await expect(page.frameLocator(".gal iframe").first().locator(".desk")).toBeVisible();
    await expect(page.locator(".gal")).toHaveJSProperty("scrollTop", 0);
    expect(page.frames().filter((frame) => frame !== page.mainFrame() && frame.url().includes("&shot")).length).toBeLessThan(12);
    await expect(page.locator('.gal-head a[href="#/home"]')).toBeInViewport({ ratio: 1 });
    await page.locator('.gal-head a[href="#/home"]').click({ timeout: 5_000 });
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator(".desk")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("Work preview departure keeps its context until native live-Code navigation commits", async () => {
  const { app, page } = await launch({ hash: "#/work-task?shot&theme=light&v=done", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator(".travail-recap")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const draft = page.getByTestId("composer-input");
    await draft.fill("Preserve the departing Work draft");
    const outgoing = await page.locator("main.content").elementHandle();
    const transition = await page.evaluateHandle(() => {
      const start = document.startViewTransition.bind(document);
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      let native: ViewTransition | undefined, entered = false;
      document.startViewTransition = (update) => {
        document.startViewTransition = start;
        // Hold the real native update callback; promises and rendering stay browser-owned.
        native = start(async () => {
          entered = true;
          await held;
          await (typeof update === "function" ? update() : update?.update?.());
        });
        return native;
      };
      return { release, read: () => ({ entered, native: native instanceof ViewTransition }), finish: () => native!.finished };
    });
    // Same-document preview-to-live departure, matching the installed-app failure.
    await page.evaluate(() => { location.hash = "#/code"; });
    await expect.poll(() => transition.evaluate((probe) => probe.read())).toEqual({ entered: true, native: true });
    await expect(page).toHaveURL(/#\/code$/);
    expect(errors).toEqual([]);
    // Force the still-mounted preview to render while URL and committed screen differ.
    // Native transitions suspend paint while the callback is held; dispatch to the real control.
    await page.getByRole("button", { name: "Hide sidebar", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
    expect(await outgoing!.evaluate((el) => el.isConnected)).toBe(true);
    expect(await page.locator(".travail-recap").count()).toBe(1);
    await expect(draft).toHaveValue("Preserve the departing Work draft");
    expect(errors).toEqual([]);
    await transition.evaluate((probe) => probe.release());
    await transition.evaluate((probe) => probe.finish());
    await expect(page.getByTestId("code-composer-input")).toBeVisible();
    expect(await outgoing!.evaluate((el) => el.isConnected)).toBe(false);
    await expect(page.locator(".travail-recap")).toHaveCount(0);
    await expect(page.locator(".variant-pick")).toHaveCount(0);
    await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
    await expect(page.locator(".sidebar").getByText("Nova", { exact: true })).toHaveCount(0);
    await expect(page.locator(".sidebar").getByText("cortex-web", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(async () => {
      const fetch = (window as unknown as { __bridgeFetch: typeof globalThis.fetch }).__bridgeFetch;
      return Promise.all(["/api/bots", "/api/sessions"].map(async (path) => (await fetch(`cortex://local${path}`)).json()));
    })).toEqual([[], []]);
    expect(errors).toEqual([]);
    await outgoing!.dispose();
    await transition.dispose();
  } catch (error) {
    await test.info().attach("preview-departure-failure", { body: await page.screenshot(), contentType: "image/png" });
    throw error;
  } finally {
    await test.info().attach("preview-departure-errors", { body: JSON.stringify({ errors, url: page.url() }, null, 2), contentType: "application/json" });
    await app.close();
  }
});
