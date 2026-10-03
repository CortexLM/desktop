import { test, expect, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import type { Bot, MemoryEntry, MessageWithParts, RuntimeSettings, Session } from "@cortex/schema";
import fs from "node:fs";
import path from "node:path";
import { launch, root } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import copy from "../../packages/i18n/locales/en/system.json" with { type: "json" };
import botCopy from "../../packages/i18n/locales/en/bots.json" with { type: "json" };

const MODEL = { providerID: "fake", modelID: "reasoner" }, LEGACY = "cortex.pref.privacy.memory";
const ENV = { CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify({ fake: { ...catalog.fake, models: { reasoner: catalog.fake.models.reasoner } } }))}`, CORTEX_TEST_PROVIDER_BASEURL: "" };
const ANSWER = "Hello from the streaming test provider. Everything works.";
const memory = (page: Page) => page.getByRole("switch", { name: copy["memory.toggle"], exact: true });
const privacy = (page: Page) => page.locator(`[role="switch"][aria-label="${copy["settings.t.privacy.memory"]}"]`);
const retry = (page: Page) => page.locator("main").getByRole("button", { name: "Try again", exact: true });
async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ route, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(`${method} ${route}: ${r.status}`);
    return r.json();
  }, { route, method, body });
}
const show = (page: Page, route: string, theme = "light") => page.evaluate(({ route, theme }) => history.pushState(null, "", `#/${route}${route.includes("?") ? "&" : "?"}theme=${theme}`), { route, theme });
async function fence(page: Page) {
  await call(page, "/api/health");
  await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
}
async function completed(page: Page, id: string) {
  await expect.poll(async () => {
    const messages = await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`), last = messages.at(-1);
    return messages.length === 2 && last?.info.role === "assistant" && last.info.time.completed && !last.info.error ? last.parts.filter((p) => p.type === "text").map((p) => p.text).join("") : "";
  }).toBe(ANSWER);
  return call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready); await fence(page);
  expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main, main .page, .pg-panel, .systeme-narrow, .systeme-memoff, .systeme-grow")].filter((e) => {
    const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 1;
  }).map((e) => e.className))).toEqual([]);
  const control = page.locator(`[role=switch][aria-label="${copy["memory.toggle"]}"], [role=switch][aria-label="${copy["settings.t.privacy.memory"]}"]`);
  await expect(control).toBeVisible();
  expect(await control.evaluate((e) => {
    const r = e.getBoundingClientRect(), row = e.closest<HTMLElement>(".li, .systeme-memoff")!, bounds = row.getBoundingClientRect();
    return r.width >= 34 && r.height >= 20 && r.left >= bounds.left && r.right <= bounds.right && r.top >= 0 && r.bottom <= innerHeight
      && [row, ...row.querySelectorAll<HTMLElement>(".grow, .systeme-grow, .sub")].every((item) => item.scrollWidth <= item.clientWidth + 1);
  })).toBe(true);
  const file = test.info().outputPath(`${name}.png`); await page.screenshot({ path: file, animations: "disabled" });
  await test.info().attach(name, { path: file, contentType: "image/png" });
}
type Wire = { url: string; method: string; headers: [string, string][]; body?: string };
type Reply = { status: number; headers: [string, string][]; body: string };
type Gate = { hold?: "GET" | "PUT"; refuse?: boolean; failGet?: boolean; held?: Reply; returned: boolean; release?: () => void; restore: () => void; calls: { method: string; body?: string; reply?: Reply }[] };
async function observe(app: ElectronApplication, page: Page) {
  await app.evaluate(({ ipcMain }) => {
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<Reply>> })._invokeHandlers.get("cortex:fetch")!;
    const g: Gate = { returned: false, calls: [], restore: () => { ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", original); } };
    (globalThis as unknown as { settingsGate: Gate }).settingsGate = g;
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, req: Wire) => {
      if (new URL(req.url).pathname !== "/api/settings") return original(event, req);
      const row: Gate["calls"][number] = { method: req.method, body: req.body }, hold = g.hold === req.method; g.calls.push(row);
      if (hold) g.hold = undefined;
      // PUT waits before admission; GET holds an actual completed engine snapshot.
      if (hold && req.method === "PUT") await new Promise<void>((resolve) => { g.release = resolve; });
      const request = g.refuse && req.method === "PUT" ? { ...req, body: JSON.stringify({ ...JSON.parse(req.body!), memoryEnabled: "invalid" }) } : g.failGet && req.method === "GET" ? { ...req, url: `${req.url}/missing` } : req;
      const response = await original(event, request);
      if (hold && req.method === "GET") { g.held = response; await new Promise<void>((resolve) => { g.release = resolve; }); }
      row.reply = response; if (hold) g.returned = true; return response;
    });
  });
  const state = () => app.evaluate(() => { const g = (globalThis as unknown as { settingsGate: Gate }).settingsGate; return { calls: g.calls, held: g.held, waiting: !!g.release, returned: g.returned }; });
  return { state, set: (options: Partial<Pick<Gate, "hold" | "refuse" | "failGet">>) => app.evaluate((_, options) => { Object.assign((globalThis as unknown as { settingsGate: Gate }).settingsGate, options, { held: undefined, returned: false }); }, options),
    waiting: () => expect.poll(async () => (await state()).waiting).toBe(true),
    release: async () => { await app.evaluate(() => { const g = (globalThis as unknown as { settingsGate: Gate }).settingsGate; g.release?.(); g.release = undefined; }); await expect.poll(async () => (await state()).returned).toBe(true); await fence(page); },
    close: () => app.evaluate(() => { const g = (globalThis as unknown as { settingsGate: Gate }).settingsGate; g.release?.(); g.restore(); }),
  };
}

for (const theme of ["light", "dark"]) test(`Memory pause persists across restart, preserves notes and gates future Bot context — ${theme}`, async () => {
  const fake = await startFakeProvider(), env = { ...ENV, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` };
  const launched = await launch({ hash: `#/memory?theme=${theme}`, locale: "en", env }).catch(async (error) => { await fake.close(); throw error; });
  const { dataDir } = launched; let { app, page } = launched;
  const errors: string[] = [], setup = async () => { page.on("pageerror", (e) => errors.push(e.message)); await page.emulateMedia({ reducedMotion: "reduce" }); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640)); };
  const notes = (id: string) => call<MemoryEntry[]>(page, `/api/bots/${id}/memory`);
  const system = (i: number) => (fake.requests[i].body.messages as { role: string; content: string }[]).filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const send = async (bot: Bot) => {
    await show(page, `bot?id=${bot.id}`, theme); await expect(page.locator(".content-top .title")).toHaveText(bot.name);
    await page.getByTestId("composer-input").fill(`Check ${bot.name}`); await page.getByTestId("composer-send").click();
    await expect(page.locator(".thread-inner .msg-user")).toHaveText([`Check ${bot.name}`]);
    const sessions = await call<Session[]>(page, `/api/bots/${bot.id}/sessions`); expect(sessions).toHaveLength(1);
    return { session: sessions[0], messages: await completed(page, sessions[0].id) };
  };
  try {
    await setup(); expect(await call<RuntimeSettings>(page, "/api/settings")).toEqual({ memoryEnabled: true });
    await call(page, "/api/providers/fake/key", "PUT", { key: "sk-test-memory-settings" });
    const a = await call<Bot>(page, "/api/bots", "POST", { name: "Amber", persona: "Amber persona remains.", model: MODEL });
    const b = await call<Bot>(page, "/api/bots", "POST", { name: "Violet", persona: "Violet persona remains.", model: MODEL });
    const first = await call<MemoryEntry>(page, `/api/bots/${a.id}/memory`, "POST", { content: "AMBER_SAVED_NOTE_731" });
    const second = await call<MemoryEntry>(page, `/api/bots/${b.id}/memory`, "POST", { content: "VIOLET_SAVED_NOTE_842" });
    const before = await send(a); expect(system(0)).toContain(first.content); expect(system(0)).toContain(a.persona); expect(system(0)).not.toContain(second.content);
    await show(page, "settings?section=privacy", theme); await expect(privacy(page)).toBeChecked(); await privacy(page).click(); await expect(privacy(page)).not.toBeChecked();
    expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: false }); expect(await notes(a.id)).toEqual([first]); expect(await notes(b.id)).toEqual([second]);
    await expect(page.getByText(copy["settings.t.privacy.memoryLiveDesc"], { exact: true })).toBeVisible(); await capture(page, `privacy-memory-off-${theme}`);
    await show(page, "memory", theme); await expect(memory(page)).not.toBeChecked(); await expect(page.getByText(copy["memory.liveOffText"], { exact: true })).toBeVisible();
    const primary = (await call<Bot[]>(page, "/api/bots"))[0], row = page.locator(".systeme-mem");
    await expect(row).toContainText(primary.id === a.id ? first.content : second.content);
    const forget = row.getByRole("button", { name: copy["memory.forget"], exact: true }); await forget.click({ trial: true }); await forget.focus(); await expect(forget).toBeFocused();
    await expect(page.getByRole("button", { name: copy["memory.export"], exact: true })).toBeEnabled(); await capture(page, `saved-memory-paused-${theme}`);
    await show(page, `bot-settings?id=${b.id}&v=memory`, theme); await expect(page.getByRole("textbox", { name: "Memory 1", exact: true })).toHaveValue(second.content);
    await page.getByRole("button", { name: botCopy["set.add"], exact: true }).click(); const draft = page.getByPlaceholder(botCopy["set.newMemory"], { exact: true });
    await draft.fill("MANUAL_NOTE_WHILE_PAUSED_953"); await draft.press("Enter"); await expect(draft).toHaveCount(0);
    const saved = await notes(b.id); expect(saved).toHaveLength(2); expect(saved[0]).toEqual(second);
    const paused = await send(b); expect(system(1)).toContain(b.persona);
    for (const note of [first, ...saved]) expect(system(1)).not.toContain(note.content);
    expect(await notes(b.id)).toEqual(saved);
    await app.close();
    app = await electron.launch({ args: [path.join(root, "packages/desktop/dist/main.cjs"), `--user-data-dir=${path.join(dataDir, "renderer")}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])], env: { ...process.env, ...env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: `#/memory?theme=${theme}`, CORTEX_LOCALE: "en" } as Record<string, string> });
    page = await app.firstWindow(); await page.waitForFunction(() => "__bridgeFetch" in window); await setup();
    await expect(memory(page)).not.toBeChecked(); expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: false });
    await show(page, "settings?section=privacy", theme); await expect(privacy(page)).not.toBeChecked();
    expect(await notes(a.id)).toEqual([first]); expect(await notes(b.id)).toEqual(saved);
    expect(await call(page, `/api/sessions/${before.session.id}/messages`)).toEqual(before.messages);
    await show(page, "memory", theme); await memory(page).focus(); await page.keyboard.press("Space"); await expect(memory(page)).toBeChecked();
    expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: true }); await expect(page.getByText(copy["memory.liveOnTitle"], { exact: true })).toBeVisible();
    const restored = await call<Session>(page, `/api/bots/${b.id}/sessions`, "POST", {}); expect(restored.id).not.toBe(paused.session.id);
    await call(page, `/api/sessions/${restored.id}/prompt`, "POST", { parts: [{ type: "text", text: "Check restored notes" }] }); await completed(page, restored.id);
    for (const note of saved) expect(system(2)).toContain(note.content); expect(system(2)).not.toContain(first.content);
    const chat = await call<Session>(page, "/api/sessions", "POST", { kind: "chat", model: MODEL }); expect(chat.botID).toBeUndefined();
    await call(page, `/api/sessions/${chat.id}/prompt`, "POST", { parts: [{ type: "text", text: "Ordinary Chat" }] }); await completed(page, chat.id);
    for (const note of [first, ...saved]) expect(system(3)).not.toContain(note.content);
    expect(await notes(a.id)).toEqual([first]); expect(await notes(b.id)).toEqual(saved); expect(await call(page, `/api/sessions/${paused.session.id}/messages`)).toEqual(paused.messages);
    expect(fake.requests).toHaveLength(4); expect(errors).toEqual([]); await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await test.info().attach("memory-context", { body: JSON.stringify({ system: fake.requests.map((_, i) => system(i)), notes: [first, ...saved] }), contentType: "application/json" });
  } finally { try { await app.close(); } finally { try { await fake.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } }
});

