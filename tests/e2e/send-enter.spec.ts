import { test, expect, type Page } from "@playwright/test";
import type { Bot, MessageWithParts, Session } from "@cortex/schema";
import { launch, root } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import copy from "../../packages/i18n/locales/en/system.json" with { type: "json" };

const KEY = "cortex.pref.general.enter";
const MODEL = { providerID: "fake", modelID: "reasoner" };
const ENV = { CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify({ fake: { ...catalog.fake, models: { reasoner: catalog.fake.models.reasoner } } }))}` };
const toggle = (page: Page) => page.locator(`[role="switch"][aria-label="${copy["settings.t.general.enter"]}"]`);
async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ route, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${method} ${route}: ${r.status}`);
    return r.status === 204 ? null : r.json();
  }, { route, method, body });
}
async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const surface of ["home", "work-home"] as const) {
  for (const key of ["Enter", "Shift+Enter"] as const) {
    test(`${surface}: ${key} retains newline with Send with Enter ${key === "Enter" ? "off" : "on"}`, async () => {
      const fake = await startFakeProvider();
      const { app, page } = await launch({ hash: "#/settings?section=general", env: { ...ENV, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
      try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(toggle(page)).toBeChecked();
        if (key === "Enter") { await toggle(page).click(); await expect(toggle(page)).not.toBeChecked(); }
        await call(page, "/api/providers/fake/key", "PUT", { key: "sk-test-enter-preference" });
        if (surface === "work-home") await call<Bot>(page, "/api/bots", "POST", { name: "Keyboard Bot", model: MODEL });
        await page.goto(`${page.url().split("#")[0]}#/${surface}`);
        const input = page.getByTestId("composer-input");
        await input.fill("First line");
        await capture(page, "before-key");
        await input.press(key);
        await expect(input).toHaveValue("First line\n", { timeout: 5000 });
        expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
        expect(fake.requests).toHaveLength(0);
        await input.pressSequentially("Second line");
        await expect(input).toHaveValue("First line\nSecond line");
        await capture(page, "multiline-draft");
        await page.getByTestId("composer-send").click();
        await expect(input).toHaveValue("");
        await expect(page.getByText("Hello from the streaming test provider. Everything works.", { exact: true })).toBeVisible();
        const sessions = await call<Session[]>(page, "/api/sessions");
        expect(sessions).toHaveLength(1);
        const messages = await call<MessageWithParts[]>(page, `/api/sessions/${sessions[0].id}/messages`);
        const users = messages.filter((m) => m.info.role === "user");
        expect(users).toHaveLength(1);
        expect(users[0].parts.filter((p) => p.type === "text").map((p) => p.text)).toEqual(["First line\nSecond line"]);
        expect(fake.requests).toHaveLength(1);
        await page.reload();
        const restored = await call<MessageWithParts[]>(page, `/api/sessions/${sessions[0].id}/messages`);
        expect(restored.filter((m) => m.info.role === "user")).toEqual(users);
      } finally {
        try {
          await capture(page, "after-key");
          const sessions = await call<Session[]>(page, "/api/sessions");
          const histories = await Promise.all(sessions.map(async (s) => ({ session: s, messages: await call<MessageWithParts[]>(page, `/api/sessions/${s.id}/messages`) })));
          await test.info().attach("engine-and-preference", { body: JSON.stringify({ surface, key, preference: await page.evaluate((key) => localStorage.getItem(key), KEY), histories, requests: fake.requests.map((r) => r.body) }, null, 2), contentType: "application/json" });
        } finally { await app.close(); await fake.close(); }
      }
    });
  }
}

for (const theme of ["light", "dark"]) {
  test(`Code and Bot preserve multiline drafts and transcript text — ${theme}`, async () => {
    const fake = await startFakeProvider();
    const { app, page } = await launch({ hash: `#/settings?section=general&theme=${theme}`, env: { ...ENV, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`, CORTEX_TEST_PICK_DIRECTORY: root } });
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await toggle(page).click();
      await call(page, "/api/providers/fake/key", "PUT", { key: "sk-test-enter-preference" });
      const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Multiline Bot", model: MODEL });
      for (const route of ["code", `bot?id=${bot.id}`]) {
        await page.goto(`${page.url().split("#")[0]}#/${route}${route.includes("?") ? "&" : "?"}theme=${theme}`);
        const input = page.getByTestId(route === "code" ? "code-composer-input" : "composer-input");
        await input.fill("First line");
        await input.press("Enter");
        await input.pressSequentially("Second line");
        await expect(input).toHaveValue("First line\nSecond line");
        await expect(input).toBeInViewport({ ratio: 1 });
        await capture(page, `${route === "code" ? "code" : "bot"}-multiline-${theme}`);
        await page.getByTestId("composer-send").click();
        await expect(page.getByText("Hello from the streaming test provider. Everything works.", { exact: true })).toBeVisible();
        await expect(page.locator(".msg-user")).toHaveText("First line\nSecond line");
        await input.fill("Follow-up");
        await input.press("Shift+Enter");
        await input.pressSequentially("retained");
        await expect(input).toHaveValue("Follow-up\nretained");
        await capture(page, `${route === "code" ? "code-session" : "bot-thread"}-multiline-${theme}`);
      }
      expect(fake.requests).toHaveLength(2);
    } finally { await app.close(); await fake.close(); }
  });
}

test("composition and modified Enter retain the draft before ordinary Enter submits once", async () => {
  const fake = await startFakeProvider();
  const { app, page } = await launch({ hash: "#/home", env: { ...ENV, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
  try {
    await call(page, "/api/providers/fake/key", "PUT", { key: "sk-test-enter-preference" });
    await page.reload();
    const input = page.getByTestId("composer-input");
    await input.fill("Keyboard draft");
    await input.dispatchEvent("compositionstart");
    await input.press("Enter");
    await input.dispatchEvent("compositionend");
    for (const init of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true, ...init });
    }
    expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
    expect(fake.requests).toHaveLength(0);
    await input.fill("Keyboard draft");
    await input.press("Enter");
    await expect(page.getByText("Hello from the streaming test provider. Everything works.", { exact: true })).toBeVisible();
    expect(fake.requests).toHaveLength(1);
  } finally { await app.close(); await fake.close(); }
});

test("refused preference storage retains the accepted setting and unreadable storage never sends", async () => {
  const { app, page } = await launch({ hash: "#/settings?section=general", env: ENV });
  try {
    await toggle(page).click();
    await expect(toggle(page)).not.toBeChecked();
    await page.evaluate((key) => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException("Unavailable", "QuotaExceededError");
        return set.call(this, name, value);
      };
    }, KEY);
    await toggle(page).click();
    await expect(toggle(page)).not.toBeChecked();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("false");
    await expect(page.getByRole("alert")).toBeVisible();
    await page.goto(`${page.url().split("#")[0]}#/home`);
    const input = page.getByTestId("composer-input");
    await input.fill("Storage draft");
    await page.evaluate((key) => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (name) {
        if (name === key) throw new DOMException("Unavailable", "SecurityError");
        return get.call(this, name);
      };
    }, KEY);
    await input.press("Enter");
    await expect(input).toHaveValue("Storage draft\n");
    await expect(page.locator(".composer-storage-error")).toBeVisible();
    expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
  } finally { await app.close(); }
});

test("preview Send with Enter changes never overwrite the saved live preference", async () => {
  const { app, page } = await launch({ hash: "#/settings?section=general", env: ENV });
  try {
    await expect(toggle(page)).toBeChecked(); await toggle(page).click(); await expect(toggle(page)).not.toBeChecked();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("false");
    await page.goto(`${page.url().split("#")[0]}#/settings?preview&section=general`);
    await expect(toggle(page)).toBeChecked(); await capture(page, "preview-before");
    await toggle(page).click(); await expect(toggle(page)).not.toBeChecked();
    await toggle(page).click(); await expect(toggle(page)).toBeChecked();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("false");
    await capture(page, "preview-after");
    await page.goto(`${page.url().split("#")[0]}#/settings?section=general`);
    await expect(toggle(page)).not.toBeChecked(); await page.reload(); await expect(toggle(page)).not.toBeChecked();
    expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
    await capture(page, "live-reloaded");
  } finally { await app.close(); }
});

test("same-URL New Chat fences outgoing Enter until its held route commits", async () => {
  const fake = await startFakeProvider();
  const { app, page } = await launch({ hash: "#/home", env: { ...ENV, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
  try {
    await call(page, "/api/providers/fake/key", "PUT", { key: "sk-test-enter-owner" });
    await page.reload();
    await expect(page.getByTestId("model-trigger")).not.toHaveText("No model");
    const input = page.getByTestId("composer-input");
    await input.fill("Outgoing owner draft");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await capture(page, "before-new-chat");
    const held = await page.evaluateHandle(() => {
      const start = document.startViewTransition;
      const nav = (window as unknown as { navigation: { currentEntry: { key: string } } }).navigation;
      const url = location.href, entry = nav.currentEntry.key;
      let release: (() => void) | undefined, done: Promise<void> | undefined;
      document.startViewTransition = (update) => {
        done = new Promise<void>((resolve) => { release = resolve; }).then(() => typeof update === "function" ? update() : update?.update?.());
        return { finished: done, ready: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} };
      };
      return {
        read: () => ({ held: !!release, sameURL: location.href === url, newEntry: nav.currentEntry.key !== entry }),
        finish: async () => { document.startViewTransition = start; release?.(); await done; },
      };
    });
    try {
      await page.locator(".sidebar .row").filter({ hasText: "New chat" }).click();
      expect(await held.evaluate((h) => h.read())).toEqual({ held: true, sameURL: true, newEntry: true });
      await expect(input).toHaveValue("Outgoing owner draft");
      await input.press("Enter");
      await expect(input).toHaveValue("Outgoing owner draft\n", { timeout: 5000 });
      expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
      expect(fake.requests).toHaveLength(0);
      await capture(page, "outgoing-owner-fenced");
      await held.evaluate((h) => h.finish());
      await expect(input).toHaveValue("");
    } finally { await held.evaluate((h) => h.finish()); await held.dispose(); }
  } finally { await capture(page, "after-new-chat"); await app.close(); await fake.close(); }
});
