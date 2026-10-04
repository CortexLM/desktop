import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import type { Bot, MemoryEntry } from "@cortex/schema";
import { launch } from "./fixtures";

const env = { CORTEX_CATALOG_URL: "data:application/json,{}", CORTEX_TEST_PROVIDER_BASEURL: "" };
const model = { providerID: "test", modelID: "test" };
type WireRequest = { method: string; url: string; headers: [string, string][]; body?: string };
type WireResponse = { status: number; headers: [string, string][]; body: string };
type MemoryRequest = { method: string; id: string; status?: number; code?: string };
type Gate = { hold: boolean; refuse: string[]; requests: MemoryRequest[]; release: Record<string, (() => void)[]>;
  holdReads: string[]; refuseReads: string[]; reads: { path: string; status?: number }[]; releaseReads: Record<string, (() => void)[]> };

async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ route, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${method} ${route}: ${r.status}`);
    return r.json();
  }, { route, method, body });
}

async function show(page: Page, route: string, theme: string) {
  await page.evaluate(({ route, theme }) => history.pushState(null, "", `#/${route}${route.includes("?") ? "&" : "?"}theme=${theme}`), { route, theme });
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function capture(page: Page, name: string) {
  const file = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path: file, animations: "disabled" });
  await test.info().attach(name, { path: file, contentType: "image/png" });
}

async function observeMemory(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }) => {
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (event: unknown, request: WireRequest) => Promise<WireResponse>> })._invokeHandlers.get("cortex:fetch")!;
    const gate: Gate = { hold: false, refuse: [], requests: [], release: {}, holdReads: [], refuseReads: [], reads: [], releaseReads: {} };
    (globalThis as unknown as { memoryGate: Gate }).memoryGate = gate;
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
      const pathname = new URL(request.url).pathname;
      if (request.method === "GET" && (pathname === "/api/bots" || /^\/api\/bots\/[^/]+\/memory$/.test(pathname))) {
        const read: Gate["reads"][number] = { path: pathname }; gate.reads.push(read);
        const response = await original(event, gate.refuseReads.includes(pathname) ? { ...request, url: request.url + "/missing-list" } : request);
        read.status = response.status;
        // Hold an actual engine response, including its real snapshot; never synthesize list data.
        if (gate.holdReads.includes(pathname)) await new Promise<void>((resolve) => { (gate.releaseReads[pathname] ??= []).push(resolve); });
        return response;
      }
      const match = pathname.match(/^\/api\/bots\/[^/]+\/memory(?:\/([^/]+))?$/);
      if (!match || !["POST", "DELETE"].includes(request.method)) return original(event, request);
      const entry: MemoryRequest = { method: request.method, id: match[1] ?? "add" };
      gate.requests.push(entry);
      // Delay selected requests only; the production IPC callback and real engine decide every response.
      if (gate.hold) await new Promise<void>((resolve) => { (gate.release[entry.id] ??= []).push(resolve); });
      // A deliberately missing entry ID makes the real delete handler refuse; never manufacture a response.
      const response = await original(event, gate.refuse.includes(entry.id) ? { ...request, url: request.url + "-missing" } : request);
      entry.status = response.status;
      if (response.status >= 400) entry.code = JSON.parse(response.body).error.code;
      return response;
    });
  });
}