test("Memory defaults work without Bots or an account; preview never writes and stored settings win legacy import", async () => {
  const { app, page, dataDir } = await launch({ hash: "#/memory?v=off", locale: "en", env: ENV }); const gate = await observe(app, page);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" }); await expect(memory(page)).toBeChecked(); expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: true });
    await expect(page.getByText(copy["memory.liveEmptyText"], { exact: true })).toBeVisible(); expect(await call(page, "/api/bots")).toEqual([]);
    await show(page, "settings?section=account"); await expect(page.getByText(copy["settings.noAccount"], { exact: true })).toBeVisible();
    await call(page, "/api/settings", "PUT", { memoryEnabled: false }); await show(page, "memory?preview&v=off"); await expect(memory(page)).not.toBeChecked();
    const writes = (await gate.state()).calls.filter((r) => r.method === "PUT").length;
    await page.evaluate((key) => localStorage.setItem(key, "false"), LEGACY); await page.reload(); await expect(memory(page)).not.toBeChecked();
    await memory(page).click(); await expect(memory(page)).toBeChecked(); await memory(page).click(); await expect(memory(page)).not.toBeChecked();
    await show(page, "settings?preview&section=privacy"); await expect(privacy(page)).toBeChecked(); await privacy(page).click(); await expect(privacy(page)).not.toBeChecked(); await fence(page);
    expect((await gate.state()).calls.filter((r) => r.method === "PUT")).toHaveLength(writes); expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: false });
    expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY)).toBe("false"); await call(page, "/api/settings", "PUT", { memoryEnabled: true });
    await show(page, "memory"); await expect(memory(page)).toBeChecked(); await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), LEGACY)).toBeNull();
    expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: true });
    expect((await gate.state()).calls.some((r) => r.method === "PUT" && JSON.parse(r.body!).initializeOnly === true && JSON.parse(r.reply!.body).memoryEnabled === true)).toBe(true);
    expect(await call(page, "/api/bots")).toEqual([]); expect(await call(page, "/api/sessions")).toEqual([]);
  } finally { try { await gate.close(); } finally { try { await app.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } }
});

