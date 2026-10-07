import { test, expect, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import type { Bot, MessageWithParts, ScheduledTask, Session } from "@cortex/schema";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { launch, root } from "./fixtures";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import copy from "../../packages/i18n/locales/en/work.json" with { type: "json" };

const MODEL = { providerID: "fake", modelID: "reasoner" }, INPUT = "PRIVATE_ACTIVITY_PROMPT_731", OUTPUT = "PRIVATE_ACTIVITY_OUTPUT_842", RAW = "PRIVATE_ACTIVITY_ERROR_953";
const CATALOG = `data:application/json,${encodeURIComponent(JSON.stringify({ fake: { ...catalog.fake, models: { reasoner: catalog.fake.models.reasoner } } }))}`;
const rows = (page: Page) => page.locator("button.travail-act"), row = (page: Page, title: string) => rows(page).filter({ hasText: title });
const retry = (page: Page) => page.locator("main").getByRole("button", { name: "Try again", exact: true });
async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ route, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(`${method} ${route}: ${r.status}`);
    return r.status === 204 ? null : r.json();
  }, { route, method, body });
}
const show = (page: Page, route: string, theme = "light") => page.evaluate(({ route, theme }) => history.pushState(null, "", `#/${route}${route.includes("?") ? "&" : "?"}theme=${theme}`), { route, theme });
async function fence(page: Page) { await call(page, "/api/health"); await page.evaluate(() => new Promise<void>((r) => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(() => r()))))); }
const messages = (page: Page, id: string) => call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
const prompt = (page: Page, id: string) => call(page, `/api/sessions/${id}/prompt`, "POST", { parts: [{ type: "text", text: INPUT }] });
async function completed(page: Page, id: string, count = 1) {
  await expect.poll(async () => (await messages(page, id)).filter((m) => m.info.role === "assistant" && Number.isFinite(m.info.time.completed)).length).toBe(count);
  return (await messages(page, id)).filter((m) => m.info.role === "assistant").at(-1)!;
}
const bot = (page: Page, name = "Twin", color = "#FF6A13") => call<Bot>(page, "/api/bots", "POST", { name, model: MODEL, mascot: { shape: "pebble", color, eyes: "dots", mouth: "smile", accessories: [] } });
const session = (page: Page, botID: string, title: string, extra = {}) => call<Session>(page, "/api/sessions", "POST", { title, model: MODEL, kind: "bot", botID, ...extra });
async function provider() {
  const held = new Set<http.ServerResponse>(), state = { mode: "done" as "done" | "hold" | "fail", requests: 0 };
  const finish = (res: http.ServerResponse, fail: boolean) => {
    res.write(`data: ${JSON.stringify(fail ? { error: { message: RAW, type: "fixture" } } : { id: "activity", object: "chat.completion.chunk", created: 1, model: "reasoner", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
    res.end("data: [DONE]\n\n"); held.delete(res);
  };
  const server = http.createServer(async (req, res) => {
    for await (const _ of req) { /* Consume the actual model request before starting its response. */ }
    state.requests++; res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ id: "activity", object: "chat.completion.chunk", created: 1, model: "reasoner", choices: [{ index: 0, delta: { role: "assistant", content: OUTPUT }, finish_reason: null }] })}\n\n`);
    if (state.mode === "hold") { held.add(res); res.on("close", () => held.delete(res)); } else finish(res, state.mode === "fail");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { state, held, url: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, finish: (fail = false) => [...held].forEach((res) => finish(res, fail)), close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}
async function start(theme = "light") {
  const fake = await provider(), env = { CORTEX_CATALOG_URL: CATALOG, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` };
  const app = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env }).catch(async (e) => { await fake.close(); throw e; });
  await app.page.emulateMedia({ reducedMotion: "reduce" }); await call(app.page, "/api/providers/fake/key", "PUT", { key: "sk-test-work-activity" });
  return { ...app, fake, env };
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready); await fence(page);
  expect(await page.locator("main, .travail-narrow, .travail-act, .travail-act .travail-grow").evaluateAll((elements) => elements.filter((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 1; }).map((e) => e.className))).toEqual([]);
  const file = test.info().outputPath(`${name}.png`); await page.screenshot({ path: file, animations: "disabled" }); await test.info().attach(name, { path: file, contentType: "image/png" });
}
type Wire = { url: string; method: string; headers: [string, string][]; body?: string };
type Reply = { status: number; headers: [string, string][]; body: string };
type Gate = { hold?: string; fail: string[]; held?: Reply; heldURL?: string; returned: boolean; release?: () => void; restore: () => void; calls: { path: string; method: string; status?: number }[] };
async function observe(app: ElectronApplication, page: Page) {
  await app.evaluate(({ ipcMain }) => {
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, req: Wire) => Promise<Reply>> })._invokeHandlers.get("cortex:fetch")!;
    const g: Gate = { fail: [], returned: false, calls: [], restore: () => { ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", original); } };
    (globalThis as unknown as { activityGate: Gate }).activityGate = g; ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, req: Wire) => {
      const url = new URL(req.url), path = url.pathname, hold = req.method === "GET" && g.hold === path + url.search, entry: Gate["calls"][number] = { path, method: req.method }; g.calls.push(entry); if (hold) g.hold = undefined;
      // Every response comes from the real protocol; selected GETs use a missing route or await delivery.
      const response = await original(event, req.method === "GET" && g.fail.includes(path) ? { ...req, url: "cortex://local/api/missing-activity-source" } : req);
      if (hold) { g.held = response; g.heldURL = path + url.search; await new Promise<void>((r) => { g.release = r; }); g.returned = true; }
      entry.status = response.status; return response;
    });
  });
  const state = () => app.evaluate(() => { const g = (globalThis as unknown as { activityGate: Gate }).activityGate; return { calls: g.calls, held: g.held, heldURL: g.heldURL, waiting: !!g.release, returned: g.returned }; });
  return { state, set: (options: Partial<Pick<Gate, "hold" | "fail">>) => app.evaluate((_, options) => { Object.assign((globalThis as unknown as { activityGate: Gate }).activityGate, options, { held: undefined, heldURL: undefined, returned: false }); }, options),
    waiting: () => expect.poll(async () => (await state()).waiting).toBe(true),
    release: async () => { await app.evaluate(() => { const g = (globalThis as unknown as { activityGate: Gate }).activityGate; g.release?.(); g.release = undefined; }); await expect.poll(async () => (await state()).returned).toBe(true); await fence(page); },
    close: () => app.evaluate(() => { const g = (globalThis as unknown as { activityGate: Gate }).activityGate; g.release?.(); g.restore(); }),
  };
}

for (const theme of ["light", "dark"]) test(`Activity persists finished outcomes, exact same-name Bot identity and earlier turns through restart — ${theme}`, async () => {
  const launched = await start(theme), { fake, env, dataDir } = launched; let { app, page } = launched;
  let intentionallyExited = false;
  const errors: string[] = [], setup = async () => { page.on("pageerror", (e) => errors.push(e.message)); await page.emulateMedia({ reducedMotion: "reduce" }); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640)); };
  try {
    await setup(); const a = await bot(page), b = await bot(page, "Twin", "#8448FF");
    const good = await session(page, a.id, `Café handoff ${"W".repeat(80)}`), failed = await session(page, b.id, "Violet failure"), interrupted = await session(page, a.id, "Amber interruption");
    await prompt(page, good.id); expect((await completed(page, good.id)).info.error).toBeUndefined();
    fake.state.mode = "fail"; await prompt(page, failed.id); const failure = await completed(page, failed.id); expect(failure.info.error).toBeDefined(); expect(failure.info.error?.code).not.toBe("aborted");
    fake.state.mode = "hold"; await prompt(page, interrupted.id); await expect.poll(() => fake.held.size).toBe(1); await call(page, `/api/sessions/${interrupted.id}/abort`, "POST"); expect((await completed(page, interrupted.id)).info.error?.code).toBe("aborted");
    fake.state.mode = "done"; const task = await call<ScheduledTask>(page, "/api/tasks", "POST", { title: "Routine handoff", prompt: INPUT, botID: b.id, model: MODEL, enabled: false, schedule: { type: "daily", time: "09:00" } });
    await call(page, `/api/tasks/${task.id}/run`, "POST"); await expect.poll(async () => (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs[0]?.status).toBe("success");
    const routine = (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs[0]; expect(routine.sessionID).toBeTruthy();
    await show(page, "activity", theme); await expect(rows(page)).toHaveCount(4); await expect(rows(page)).toContainText([task.title, interrupted.title, failed.title, good.title]);
    await expect(row(page, good.title)).toContainText(copy["act.completed"]); await expect(row(page, failed.title)).toContainText(copy["act.failed"]); await expect(row(page, interrupted.title)).toContainText(copy["act.interrupted"]);
    await expect(page.getByText(copy["act.recentScope"], { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: copy["act.export"], exact: true })).toBeDisabled();
    await expect(page.getByRole("group", { name: copy["act.filterByType"], exact: true }).getByRole("button")).toHaveText([copy["act.type.all"], copy["act.type.errors"]]);
    for (const sentinel of [INPUT, OUTPUT, RAW, failure.info.error!.message]) await expect(page.locator("main")).not.toContainText(sentinel);
    await capture(page, `activity-outcomes-${theme}`);
    await page.getByRole("button", { name: copy["act.type.errors"], exact: true }).click(); await expect(rows(page)).toHaveCount(2);
    await expect(rows(page)).toContainText([interrupted.title, failed.title]); await page.getByRole("button", { name: copy["act.type.all"], exact: true }).click();
    await page.getByRole("button", { name: copy.allBots, exact: true }).click(); const twins = page.getByRole("menuitem").filter({ hasText: "Twin" }); await expect(twins).toHaveCount(2);
    await twins.filter({ has: page.locator(`.m-shape[fill="${a.mascot.color}"]`) }).click(); await expect(rows(page)).toHaveCount(2); await expect(rows(page)).toContainText([interrupted.title, good.title]);
    await row(page, good.title).focus(); await page.keyboard.press("Enter"); await expect(page).toHaveURL(new RegExp(`#/work-task\\?[^#]*id=${good.id}`));
    await expect(page.locator("main .content-top .title")).toHaveText(good.title); await expect(page.locator("main .msg-bot-row .m-shape")).toHaveAttribute("fill", a.mascot.color);
    await show(page, "activity", theme); await row(page, task.title).click(); await expect(page).toHaveURL(new RegExp(`id=${routine.sessionID}`));
    await expect(page.locator("main .msg-bot-row .m-shape")).toHaveAttribute("fill", b.mascot.color);
    await show(page, "activity", theme); await expect(row(page, good.title)).toContainText(copy["act.completed"]); const prior = await row(page, good.title).innerText();
    fake.state.mode = "hold"; await prompt(page, good.id); await expect.poll(() => fake.held.size).toBe(1); expect((await messages(page, good.id)).at(-1)?.info.time.completed).toBeUndefined();
    await fence(page); await expect(row(page, good.title)).toHaveText(prior, { useInnerText: true }); await page.reload(); await expect(row(page, good.title)).toHaveText(prior, { useInnerText: true }); fake.finish(true); const newer = await completed(page, good.id, 2);
    expect(newer.info.error).toBeDefined(); await expect(row(page, good.title)).toContainText(copy["act.failed"]); await expect(rows(page).first()).toContainText(good.title);
    const unfinished = await session(page, b.id, "Never finished"), saved = await messages(page, good.id), finishedText = await row(page, good.title).innerText();
    await prompt(page, good.id); await prompt(page, unfinished.id); await expect.poll(() => fake.held.size).toBe(2);
    const profileReceipt = async () => {
      const paths = await app.evaluate(({ app, safeStorage }) => ({
        userData: app.getPath("userData"), sessionData: app.getPath("sessionData"),
        encryptionAvailable: safeStorage.isEncryptionAvailable(),
      }));
      const stateFile = path.join(paths.sessionData, "Local State");
      const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : undefined;
      const wrappedKey = state?.os_crypt?.encrypted_key;
      const credentialsFile = path.join(dataDir, "credentials.json");
      return { ...paths, stateExists: !!state,
        wrappedKeyHash: typeof wrappedKey === "string" ? createHash("sha256").update(wrappedKey).digest("hex") : null,
        credentialsHash: fs.existsSync(credentialsFile) ? createHash("sha256").update(fs.readFileSync(credentialsFile)).digest("hex") : null,
      };
    };
    await test.info().attach("before-crash-profile", { body: JSON.stringify(await profileReceipt()), contentType: "application/json" });
    // Every Electron process (GPU, renderer, utility) holds profile and data files; the relaunch waits for all of them, not only the parent.
    const tree = await app.evaluate(({ app }) => app.getAppMetrics().map((metric) => metric.pid));
    const child = app.process(), closed = app.waitForEvent("close");
    const exited = once(child, "exit", { signal: AbortSignal.timeout(30_000) });
    // Observe late rejections if the kill command throws; normal awaits still reject.
    void exited.catch(() => {});
    void closed.catch(() => {});
    if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else child.kill("SIGKILL");
    const [exit] = await Promise.all([exited, closed]);
    intentionallyExited = true;
    const alive = () => tree.filter((pid) => { try { process.kill(pid, 0); return true; } catch { return false; } });
    await expect.poll(alive, { timeout: 30_000 }).toEqual([]);
    await test.info().attach("crash-tree-exit", { body: JSON.stringify({ pid: child.pid, code: exit[0], signal: exit[1], tree }), contentType: "application/json" });
    app = await electron.launch({ args: [path.join(root, "packages/desktop/dist/main.cjs"), `--user-data-dir=${path.join(dataDir, "renderer")}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])], env: { ...process.env, ...env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: `#/activity?theme=${theme}`, CORTEX_LOCALE: "en" } as Record<string, string> });
    intentionallyExited = false;
    const restartLog: string[] = [];
    app.process().stderr?.on("data", (chunk: Buffer) => restartLog.push(chunk.toString()));
    const bootReceipt = () => app.evaluate(() => (globalThis as unknown as { cortexTestBoot?: { stage: string; errorName?: string } }).cortexTestBoot);
    try {
      // The window event or a boot failure, whichever comes first; a failed boot never opens a window.
      const failed = expect.poll(async () => (await bootReceipt())?.errorName, { timeout: 30_000 }).toBeDefined().then(() => { throw new Error(`Restart boot failed: ${JSON.stringify(restartLog.join("").slice(-2000))}`); });
      void failed.catch(() => {});
      page = await Promise.race([app.firstWindow({ timeout: 30_000 }), failed]);
    } catch (error) {
      await test.info().attach("restart-boot-state", { body: JSON.stringify(await bootReceipt()), contentType: "application/json" });
      await test.info().attach("restart-main-stderr", { body: restartLog.join(""), contentType: "text/plain" });
      await test.info().attach("after-crash-profile", { body: JSON.stringify(await profileReceipt()), contentType: "application/json" });
      const windows = await app.evaluate(({ app, BrowserWindow }) => ({
        ready: app.isReady(), windows: BrowserWindow.getAllWindows().map((window) => ({
          id: window.id, visible: window.isVisible(), destroyed: window.isDestroyed(),
          url: window.webContents.getURL(), loading: window.webContents.isLoading(),
        })),
      }));
      await test.info().attach("restart-window-state", { body: JSON.stringify(windows), contentType: "application/json" });
      throw error;
    }
    const boot = await bootReceipt();
    await test.info().attach("restart-boot-state", { body: JSON.stringify(boot), contentType: "application/json" });
    expect(boot).toEqual({ stage: "ready" });
    await page.waitForFunction(() => "__bridgeFetch" in window); await setup();
    await expect(rows(page)).toHaveCount(4); await expect(row(page, good.title)).toHaveText(finishedText, { useInnerText: true }); await expect(row(page, unfinished.title)).toHaveCount(0);
    expect((await messages(page, good.id)).slice(0, saved.length)).toEqual(saved); expect((await messages(page, good.id)).at(-1)?.info.time.completed).toBeUndefined();
    await expect(row(page, interrupted.title)).toContainText(copy["act.interrupted"]); await expect(row(page, task.title)).toContainText(copy["act.completed"]);
    await capture(page, `activity-reopened-${theme}`); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900));
    await row(page, failed.title).click(); await expect(page).toHaveURL(new RegExp(`id=${failed.id}`)); expect(errors).toEqual([]);
  } finally { try { if (!intentionallyExited) await app.close(); } finally { try { await fake.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } }
});

test("Activity reads at most 40 eligible roots before Bot filtering and follows updated recency", async () => {
  const { app, page, dataDir, fake } = await start(); let gate: Awaited<ReturnType<typeof observe>> | undefined;
  try {
    const a = await bot(page, "Older Bot"), b = await bot(page, "Recent Bot"), old = await session(page, a.id, "Older finished conversation"); await prompt(page, old.id); await completed(page, old.id);
    const recent: Session[] = []; for (let i = 0; i < 40; i++) recent.push(await session(page, i === 39 ? a.id : b.id, `Recent conversation ${i}`));
    await prompt(page, recent[39].id); await completed(page, recent[39].id);
    for (const extra of [{ parentID: recent[0].id }, { kind: "chat" }, { botID: "" }]) { const excluded = await session(page, b.id, "Excluded completed conversation", extra); await prompt(page, excluded.id); await completed(page, excluded.id); }
    await fence(page); gate = await observe(app, page); await show(page, "activity"); await expect(rows(page)).toHaveCount(1); await expect(row(page, recent[39].title)).toContainText(copy["act.completed"]);
    const histories = () => gate!.state().then((s) => s.calls.filter((c) => c.method === "GET" && /\/messages$/.test(c.path)).map((c) => c.path));
    expect((await histories()).sort()).toEqual(recent.map((s) => `/api/sessions/${s.id}/messages`).sort());
    await page.getByRole("button", { name: copy.allBots, exact: true }).click(); await page.getByRole("menuitem").filter({ hasText: a.name }).click(); await fence(page);
    await expect(rows(page)).toHaveCount(1); expect((await histories()).includes(`/api/sessions/${old.id}/messages`)).toBe(false);
    await call(page, `/api/sessions/${old.id}`, "PATCH", { title: "Promoted finished conversation" }); await expect(rows(page)).toHaveCount(2); await expect(row(page, "Promoted finished conversation")).toContainText(copy["act.completed"]);
    expect(await histories()).toContain(`/api/sessions/${old.id}/messages`); expect(fake.state.requests).toBe(5);
  } finally { try { await gate?.close(); } finally { try { await app.close(); } finally { try { await fake.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } } }
});

test("Activity reports session, Bot and still-listed history refusals with accepted Retry", async () => {
  const { app, page, dataDir, fake } = await start(); let gate: Awaited<ReturnType<typeof observe>> | undefined;
  try {
    const owner = await bot(page), s = await session(page, owner.id, "Recoverable finished turn"); await prompt(page, s.id); await completed(page, s.id); gate = await observe(app, page);
    for (const source of ["/api/sessions", "/api/bots", `/api/sessions/${s.id}/messages`]) {
      await show(page, "home"); await gate.set({ fail: [source] }); await show(page, "activity");
      await expect(page.getByText(copy["error.loadTitle"], { exact: true })).toBeVisible(); await expect(retry(page)).toBeVisible();
      await expect(page.getByText(copy["act.recentEmptyTitle"], { exact: true })).toHaveCount(0); await expect(page.getByText(copy["act.missingBot"], { exact: true })).toHaveCount(0);
      expect((await gate.state()).calls.some((c) => c.path === source && c.status === 404)).toBe(true);
      await gate.set({ fail: [] }); await retry(page).click(); await expect(rows(page)).toHaveCount(1); await expect(row(page, s.title)).toContainText(copy["act.completed"]);
    }
    const history = `/api/sessions/${s.id}/messages`;
    await gate.set({ hold: history, fail: [history] }); await call(page, `/api/sessions/${s.id}`, "PATCH", { title: s.title }); await gate.waiting(); expect((await gate.state()).held?.status).toBe(404);
    await gate.set({ fail: [history, "/api/sessions"] }); await gate.release(); await expect(retry(page)).toBeVisible(); await expect(page.getByText(copy["act.recentEmptyTitle"], { exact: true })).toHaveCount(0);
    await gate.set({ fail: [] }); await retry(page).click(); await expect(rows(page)).toHaveCount(1); await expect(row(page, s.title)).toContainText(copy["act.completed"]);
    await test.info().attach("activity-refusals", { body: JSON.stringify((await gate.state()).calls), contentType: "application/json" });
  } finally { try { await gate?.close(); } finally { try { await app.close(); } finally { try { await fake.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } } }
});

test("Activity and Work task keep deleted or dangling Bot identity neutral", async () => {
  const { app, page, dataDir, fake } = await start();
  try {
    const removed = await bot(page, "Former owner"), keeper = await bot(page, "Current unrelated Bot", "#FF6A13");
    const orphan = await session(page, removed.id, "Orphaned finished turn"), dangling = await session(page, "never-created-bot", "Dangling finished turn");
    for (const s of [orphan, dangling]) { await prompt(page, s.id); await completed(page, s.id); }
    await call(page, `/api/bots/${removed.id}`, "DELETE");
    for (const s of [orphan, dangling]) {
      await show(page, "activity"); await expect(rows(page)).toHaveCount(2); await expect(row(page, s.title)).toContainText(copy["act.missingBot"]);
      await expect(row(page, s.title)).not.toContainText(keeper.name); await row(page, s.title).focus(); await page.keyboard.press("Enter"); await expect(page).toHaveURL(new RegExp(`id=${s.id}`));
      await expect(page.getByTestId("composer-input")).toHaveAttribute("placeholder", copy["task.composer"].replace("{name}", copy["act.missingBot"]));
      await expect(page.locator("main")).not.toContainText(keeper.name); await expect(page.locator(`main .m-shape[fill="${keeper.mascot.color}"]`)).toHaveCount(0); await expect(page.locator("main")).not.toContainText("Deleted Bot");
    }
  } finally { try { await app.close(); } finally { try { await fake.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } }
});

test("Activity retires deleted rows before stale delivery and recovers cancelled preview reads", async () => {
  const { app, page, dataDir, fake } = await start(); let gate: Awaited<ReturnType<typeof observe>> | undefined;
  let restore: (() => Promise<void>) | undefined;
  try {
    const owner = await bot(page, "Removed owner"), survivor = await bot(page, "Surviving owner"), a = await session(page, owner.id, "Removed row"), b = await session(page, survivor.id, "Surviving row");
    for (const s of [a, b]) { await prompt(page, s.id); await completed(page, s.id); }
    gate = await observe(app, page); await show(page, "activity"); await expect(rows(page)).toHaveCount(2);
    await gate.set({ hold: `/api/sessions/${a.id}/messages` }); await call(page, `/api/sessions/${a.id}`, "PATCH", { title: "Retired row" }); await gate.waiting();
    expect((await gate.state()).held?.status).toBe(200); await page.getByRole("button", { name: copy.allBots, exact: true }).click();
    await page.getByRole("menuitem").filter({ hasText: survivor.name }).click(); await call(page, `/api/sessions/${a.id}`, "DELETE"); await expect(rows(page)).toHaveCount(1); await expect(row(page, b.title)).toBeVisible();
    await gate.release(); await page.getByRole("button", { name: copy["act.clear"], exact: true }).click(); await expect(rows(page)).toHaveCount(1); await expect(page.locator("main")).not.toContainText("Retired row");
    const retire = await session(page, owner.id, "Immediate retirement"); await prompt(page, retire.id); await completed(page, retire.id); await expect(rows(page)).toHaveCount(2);
    await gate.set({ hold: "/api/sessions?kind=bot" }); await call(page, `/api/sessions/${retire.id}`, "DELETE"); await gate.waiting(); expect((await gate.state()).heldURL).toBe("/api/sessions?kind=bot");
    await expect(row(page, retire.title)).toHaveCount(0); await expect(rows(page)).toHaveCount(1); await gate.release(); await expect(rows(page)).toHaveCount(1);
    await show(page, "home"); await gate.set({ hold: `/api/sessions/${b.id}/messages` }); await show(page, "activity"); await gate.waiting(); await fence(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const transitions = await page.evaluateHandle(() => {
      const start = document.startViewTransition, live = location.href, owner = document.querySelector("main .content-top")!;
      const pending: { release: () => void; done: Promise<void> }[] = [];
      document.startViewTransition = (update) => { let release!: () => void; const done = new Promise<void>((r) => { release = r; }).then(() => typeof update === "function" ? update() : update?.update?.()); pending.push({ release, done }); return { ready: done, finished: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} }; };
      return { live, owner, pending, restore: () => { document.startViewTransition = start; pending.forEach((p) => p.release()); } };
    });
    restore = async () => { await transitions.evaluate((p) => p.restore()); await transitions.dispose(); };
    await show(page, "home?preview"); await expect.poll(() => transitions.evaluate((p) => p.pending.length)).toBe(1); expect(new URL(await page.evaluate(() => location.href)).hash).toContain("home?preview"); await gate.release(); await page.evaluate(() => history.back());
    await expect.poll(() => page.evaluate(() => location.href)).toBe(await transitions.evaluate((p) => p.live)); await expect.poll(() => transitions.evaluate((p) => p.pending.length)).toBe(2);
    await transitions.evaluate(async (p) => { for (const t of [...p.pending].reverse()) { t.release(); await t.done; } p.restore(); }); await fence(page);
    expect(await transitions.evaluate((p) => p.owner.isConnected)).toBe(true); await expect(page.locator(".home")).toHaveCount(0); await expect(rows(page)).toHaveCount(1); await expect(row(page, b.title)).toBeVisible();
    await restore(); restore = undefined; await page.emulateMedia({ reducedMotion: "reduce" });
    await gate.set({ hold: `/api/sessions/${b.id}/messages`, fail: [`/api/sessions/${b.id}/messages`] }); await call(page, `/api/sessions/${b.id}`, "PATCH", { title: b.title }); await gate.waiting();
    expect((await gate.state()).held?.status).toBe(404); await call(page, `/api/sessions/${b.id}`, "DELETE"); await gate.release();
    await expect(rows(page)).toHaveCount(0); await expect(page.getByRole("heading", { name: copy["act.recentEmptyTitle"], exact: true })).toBeVisible();
    const writes = (await gate.state()).calls.filter((c) => c.method !== "GET").length;
    await show(page, "activity?preview&v=filtered"); await expect(page.locator(".travail-tline .travail-act").first()).toBeVisible(); await fence(page);
    expect((await gate.state()).calls.filter((c) => c.method !== "GET")).toHaveLength(writes); expect(await call(page, "/api/sessions")).toEqual([]);
  } finally { try { await restore?.(); } finally { try { await gate?.close(); } finally { try { await app.close(); } finally { try { await fake.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } } } }
});