const requests = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { memoryGate: Gate }).memoryGate.requests);
const hold = (app: ElectronApplication) => app.evaluate(() => {
  const gate = (globalThis as unknown as { memoryGate: Gate }).memoryGate;
  gate.hold = true; gate.requests = []; gate.release = {};
});
const release = (app: ElectronApplication, id?: string) => app.evaluate((_, id) => {
  const gate = (globalThis as unknown as { memoryGate: Gate }).memoryGate;
  if (id) { gate.release[id]?.forEach((f) => f()); delete gate.release[id]; }
  else {
    gate.hold = false; Object.values(gate.release).flat().forEach((f) => f()); gate.release = {};
    gate.holdReads = []; Object.values(gate.releaseReads).flat().forEach((f) => f()); gate.releaseReads = {};
  }
}, id ?? null);
const refuse = (app: ElectronApplication, ids: string[]) => app.evaluate((_, ids) => {
  (globalThis as unknown as { memoryGate: Gate }).memoryGate.refuse = ids;
}, ids);
const holdRead = (app: ElectronApplication, path: string, refuse = false) => app.evaluate((_, { path, refuse }) => {
  const gate = (globalThis as unknown as { memoryGate: Gate }).memoryGate;
  gate.holdReads.push(path); if (refuse) gate.refuseReads.push(path);
}, { path, refuse });
const releaseRead = (app: ElectronApplication, path: string) => app.evaluate((_, path) => {
  const gate = (globalThis as unknown as { memoryGate: Gate }).memoryGate;
  gate.holdReads = gate.holdReads.filter((p) => p !== path);
  gate.refuseReads = gate.refuseReads.filter((p) => p !== path);
  gate.releaseReads[path]?.forEach((f) => f()); delete gate.releaseReads[path];
}, path);
const heldReads = (app: ElectronApplication, path: string) => app.evaluate((_, path) => (globalThis as unknown as { memoryGate: Gate }).memoryGate.releaseReads[path]?.length ?? 0, path);