test("Refused legacy false initialization gates Bot and Work controls until accepted Retry", async () => {
  const fake = await startFakeProvider();
  const { app, page, dataDir } = await launch({ hash: "#/memory?preview&v=off", locale: "en", env: { ...ENV, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } }).catch(async (error) => { await fake.close(); throw error; });
  const gate = await observe(app, page);
  try {
    await call(page, "/api/providers/fake/key", "PUT", { key: "sk-test-memory-migration" });
    const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Migration Bot", persona: "Migration persona remains.", model: MODEL });
    const note = await call<MemoryEntry>(page, `/api/bots/${bot.id}/memory`, "POST", { content: "LEGACY_PAUSED_NOTE_064" });
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.evaluate((key) => localStorage.setItem(key, "false"), LEGACY); await gate.set({ hold: "PUT", refuse: true });
    await page.goto(`${page.url().split("#")[0]}?migration=1#/bot?id=${bot.id}`); await gate.waiting(); await fence(page);
    expect((await gate.state()).calls.map((r) => ({ method: r.method, body: JSON.parse(r.body!) }))).toEqual([{ method: "PUT", body: { memoryEnabled: false, initializeOnly: true } }]);
    await expect(page.locator(".sidebar")).toBeVisible(); await expect(page.locator("main [role=status]")).toBeVisible(); await expect(page.locator("main [data-testid=composer-input], main [role=switch]")).toHaveCount(0);
    await show(page, "work-home"); await fence(page); await expect(page.locator("main [data-testid=composer-input], main [role=switch]")).toHaveCount(0);
    await gate.release(); const refused = (await gate.state()).calls.find((r) => r.method === "PUT")!.reply!;
    expect(refused.status).toBe(400); expect(JSON.parse(refused.body)).toMatchObject({ error: { code: "invalid_request" } });
    await expect(retry(page)).toBeVisible(); await expect(page.locator("main [data-testid=composer-input], main [role=switch]")).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY)).toBe("false"); expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: true });
    expect(fake.requests).toEqual([]); expect(await call(page, "/api/sessions")).toEqual([]);
    await show(page, `bot?id=${bot.id}`); await expect(retry(page)).toBeVisible(); await gate.set({ refuse: false }); await retry(page).click();
    await expect(page.locator(".content-top .title")).toHaveText(bot.name); expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: false });
    expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY)).toBeNull(); expect(await call(page, "/api/sessions")).toEqual([]);
    await page.getByTestId("composer-input").fill("First turn after legacy import"); await page.getByTestId("composer-send").click(); await expect(page.locator(".thread-inner .msg-user")).toHaveText(["First turn after legacy import"]);
    const [session] = await call<Session[]>(page, `/api/bots/${bot.id}/sessions`); await completed(page, session.id); expect(fake.requests).toHaveLength(1);
    const system = (fake.requests[0].body.messages as { role: string; content: string }[]).filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(system).toContain(bot.persona); expect(system).not.toContain(note.content); expect(await call(page, `/api/bots/${bot.id}/memory`)).toEqual([note]);
    await show(page, "memory"); await expect(memory(page)).not.toBeChecked(); await expect(page.locator(".systeme-mem")).toContainText(note.content);
    await show(page, "settings?section=privacy"); await expect(privacy(page)).not.toBeChecked();
  } finally { try { await gate.close(); } finally { try { await app.close(); } finally { try { await fake.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } } }
});

test("Settings reject duplicate pending writes, recover real refusals and ignore stale reads after events/navigation", async () => {
  const { app, page, dataDir } = await launch({ hash: "#/settings?section=privacy", locale: "en", env: ENV }); const gate = await observe(app, page);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" }); await expect(privacy(page)).toBeChecked(); await gate.set({ hold: "PUT", refuse: true });
    await privacy(page).evaluate((button: HTMLElement) => { button.click(); button.click(); }); await gate.waiting();
    expect((await gate.state()).calls.filter((r) => r.method === "PUT")).toHaveLength(1); await expect(privacy(page)).toBeDisabled(); await expect(privacy(page)).toBeChecked();
    expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: true }); await gate.release();
    const refused = (await gate.state()).calls.find((r) => r.method === "PUT")!.reply!; expect(refused.status).toBe(400); expect(JSON.parse(refused.body)).toMatchObject({ error: { code: "invalid_request" } });
    const failure = page.locator("main").getByText(copy["providers.saveFailed"], { exact: true }); await expect(failure).toBeVisible(); await expect(privacy(page)).toBeChecked();
    expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: true }); await gate.set({ refuse: false }); await retry(page).click(); await expect(failure).toHaveCount(0);
    await expect(privacy(page)).toBeEnabled(); await expect(privacy(page)).not.toBeChecked(); expect(await call<RuntimeSettings>(page, "/api/settings")).toEqual({ memoryEnabled: false });
    await call(page, "/api/settings", "PUT", { memoryEnabled: true }); await expect(privacy(page)).toBeChecked(); await gate.set({ hold: "PUT" }); await privacy(page).click(); await gate.waiting();
    await expect(privacy(page)).toBeChecked(); await show(page, "memory"); await expect(memory(page)).toBeChecked(); await gate.release(); await expect(memory(page)).not.toBeChecked();
    expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: false });
    // Two real settings.changed events: retain the older true snapshot until false has painted.
    await gate.set({ hold: "GET" }); await call(page, "/api/settings", "PUT", { memoryEnabled: true }); await gate.waiting();
    const held = (await gate.state()).held!; expect(held.status).toBe(200); expect(JSON.parse(held.body)).toEqual({ memoryEnabled: true });
    const reads = (await gate.state()).calls.filter((r) => r.method === "GET" && r.reply).length;
    await call(page, "/api/settings", "PUT", { memoryEnabled: false }); await expect.poll(async () => (await gate.state()).calls.filter((r) => r.method === "GET" && r.reply).length).toBeGreaterThan(reads);
    await fence(page); await expect(memory(page)).not.toBeChecked(); await gate.release(); await expect(memory(page)).not.toBeChecked();
    await gate.set({ hold: "GET" }); await call(page, "/api/settings", "PUT", { memoryEnabled: true }); await gate.waiting();
    expect(JSON.parse((await gate.state()).held!.body)).toEqual({ memoryEnabled: true }); await show(page, "settings?section=privacy"); await expect(privacy(page)).toBeChecked();
    await privacy(page).click(); await expect(privacy(page)).not.toBeChecked(); await gate.release(); await expect(privacy(page)).not.toBeChecked();
    await gate.set({ hold: "GET", failGet: true }); await show(page, "memory"); await gate.waiting(); await fence(page);
    await expect(page.locator("main [role=status]")).toBeVisible(); await expect(memory(page)).toHaveCount(0);
    await gate.release(); await expect(retry(page)).toBeVisible(); await expect(memory(page)).toHaveCount(0);
    await gate.set({ failGet: false }); await retry(page).click(); await expect(memory(page)).not.toBeChecked(); expect(await call(page, "/api/settings")).toEqual({ memoryEnabled: false });
    await test.info().attach("settings-real-responses", { body: JSON.stringify((await gate.state()).calls), contentType: "application/json" });
  } finally { try { await gate.close(); } finally { try { await app.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } }
});