for (const theme of ["light", "dark"]) {
  test(`Bot memory read races keep drafts and rows bound to accepted ownership — 960 ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      const a = await call<Bot>(page, "/api/bots", "POST", { name: "First memory owner", model });
      const b = await call<Bot>(page, "/api/bots", "POST", { name: "Second memory owner", model });
      const aMemory = await call<MemoryEntry>(page, `/api/bots/${a.id}/memory`, "POST", { content: "First owner private memory" });
      const bMemory = await call<MemoryEntry>(page, `/api/bots/${b.id}/memory`, "POST", { content: "Second owner private memory" });
      const bPath = `/api/bots/${b.id}/memory`;
      await observeMemory(app);
      await holdRead(app, "/api/bots");
      await show(page, `bot-settings?id=${a.id}&v=memory`, theme);
      const add = page.getByRole("button", { name: "Add", exact: true });
      const input = page.getByPlaceholder("New memory…", { exact: true });
      const rows = page.locator(".pg-panel input[readonly]");
      const wipe = page.getByRole("button", { name: "Forget everything", exact: true });
      await expect.poll(() => heldReads(app, "/api/bots")).toBeGreaterThan(0);
      await expect.soft(add).toBeDisabled({ timeout: 1000 });
      await add.evaluate((el: HTMLButtonElement) => el.click());
      await expect.soft(input).toHaveCount(0, { timeout: 1000 });
      await capture(page, `memory-owner-loading-${theme}`);
      await releaseRead(app, "/api/bots");
      await expect(page.getByRole("textbox", { name: "Memory 1", exact: true })).toHaveValue(aMemory.content);

      // Explicit cancellation must not become an onBlur write when the input unmounts.
      await add.click();
      await input.fill("Cancel this draft without writing it");
      await input.press("Escape");
      await expect(input).toHaveCount(0);
      expect(await requests(app)).toEqual([]);

      await holdRead(app, bPath);
      await show(page, `bot-settings?id=${b.id}&v=memory`, theme);
      await expect(page.locator(".content-top .title")).toHaveText("Second memory owner settings");
      await expect.poll(() => heldReads(app, bPath)).toBe(1);
      await expect.soft(rows).toHaveCount(0, { timeout: 1000 });
      await expect.soft(wipe).toBeDisabled({ timeout: 1000 });
      await expect.soft(page.getByText("Empty memory", { exact: true })).toHaveCount(0, { timeout: 1000 });
      await capture(page, `memory-owner-read-pending-${theme}`);
      await releaseRead(app, bPath);
      await expect(page.getByRole("textbox", { name: "Memory 1", exact: true })).toHaveValue(bMemory.content);
      expect(await requests(app)).toEqual([]);

      await holdRead(app, bPath);
      await page.getByRole("button", { name: "Forget", exact: true }).click();
      await expect.poll(() => heldReads(app, bPath)).toBe(1);
      expect(await requests(app)).toEqual([{ method: "DELETE", id: bMemory.id, status: 200 }]);
      await expect.soft(rows).toHaveCount(0, { timeout: 1000 });
      await expect.soft(wipe).toBeDisabled({ timeout: 1000 });
      await capture(page, `memory-deleted-refresh-pending-${theme}`);
      // Returning while both owners' reads are held must not revive a known accepted deletion.
      const aPath = `/api/bots/${a.id}/memory`;
      await holdRead(app, aPath);
      await show(page, `bot-settings?id=${a.id}&v=memory`, theme);
      await expect.poll(() => heldReads(app, aPath)).toBe(1);
      await show(page, `bot-settings?id=${b.id}&v=memory`, theme);
      await expect.poll(() => heldReads(app, bPath)).toBe(2);
      await expect(rows).toHaveCount(0);
      await expect(wipe).toBeDisabled();
      await wipe.evaluate((el: HTMLButtonElement) => el.click());
      expect(await requests(app)).toEqual([{ method: "DELETE", id: bMemory.id, status: 200 }]);
      await releaseRead(app, aPath);
      await releaseRead(app, bPath);
      await expect(rows).toHaveCount(0);
      expect(await call<MemoryEntry[]>(page, `/api/bots/${a.id}/memory`)).toEqual([aMemory]);
      expect(await call<MemoryEntry[]>(page, bPath)).toEqual([]);

      await holdRead(app, bPath, true);
      await page.reload();
      await expect.poll(() => heldReads(app, bPath)).toBe(1);
      await releaseRead(app, bPath);
      await expect(page.getByRole("heading", { name: "Couldn’t load this", exact: true })).toBeVisible();
      await expect(page.getByText("Empty memory", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await expect(page.getByText("Empty memory", { exact: true })).toBeVisible();
      expect(await requests(app)).toEqual([{ method: "DELETE", id: bMemory.id, status: 200 }]);

      const primary = (await call<Bot[]>(page, "/api/bots"))[0];
      const primaryPath = `/api/bots/${primary.id}/memory`;
      await holdRead(app, primaryPath, true);
      await show(page, "memory", theme);
      await expect.poll(() => heldReads(app, primaryPath)).toBe(1);
      await releaseRead(app, primaryPath);
      await expect(page.getByRole("heading", { name: "Couldn’t load this", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "No memories yet", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Couldn’t load this", exact: true })).toHaveCount(0);
      if (primary.id === a.id) await expect(page.locator(".systeme-mem")).toContainText(aMemory.content);
      else await expect(page.getByRole("heading", { name: "No memories yet", exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { await release(app).catch(() => {}); await app.close(); }
  });

  test(`Bot memory retains refused drafts and accepts one owned write — 960 ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      const removed = await call<Bot>(page, "/api/bots", "POST", { name: "Deleted memory owner", model });
      const accepted = await call<Bot>(page, "/api/bots", "POST", { name: "Accepted memory owner", model });
      const next = await call<Bot>(page, "/api/bots", "POST", { name: "Next memory owner", model });
      await observeMemory(app);
      await show(page, `bot-settings?id=${removed.id}&v=memory`, theme);
      const add = page.getByRole("button", { name: "Add", exact: true });
      const input = page.getByPlaceholder("New memory…", { exact: true });
      const draft = "  Keep my exact memory draft.  ";
      await add.click();
      await input.fill(draft);
      await call(page, `/api/bots/${removed.id}`, "DELETE");
      await input.press("Enter");
      await expect(page.getByText("Couldn’t save. Try again.", { exact: true })).toBeVisible();
      expect(await requests(app)).toEqual([{ method: "POST", id: "add", status: 404, code: "not_found" }]);
      await expect(input).toHaveValue(draft);
      await expect(input).toBeEditable();
      await capture(page, `memory-add-refused-${theme}`);

      // A same-component Bot change must not carry the refused draft into another Bot.
      await show(page, `bot-settings?id=${accepted.id}&v=memory`, theme);
      await expect(input).toHaveCount(0);
      await expect(page.getByText("Empty memory", { exact: true })).toBeVisible();
      await add.click();
      await input.fill(draft);
      await hold(app);
      await input.evaluate((el: HTMLInputElement) => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        el.blur();
      });
      await expect.poll(async () => (await requests(app)).length).toBe(1);
      await expect(input).toHaveValue(draft);
      await expect(input).toHaveJSProperty("readOnly", true);
      await expect(add).toBeDisabled();
      await input.press("Escape");
      await expect(input).toHaveValue(draft);
      expect(await call<MemoryEntry[]>(page, `/api/bots/${accepted.id}/memory`)).toEqual([]);
      await release(app);
      await expect(input).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Memory 1", exact: true })).toHaveValue(draft.trim());
      expect(await requests(app)).toEqual([{ method: "POST", id: "add", status: 201 }]);
      expect(await call<MemoryEntry[]>(page, `/api/bots/${accepted.id}/memory`)).toHaveLength(1);

      await add.click();
      await input.fill("Accepted after navigation");
      await hold(app);
      await input.press("Enter");
      await expect.poll(async () => (await requests(app)).length).toBe(1);
      await show(page, `bot-settings?id=${next.id}&v=memory`, theme);
      await expect(input).toHaveCount(0);
      await add.click();
      await input.fill("Keep the next Bot’s draft");
      await release(app);
      await expect.poll(async () => (await requests(app))[0]?.status).toBe(201);
      await expect(input).toHaveValue("Keep the next Bot’s draft");
      await expect(input).toBeEditable();
      expect(await call<MemoryEntry[]>(page, `/api/bots/${next.id}/memory`)).toEqual([]);
      expect(await call<MemoryEntry[]>(page, `/api/bots/${accepted.id}/memory`)).toHaveLength(2);
      await input.press("Escape");
      await show(page, `bot-settings?id=${accepted.id}&v=memory`, theme);
      await page.reload();
      await expect(page.locator(".pg-panel input[readonly]")).toHaveCount(2);
      expect(errors).toEqual([]);
    } finally { await release(app).catch(() => {}); await app.close(); }
  });

  test(`Bot memory wipe waits for failures, partial writes and accepted retry — 960 ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Memory deletion owner", model });
      const first = await call<MemoryEntry>(page, `/api/bots/${bot.id}/memory`, "POST", { content: "Retain the refused memory" });
      await show(page, `bot-settings?id=${bot.id}&v=memory`, theme);
      const wipe = page.getByRole("button", { name: "Forget everything", exact: true });
      const failure = page.getByText("Couldn’t forget this memory", { exact: true });
      await expect(page.getByRole("textbox", { name: "Memory 1", exact: true })).toHaveValue(first.content);
      await observeMemory(app);
      let confirmations = 0;
      page.on("dialog", (dialog) => { confirmations++; void dialog.accept(); });
      await hold(app);
      await wipe.evaluate((el: HTMLButtonElement) => { el.click(); el.click(); });
      await expect.poll(async () => (await requests(app)).length).toBe(1);
      expect(confirmations).toBe(1);
      await expect(wipe).toBeDisabled();
      await expect(page.getByRole("button", { name: "Forget", exact: true })).toBeDisabled();
      await refuse(app, [first.id]);
      await release(app, first.id);
      await expect.poll(async () => (await requests(app))[0]?.status).toBe(404);
      expect((await requests(app))[0].code).toBe("not_found");
      await expect(failure).toBeVisible();
      await expect(page.getByText("Memory erased", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Memory 1", exact: true })).toHaveValue(first.content);
      expect(await call<MemoryEntry[]>(page, `/api/bots/${bot.id}/memory`)).toEqual([first]);
      await capture(page, `memory-wipe-refused-${theme}`);
      await release(app);

      const second = await call<MemoryEntry>(page, `/api/bots/${bot.id}/memory`, "POST", { content: "Delete the accepted memory" });
      await page.reload();
      await expect(page.locator(".pg-panel input[readonly]")).toHaveCount(2);
      await hold(app);
      await wipe.click();
      await expect.poll(async () => (await requests(app)).length).toBe(2);
      await release(app, first.id);
      await expect.poll(async () => (await requests(app)).find((r) => r.id === first.id)?.status).toBe(404);
      await expect(wipe).toBeDisabled();
      await expect(failure).toHaveCount(0);
      await expect(page.locator(".pg-panel input[readonly]")).toHaveCount(2);
      await holdRead(app, `/api/bots/${bot.id}/memory`);
      await release(app, second.id);
      await expect(failure).toBeVisible();
      await expect(wipe).toBeEnabled();
      await expect(page.getByText("Memory erased", { exact: true })).toHaveCount(0);
      await expect(page.locator(".pg-panel input[readonly]")).toHaveCount(1);
      await expect.poll(() => heldReads(app, `/api/bots/${bot.id}/memory`)).toBe(1);
      await capture(page, `memory-wipe-partial-${theme}`);
      // Retry before the delayed refresh returns: already fulfilled IDs must never be deleted twice.
      await refuse(app, []);
      await wipe.click();
      await expect.poll(async () => (await requests(app)).length).toBe(3);
      expect((await requests(app)).filter((r) => r.id === second.id)).toHaveLength(1);
      expect((await requests(app))[2].id).toBe(first.id);
      await release(app);
      await expect(page.getByText("Memory erased", { exact: true })).toBeVisible();
      await expect(page.getByText("Empty memory", { exact: true })).toBeVisible();
      expect(await call<MemoryEntry[]>(page, `/api/bots/${bot.id}/memory`)).toEqual([]);
      await page.reload();
      await expect(page.getByText("Empty memory", { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { await release(app).catch(() => {}); await app.close(); }
  });

  test(`Memory single-entry deletion keeps refused rows and reports only accepted writes — 960 ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Single memory owner", model });
      const memory = await call<MemoryEntry>(page, `/api/bots/${bot.id}/memory`, "POST", { content: "Keep this memory until deletion is accepted" });
      await observeMemory(app);
      await refuse(app, [memory.id]);
      await show(page, `bot-settings?id=${bot.id}&v=memory`, theme);
      const forget = page.getByRole("button", { name: "Forget", exact: true });
      await expect(page.getByRole("textbox", { name: "Memory 1", exact: true })).toHaveValue(memory.content);
      await forget.click();
      await expect(page.getByText("Couldn’t forget this memory", { exact: true })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Memory 1", exact: true })).toHaveValue(memory.content);
      expect((await requests(app))[0]).toMatchObject({ status: 404, code: "not_found" });

      await show(page, "memory", theme);
      await page.reload();
      const row = page.locator(".systeme-mem");
      await expect(row).toContainText(memory.content);
      await hold(app);
      await forget.evaluate((el: HTMLButtonElement) => { el.click(); el.click(); });
      await expect.poll(async () => (await requests(app)).length).toBe(1);
      await expect(forget).toBeDisabled();
      await expect(row).toContainText(memory.content);
      await expect(page.getByText("Memory forgotten", { exact: true })).toHaveCount(0);
      await release(app);
      await expect(page.getByText("Couldn’t forget this memory", { exact: true })).toBeVisible();
      await expect(forget).toBeEnabled();
      await expect(row).toContainText(memory.content);
      await expect(page.getByText("Memory forgotten", { exact: true })).toHaveCount(0);
      expect(await call<MemoryEntry[]>(page, `/api/bots/${bot.id}/memory`)).toEqual([memory]);
      await capture(page, `memory-single-refused-${theme}`);

      await page.reload();
      await expect(row).toContainText(memory.content);
      await refuse(app, []);
      await hold(app);
      await forget.click();
      await expect.poll(async () => (await requests(app)).length).toBe(1);
      await expect(page.getByText("Memory forgotten", { exact: true })).toHaveCount(0);
      await expect(row).toContainText(memory.content);
      await release(app);
      await expect(page.getByText("Memory forgotten", { exact: true })).toBeVisible();
      await expect(row).toHaveCount(0);
      expect(await call<MemoryEntry[]>(page, `/api/bots/${bot.id}/memory`)).toEqual([]);
      await page.reload();
      await expect(page.getByRole("heading", { name: "No memories yet", exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { await release(app).catch(() => {}); await app.close(); }
  });
}