test("Cancelled preview navigation recovers held Memory reads and Privacy writes", async () => {
  const { app, page, dataDir } = await launch({ hash: "#/home?theme=light", locale: "en", env: ENV });
  const gate = await observe(app, page), evidence: unknown[] = [];
  const holdTransitions = () => page.evaluateHandle(() => {
    const start = document.startViewTransition, live = location.href;
    const owner = document.querySelector(".systeme-memoff, .pg-panel")!;
    const pending: { url: string; release: () => void; done: Promise<void> }[] = [];
    document.startViewTransition = (update) => {
      let release!: () => void;
      const done = new Promise<void>((resolve) => { release = resolve; }).then(() => typeof update === "function" ? update() : update?.update?.());
      pending.push({ url: location.href, release, done });
      return { finished: done, ready: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} };
    };
    return { live, owner, pending, restore: () => { document.startViewTransition = start; } };
  });
  let transitions: Awaited<ReturnType<typeof holdTransitions>> | undefined;
  try {
    for (const method of ["GET", "PUT"] as const) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      // Reset only between phases so a failed read cannot prevent the independent PUT reproduction.
      if (method === "PUT") { await page.reload(); await page.waitForFunction(() => "__bridgeFetch" in window); }
      else await gate.set({ hold: "GET" });
      await show(page, method === "GET" ? "memory" : "settings?section=privacy");
      const control = method === "GET" ? memory(page) : privacy(page);
      if (method === "GET") {
        await gate.waiting(); await expect(page.getByText(copy["memory.liveEmptyText"], { exact: true })).toBeVisible();
        const held = (await gate.state()).held!; expect(held.status).toBe(200); expect(JSON.parse(held.body)).toEqual({ memoryEnabled: true });
        await expect(page.locator("main [role=status]")).toBeVisible(); await expect(control).toHaveCount(0);
      } else {
        await expect(control).toBeChecked(); await expect(control).toBeEnabled(); await gate.set({ hold: "PUT" });
        await control.click(); await gate.waiting(); await expect(control).toBeChecked(); await expect(control).toBeDisabled();
      }
      await fence(page); await page.emulateMedia({ reducedMotion: "no-preference" }); transitions = await holdTransitions();
      await show(page, "home?preview"); await expect(page).toHaveURL(/#\/home\?preview&theme=light$/);
      await expect.poll(() => transitions!.evaluate((p) => p.pending.length)).toBe(1);
      expect(await transitions.evaluate((p) => p.owner.isConnected)).toBe(true); await expect(page.locator(".home")).toHaveCount(0);
      await gate.release();
      const actual = await call<RuntimeSettings>(page, "/api/settings"); expect(actual).toEqual({ memoryEnabled: method === "GET" });
      expect((await gate.state()).calls.filter((r) => r.method === "PUT")).toHaveLength(method === "GET" ? 0 : 1);
      await page.evaluate(() => history.back());
      await expect.poll(() => page.evaluate(() => location.href)).toBe(await transitions.evaluate((p) => p.live));
      await expect.poll(() => transitions!.evaluate((p) => p.pending.length)).toBe(2);
      // Both deferred callbacks read the restored live entry; preview never commits.
      await transitions.evaluate(async (p) => { for (const entry of [...p.pending].reverse()) { entry.release(); await entry.done; } p.restore(); });
      await fence(page); expect(await transitions.evaluate((p) => p.owner.isConnected)).toBe(true); await expect(page.locator(".home")).toHaveCount(0);
      const readControl = () => control.evaluateAll((elements) => elements.map((e) => ({ checked: e.getAttribute("aria-checked"), disabled: e.matches(":disabled, [aria-disabled=true]"), visible: e.getClientRects().length > 0 })));
      await expect.soft.poll(readControl, { message: `${method} recovers the accepted engine value without a stuck loading/disabled owner`, timeout: 2000 }).toEqual([{ checked: String(actual.memoryEnabled), disabled: false, visible: true }]);
      evidence.push({ method, actual, control: await readControl(), transitions: await transitions.evaluate((p) => p.pending.map((entry) => entry.url)) });
      expect((await gate.state()).calls.filter((r) => r.method === "PUT")).toHaveLength(method === "GET" ? 0 : 1);
      await transitions.dispose(); transitions = undefined;
    }
  } finally {
    try { await test.info().attach("cancelled-preview-settings", { body: JSON.stringify({ evidence, calls: (await gate.state()).calls }), contentType: "application/json" }); }
    finally {
      try { if (transitions) { await transitions.evaluate((p) => { p.restore(); p.pending.forEach((entry) => entry.release()); }); await transitions.dispose(); } }
      finally { try { await gate.close(); } finally { try { await app.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } }
    }
  }
});
