import { test as base, expect, _electron as electron, type Page } from "@playwright/test";
import type { FilePart, MessageWithParts, PromptPartInput, Session } from "@cortex/schema";
import fs from "node:fs";
import path from "node:path";
import { launch, root } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import copy from "../../packages/i18n/locales/en/files.json" with { type: "json" };
import chat from "../../packages/i18n/locales/en/chat.json" with { type: "json" };

const MODEL = { providerID: "fake", modelID: "reasoner" }, CATALOG = `data:application/json,${encodeURIComponent(JSON.stringify({ fake: catalog.fake }))}`;
const viewer = (p: Page) => p.locator(".medias-text-live"), source = (p: Page) => viewer(p).locator(".medias-text-source");
const copyButton = (p: Page) => viewer(p).getByRole("button", { name: copy["text.copy"], exact: true });
const download = (p: Page) => viewer(p).getByRole("button", { name: copy["head.download"], exact: true });
const open = (p: Page, name: string) => p.getByRole("button", { name: copy["upload.open"].replace("{name}", name), exact: true });
type Saved = { session: Session; message: string; parts: FilePart[]; error?: string };
const route = (s: Saved, i = 0) => `file-code?${new URLSearchParams({ session: s.session.id, message: s.message, part: s.parts[i].id })}`;
const show = (page: Page, value: string, theme = "light") => page.evaluate(({ value, theme }) => history.pushState(null, "", `#/${value}${value.includes("?") ? "&" : "?"}theme=${theme}`), { value, theme });
const normalized = (text: string) => text.replace(/\r\n|\r/g, "\n");
const file = (text: string | Buffer, mime = "text/plain", filename = "note.txt", raw = false): PromptPartInput => {
  const data = Buffer.from(text).toString("base64"); return { type: "file", mime, filename, ...(raw ? { data: data.replace(/=+$/, "") } : { url: `data:${mime};base64,${data}` }) };
};
async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ url, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(`${method} ${url}: ${r.status}`); return r.status === 204 ? null : r.json();
  }, { url, method, body });
}
const histories = (p: Page, id: string) => call<MessageWithParts[]>(p, `/api/sessions/${id}/messages`);
async function fence(page: Page) { await call(page, "/api/health"); await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))); }
async function start() {
  const fake = await startFakeProvider({ rejectFirst: true }), env = { CORTEX_CATALOG_URL: CATALOG, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` };
  const c = await launch({ locale: "en", env }).catch(async (e) => { await fake.close(); throw e; }); const errors: string[] = [];
  c.page.on("pageerror", (e) => errors.push(e.message));
  try { await c.page.emulateMedia({ reducedMotion: "reduce" }); await call(c.page, "/api/providers/fake/key", "PUT", { key: "sk-test-files-text" }); }
  catch (e) { try { await c.app.close(); } finally { await fake.close(); fs.rmSync(c.dataDir, { recursive: true, force: true }); } throw e; }
  return { ...c, fake, env, errors, records: [] as unknown[], cleanup: [] as (() => Promise<void>)[] };
}
type Run = Awaited<ReturnType<typeof start>>;
const test = base.extend<{ run: Run }>({ run: async ({}, use) => {
  const c = await start();
  try { await use(c); expect(c.errors).toEqual([]); }
  finally {
    try { const failures: unknown[] = []; if (!c.page.isClosed()) try { await show(c.page, "home"); await fence(c.page); } catch (e) { failures.push(e); } for (const restore of c.cleanup.reverse()) try { await restore(); } catch (e) { failures.push(e); } expect(failures, "Text collector cleanup").toEqual([]); }
    finally { await test.info().attach("files-text-observations", { body: JSON.stringify({ errors: c.errors, records: c.records, providerRequests: c.fake.requests.length }), contentType: "application/json" }); try { await c.app.close(); } finally { try { await c.fake.close(); } finally { fs.rmSync(c.dataDir, { recursive: true, force: true }); } } }
  }
} });
// Sequential independent cases preserve every old-build negative; other files can still share the OS clipboard.
test.describe.configure({ mode: "default" });
async function save(c: Run, parts: PromptPartInput[], kind: Session["kind"] = "chat"): Promise<Saved> {
  const session = await call<Session>(c.page, "/api/sessions", "POST", { kind, model: MODEL, title: "Saved text" });
  const { messageID } = await call<{ messageID: string }>(c.page, `/api/sessions/${session.id}/prompt`, "POST", { parts: [{ type: "text", text: "Read this attachment." }, ...parts] });
  await expect.poll(async () => (await histories(c.page, session.id)).some((m) => m.info.role === "assistant" && m.info.time.completed !== undefined)).toBe(true);
  const history = await histories(c.page, session.id), user = history.find((m) => m.info.id === messageID)!;
  const saved = user.parts.filter((p): p is FilePart => p.type === "file"); expect(saved).toHaveLength(parts.length);
  for (const p of saved) expect([p.sessionID, p.messageID]).toEqual([session.id, messageID]);
  const error = history.at(-1)?.info.error?.code; c.records.push({ session: session.id, message: messageID, partIDs: saved.map((p) => p.id), assistantError: error ?? null });
  return { session, message: messageID, parts: saved, error };
}
async function ready(page: Page, text: string) {
  await expect(source(page)).toHaveCount(1); await expect.poll(() => source(page).textContent()).toBe(normalized(text));
  await expect(copyButton(page)).toBeEnabled(); await expect(download(page)).toBeEnabled();
}
async function focus(c: Run) { await c.app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.focus(); w.webContents.focus(); }); await expect.poll(() => c.page.evaluate(() => document.hasFocus())).toBe(true); }
async function clipboard(c: Run) {
  const h = await c.app.evaluateHandle(async ({ clipboard, ClipboardItem }) => {
    const saved = await Promise.all((await clipboard.read()).filter((item) => item.types.length > 0).map(async (item) => new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async (type) => [type, await item.getType(type)]))))));
    return { read: () => clipboard.readText(), seed: (text: string) => clipboard.writeText(text), restore: async () => { if (saved.length) await clipboard.write(saved); else clipboard.clear(); } };
  });
  let closed = false; const close = async () => { if (closed) return; closed = true; await h.evaluate((h) => h.restore()); await h.dispose(); }; c.cleanup.push(close);
  return { read: () => h.evaluate((h) => h.read()), seed: (text: string) => h.evaluate((h, text) => h.seed(text), text), close };
}
async function copying(c: Run) {
  const h = await c.page.evaluateHandle(() => {
    const target = navigator.clipboard, original = target.writeText, state = { denied: false, writes: [] as string[] }, pending: Promise<void>[] = [];
    target.writeText = function (text) { state.writes.push(text); const result = state.denied ? Promise.reject(new DOMException("Fixture clipboard refusal", "NotAllowedError")) : original.call(this, text); pending.push(result); return result; };
    return { state, restore: async () => { await Promise.allSettled(pending); target.writeText = original; } };
  });
  let closed = false; const close = async () => { if (closed) return; closed = true; c.records.push({ clipboardWrites: await h.evaluate((h) => h.state.writes) }); await h.evaluate((h) => h.restore()); await h.dispose(); }; c.cleanup.push(close);
  return { writes: () => h.evaluate((h) => h.state.writes), deny: () => h.evaluate((h) => { h.state.denied = true; }), close };
}
type Wire = { url: string; method: string; headers: [string, string][]; body?: string };
type Reply = { status: number; headers: [string, string][]; body: string };
async function gate(c: Run) {
  const h = await c.app.evaluateHandle(({ ipcMain }) => {
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<Reply>> })._invokeHandlers.get("cortex:fetch")!;
    const g = { hold: "", method: "GET", fail: "", held: "", status: 0, returned: false, release: undefined as (() => void) | undefined, calls: [] as string[] };
    ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", async (e, req: Wire) => {
      const u = new URL(req.url), url = u.pathname + u.search, hold = url === g.hold && req.method === g.method; g.calls.push(`${req.method} ${url}`); if (hold) g.hold = "";
      const reply = await original(e, req.method === "GET" && url === g.fail ? { ...req, url: "cortex://local/api/catalog/search?limit=0" } : req);
      if (hold) { g.held = `${req.method} ${url}`; g.status = reply.status; await new Promise<void>((r) => { g.release = r; }); g.returned = true; } return reply;
    });
    return { g, restore: () => { g.release?.(); ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", original); } };
  });
  let closed = false; const close = async () => { if (closed) return; closed = true; c.records.push({ ipcCalls: await h.evaluate((h) => h.g.calls) }); await h.evaluate((h) => h.restore()); await h.dispose(); }; c.cleanup.push(close);
  return { arm: (url: string, method = "GET") => h.evaluate(({ g }, x) => { Object.assign(g, x, { held: "", returned: false, status: 0 }); }, { hold: url, method }), fail: (url: string) => h.evaluate(({ g }, url) => { g.fail = url; }, url),
    waiting: (url: string, method = "GET") => expect.poll(() => h.evaluate(({ g }) => g.release ? g.held : "")).toBe(`${method} ${url}`), status: () => h.evaluate(({ g }) => g.status), calls: () => h.evaluate(({ g }) => g.calls),
    release: async () => { await h.evaluate(({ g }) => { g.release?.(); g.release = undefined; }); await expect.poll(() => h.evaluate(({ g }) => g.returned)).toBe(true); await fence(c.page); }, close };
}
async function downloads(c: Run) {
  const h = await c.app.evaluateHandle(({ BrowserWindow }, directory) => {
    const session = BrowserWindow.getAllWindows()[0].webContents.session, rows: { file: string; name: string; state: string }[] = [];
    const listener = (_e: unknown, item: import("electron").DownloadItem) => { const row = { file: `${directory}/text-download-${rows.length}`, name: item.getFilename(), state: "pending" }; rows.push(row); item.setSavePath(row.file); item.once("done", (_e, state) => { row.state = state; }); };
    session.on("will-download", listener); return { rows, restore: () => session.removeListener("will-download", listener) };
  }, c.dataDir);
  let closed = false; const close = async () => { if (closed) return; closed = true; c.records.push({ downloads: await h.evaluate((h) => h.rows) }); await h.evaluate((h) => h.restore()); await h.dispose(); }; c.cleanup.push(close);
  return { rows: () => h.evaluate((h) => h.rows), close };
}
async function transitions(c: Run) {
  await c.page.emulateMedia({ reducedMotion: "no-preference" }); const h = await c.page.evaluateHandle(() => {
    const start = document.startViewTransition, live = location.href, owner = document.querySelector("main .content-top")!, pending: { release: () => void; done: Promise<void> }[] = [];
    document.startViewTransition = (update) => { let release!: () => void; const done = new Promise<void>((r) => { release = r; }).then(() => typeof update === "function" ? update() : update?.update?.()); pending.push({ release, done }); return { ready: done, finished: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} }; };
    return { live, owner, pending, restore: () => { document.startViewTransition = start; pending.forEach((p) => p.release()); } };
  });
  let closed = false; const close = async () => { if (closed) return; closed = true; await h.evaluate((h) => h.restore()); await h.dispose(); await c.page.emulateMedia({ reducedMotion: "reduce" }); }; c.cleanup.push(close);
  return { h, close, back: async () => { await c.page.evaluate(() => history.back()); await expect.poll(() => c.page.url()).toBe(await h.evaluate((h) => h.live)); await expect.poll(() => h.evaluate((h) => h.pending.length)).toBe(2); await h.evaluate(async (h) => { for (const p of [...h.pending].reverse()) { p.release(); await p.done; } h.restore(); }); } };
}
async function capture(c: Run, name: string, shot = true) {
  await c.page.evaluate(() => document.fonts.ready); await fence(c.page);
  const geometry = await viewer(c.page).locator(".content-top, .medias-name, .medias-bar, .medias-meta:not(:empty), button, .medias-text-scroll").evaluateAll((elements) => elements.map((el) => {
    const r = el.getBoundingClientRect(); let left = 0, right = innerWidth, top = 0, bottom = innerHeight;
    for (let p = el.parentElement; p; p = p.parentElement) { const b = p.getBoundingClientRect(), s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { left = Math.max(left, b.left); right = Math.min(right, b.right); } if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); } }
    return { className: el.className, box: [r.x, r.y, r.width, r.height], contained: r.width > 0 && r.height > 0 && r.left >= left - 1 && r.right <= right + 1 && r.top >= top - 1 && r.bottom <= bottom + 1 };
  }));
  c.records.push({ name, geometry }); expect(geometry.length).toBeGreaterThan(3); expect(geometry.every((r) => r.contained)).toBe(true);
  if (shot) { const p = test.info().outputPath(`${name}.png`); await c.page.screenshot({ path: p, animations: "disabled" }); await test.info().attach(name, { path: p, contentType: "image/png" }); }
}

for (const theme of ["light", "dark"]) test(`Saved text exact identity, native Copy/download and disabled-provider restart — ${theme}`, async ({ run: c }) => {
  const name = "../../Café same.exe", plain = "First plain attachment\n", text = "# Café 雪🙂\r\n<script>window.TEXT_EXECUTED=1</script>\r\n[link](https://example.test/never)\r\tLast\n", bytes = Buffer.from(`\ufeff${text}`);
  const saved = await save(c, [file(plain, "TEXT/PLAIN", name, true), file(bytes, "text/markdown", name)]); expect(saved.error).toBeDefined();
  await call(c.page, "/api/providers/fake", "PATCH", { enabled: false }); const requests = c.fake.requests.length, seen: string[] = [];
  c.page.on("request", (r) => { if (/^https?:/.test(r.url())) seen.push(r.url()); }); await c.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  await show(c.page, `chat?id=${saved.session.id}`, theme); await expect(open(c.page, name)).toHaveCount(2); await open(c.page, name).nth(1).focus(); await c.page.keyboard.press("Enter"); await ready(c.page, text);
  const params = new URLSearchParams(new URL(c.page.url()).hash.split("?")[1]); expect([params.getAll("session"), params.getAll("message"), params.getAll("part")]).toEqual([[saved.session.id], [saved.message], [saved.parts[1].id]]);
  await expect(viewer(c.page).getByText(copy["text.markdownSource"], { exact: true })).toBeVisible(); await expect(viewer(c.page).getByText(copy["text.utf8Bom"], { exact: true })).toBeVisible();
  await expect(viewer(c.page).getByText(copy["text.lines_other"].replace("{count}", "5"), { exact: true })).toBeVisible(); await expect(viewer(c.page).getByText(copy["image.byteSize"].replace("{n}", bytes.length.toLocaleString("en")), { exact: true })).toBeVisible();
  expect(await source(c.page).evaluate((el) => el.children.length)).toBe(0); await expect(viewer(c.page).locator("script,a[href],iframe,img")).toHaveCount(0); expect(await c.page.evaluate(() => "TEXT_EXECUTED" in window)).toBe(false);
  const clip = await clipboard(c), probe = await copying(c), ipc = await gate(c), files = await downloads(c); await clip.seed("text-copy-before"); await focus(c);
  const url = `/api/sessions/${saved.session.id}`; await ipc.arm(url); await copyButton(c.page).click(); await ipc.waiting(url); expect(await ipc.status()).toBe(200); expect(await probe.writes()).toEqual([]); expect(await clip.read()).toBe("text-copy-before");
  await focus(c); await ipc.release(); await expect.poll(async () => normalized(await clip.read())).toBe(normalized(text)); expect(await probe.writes()).toEqual([text]); await expect(c.page.getByText(copy["text.copySuccess"], { exact: true })).toBeVisible();
  await download(c.page).click(); await expect.poll(async () => (await files.rows())[0]?.state).toBe("completed"); const result = (await files.rows())[0]; expect(fs.readFileSync(result.file)).toEqual(bytes); expect(result.name).toBe("Café same.md");
  await capture(c, `text-source-${theme}`); await show(c.page, `chat?id=${saved.session.id}`, theme); await open(c.page, name).nth(0).click(); await ready(c.page, plain);
  await c.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900)); await capture(c, `text-plain-wide-${theme}`); expect(seen).toEqual([]);
  await probe.close(); await files.close(); await ipc.close(); await clip.close(); await c.page.reload(); await ready(c.page, plain); await c.app.close();
  c.app = await electron.launch({ args: [path.join(root, "packages/desktop/dist/main.cjs"), `--user-data-dir=${path.join(c.dataDir, "renderer")}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])], env: { ...process.env, ...c.env, CORTEX_DATA_DIR: c.dataDir, CORTEX_START_HASH: `#/${route(saved)}&theme=${theme}`, CORTEX_LOCALE: "en" } as Record<string, string> });
  c.page = await c.app.firstWindow(); c.page.on("pageerror", (e) => c.errors.push(e.message)); await c.page.waitForFunction(() => "__bridgeFetch" in window); await ready(c.page, plain);
  expect((await call<{ enabled: boolean }>(c.page, "/api/providers/fake")).enabled).toBe(false); expect((await histories(c.page, saved.session.id)).find((m) => m.info.id === saved.message)?.parts.filter((p) => p.type === "file")).toEqual(saved.parts); expect(c.fake.requests).toHaveLength(requests);
});

test("Empty/BOM-only text is Ready; unsafe encodings, budgets and tuple errors remain honest", async ({ run: c }) => {
  const empty = await save(c, [file("", "text/plain", "empty.txt", true), file("", "text/plain", "empty-url.txt"), file("\ufeff", "text/markdown", "bom.md")]); await show(c.page, route(empty)); await ready(c.page, "");
  const clip = await clipboard(c), files = await downloads(c); await focus(c);
  for (const [i, bytes] of [Buffer.alloc(0), Buffer.alloc(0), Buffer.from("\ufeff")].entries()) {
    await show(c.page, route(empty, i)); await ready(c.page, ""); await expect(viewer(c.page).getByText(copy["text.empty"], { exact: true })).toBeVisible(); await expect(viewer(c.page).getByText(copy["text.lines_other"].replace("{count}", "0"), { exact: true })).toBeVisible();
    await clip.seed("must clear"); await focus(c); await copyButton(c.page).click(); await expect.poll(() => clip.read()).toBe(""); await download(c.page).click(); await expect.poll(async () => (await files.rows())[i]?.state).toBe("completed"); expect(fs.readFileSync((await files.rows())[i].file)).toEqual(bytes); expect((await files.rows())[i].name).toBe(["empty.txt", "empty-url.txt", "bom.md"][i]);
  }
  const cases: { part: PromptPartInput; reason: "unsupported" | "invalid" | "tooLarge" }[] = [
    { part: { type: "file", mime: "text/plain", url: `${c.fake.url}/never-text` }, reason: "unsupported" }, { part: { type: "file", mime: "text/plain", data: "", url: "data:text/plain;base64," }, reason: "unsupported" },
    { part: { type: "file", mime: "text/plain" }, reason: "unsupported" }, { part: file("x", "text/plain;charset=utf-8"), reason: "unsupported" }, { part: file("<script>1</script>", "text/html", "fake.txt"), reason: "unsupported" },
    { part: { type: "file", mime: "text/plain", url: "data:text/markdown;base64,eA==" }, reason: "invalid" }, { part: { type: "file", mime: "text/plain", data: "eB==" }, reason: "invalid" },
    { part: file(Buffer.from([0xc3, 0x28])), reason: "invalid" }, { part: file("hidden\0value"), reason: "unsupported" }, { part: file("x".repeat(100_001)), reason: "tooLarge" },
    { part: file("x\n".repeat(50_000)), reason: "tooLarge" }, { part: file(`${`${"x".repeat(99)}\n`.repeat(49_999)}${"x".repeat(101)}`), reason: "tooLarge" },
  ];
  const bad = await save(c, cases.map(({ part }) => part)), requests: string[] = []; c.page.on("request", (r) => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  for (const [i, { reason }] of cases.entries()) { await show(c.page, route(bad, i)); await expect(viewer(c.page).getByText(copy[`text.${reason}Title`], { exact: true })).toBeVisible(); await expect(source(c.page)).toHaveCount(0); await expect(copyButton(c.page)).toHaveCount(0); await expect(download(c.page)).toHaveCount(0); }
  for (const invalid of [`file-code?session=${empty.session.id}`, `${route(empty)}&part=${empty.parts[0].id}`, route(empty).replace(empty.message, bad.message), route(empty).replace(empty.parts[0].id, bad.parts[0].id), route(empty).replace(empty.session.id, "..%2Fcredentials.json")]) {
    await show(c.page, invalid); await expect(viewer(c.page).getByText(copy["text.unavailableTitle"], { exact: true })).toBeVisible(); await expect(source(c.page)).toHaveCount(0);
  }
  const code = await save(c, [file("Code-owned file")], "code"); await show(c.page, route(code)); await expect(viewer(c.page).getByText(copy["text.unavailableTitle"], { exact: true })).toBeVisible();
  expect(requests).toEqual([]); await show(c.page, "file-code"); await expect(c.page.getByTestId("upload-dropzone")).toBeVisible();
});

test("Text source Retry is single-owner; deletion cancels held reads, Copy and Download", async ({ run: c }) => {
  const a = await save(c, [file("read owner")]), b = await save(c, [file("copy owner")]), d = await save(c, [file("download owner")]); const ipc = await gate(c), clip = await clipboard(c), probe = await copying(c), files = await downloads(c);
  for (const url of [`/api/sessions/${a.session.id}`, `/api/sessions/${a.session.id}/messages`]) {
    await ipc.fail(url); await show(c.page, route(a)); await expect(viewer(c.page).getByText(copy["text.loadTitle"], { exact: true })).toBeVisible(); await ipc.fail(""); await ipc.arm(url); const before = (await ipc.calls()).filter((s) => s === `GET ${url}`).length;
    await viewer(c.page).getByRole("button", { name: copy.retry, exact: true }).click(); await ipc.waiting(url); expect(await ipc.status()).toBe(200); const retry = viewer(c.page).getByRole("button", { name: copy.retry, exact: true }); if (await retry.count()) await expect(retry).toBeDisabled();
    expect((await ipc.calls()).filter((s) => s === `GET ${url}`)).toHaveLength(before + 1); await ipc.release(); await ready(c.page, "read owner"); await show(c.page, "home");
  }
  const history = `/api/sessions/${a.session.id}/messages`; await ipc.arm(history); await show(c.page, route(a)); await ipc.waiting(history); await call(c.page, `/api/sessions/${a.session.id}`, "DELETE");
  await expect(viewer(c.page).getByText(copy["text.unavailableTitle"], { exact: true })).toBeVisible(); await ipc.release(); await expect(source(c.page)).toHaveCount(0);
  for (const [s, action, text] of [[b, copyButton, "copy owner"], [d, download, "download owner"]] as const) {
    await show(c.page, route(s)); await ready(c.page, text); await clip.seed("undispatched text action"); const url = `/api/sessions/${s.session.id}`;
    await ipc.arm(url); await action(c.page).click(); await ipc.waiting(url); expect(await ipc.status()).toBe(200); await expect(copyButton(c.page)).toBeDisabled(); await expect(download(c.page)).toBeDisabled();
    await call(c.page, url, "DELETE"); await expect(source(c.page)).toHaveCount(0); await expect(copyButton(c.page)).toHaveCount(0); await expect(download(c.page)).toHaveCount(0); await expect(viewer(c.page)).not.toContainText(text);
    await ipc.release(); expect(await clip.read()).toBe("undispatched text action"); expect(await probe.writes()).toEqual([]); expect(await files.rows()).toEqual([]);
  }
});

test("Tuple replacement and canceled preview cannot dispatch stale text actions or restore stale reads", async ({ run: c }) => {
  const a = await save(c, [file("Older owner")]), b = await save(c, [file("Current owner")]), ipc = await gate(c), clip = await clipboard(c), probe = await copying(c), files = await downloads(c);
  const history = `/api/sessions/${a.session.id}/messages`; await clip.seed("text-owner-marker"); await ipc.arm(history); await show(c.page, route(a)); await ipc.waiting(history); await show(c.page, route(b)); await ready(c.page, "Current owner"); await ipc.release(); await ready(c.page, "Current owner");
  for (const [from, to, action, text] of [[b, a, copyButton, "Older owner"], [a, b, download, "Current owner"]] as const) {
    const url = `/api/sessions/${from.session.id}`; await ipc.arm(url); await action(c.page).click(); await ipc.waiting(url); await show(c.page, route(to)); await ready(c.page, text); await ipc.release(); expect(await probe.writes()).toEqual([]); expect(await clip.read()).toBe("text-owner-marker"); expect(await files.rows()).toEqual([]);
  }
  await show(c.page, "home"); await ipc.arm(history); await show(c.page, route(a)); await ipc.waiting(history); const readTransition = await transitions(c);
  await show(c.page, "home?preview"); await expect.poll(() => readTransition.h.evaluate((h) => h.pending.length)).toBe(1); expect(c.page.url()).toContain("home?preview"); await ipc.release(); await expect(source(c.page)).toHaveCount(0);
  const reads = (await ipc.calls()).filter((s) => s === `GET ${history}`).length; await readTransition.back(); await ready(c.page, "Older owner"); expect((await ipc.calls()).filter((s) => s === `GET ${history}`).length).toBeGreaterThan(reads); expect(await readTransition.h.evaluate((h) => h.owner.isConnected)).toBe(true); await readTransition.close();
  const copyTransition = await transitions(c), url = `/api/sessions/${a.session.id}`; await ipc.arm(url); await copyButton(c.page).click(); await ipc.waiting(url); await show(c.page, "home?preview"); await expect.poll(() => copyTransition.h.evaluate((h) => h.pending.length)).toBe(1); expect(c.page.url()).toContain("home?preview");
  await ipc.release(); await expect(source(c.page)).toHaveCount(0); expect(await probe.writes()).toEqual([]); await copyTransition.back(); await ready(c.page, "Older owner"); expect(await clip.read()).toBe("text-owner-marker"); await expect(c.page.getByText(copy["text.copySuccess"], { exact: true })).toHaveCount(0);
});

test("Native Copy survives shell changes, rejects duplicate actions and retains manual-copy recovery", async ({ run: c }) => {
  const text = "Café 雪\r\nsecond\rthird", saved = await save(c, [file(text)]); await show(c.page, route(saved)); await ready(c.page, text);
  const clip = await clipboard(c), probe = await copying(c), ipc = await gate(c), files = await downloads(c); await clip.seed("copy pending"); await focus(c);
  const owner = await source(c.page).elementHandle(), url = `/api/sessions/${saved.session.id}`, before = await ipc.calls(); await ipc.arm(url); await copyButton(c.page).click(); await ipc.waiting(url);
  await expect(copyButton(c.page)).toBeDisabled(); await expect(download(c.page)).toBeDisabled(); await copyButton(c.page).evaluate((el: HTMLButtonElement) => { el.click(); el.click(); }); await download(c.page).evaluate((el: HTMLButtonElement) => el.click());
  for (const name of ["Hide sidebar", "Focus mode", "Exit focus mode", "Show sidebar"]) { await c.page.getByRole("button", { name, exact: true }).click(); await fence(c.page); expect(await owner!.evaluate((el) => el.isConnected)).toBe(true); await expect(copyButton(c.page)).toBeDisabled(); }
  await c.page.getByRole("radio", { name: "Light", exact: true }).focus(); await c.page.keyboard.press("Home"); await expect(c.page.locator("html")).toHaveAttribute("data-theme", "dark"); await fence(c.page);
  expect((await ipc.calls()).filter((s) => s.startsWith("GET /api/sessions/"))).toEqual([...before.filter((s) => s.startsWith("GET /api/sessions/")), `GET ${url}`]); expect(await probe.writes()).toEqual([]); expect(await files.rows()).toEqual([]);
  await focus(c); await ipc.release(); await expect.poll(async () => normalized(await clip.read())).toBe(normalized(text)); expect(await probe.writes()).toEqual([text]); await ready(c.page, text); await owner!.dispose();
  await probe.close(); await c.page.reload(); await ready(c.page, text); const denied = await copying(c); await denied.deny(); await copyButton(c.page).click();
  await expect(c.page.getByText(copy["text.copyFailed"], { exact: true })).toBeVisible(); await expect(c.page.getByText(copy["text.copySuccess"], { exact: true })).toHaveCount(0); await ready(c.page, text);
  expect(await source(c.page).evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection()!; s.removeAllRanges(); s.addRange(r); return s.toString(); })).toBe(normalized(text)); expect(await denied.writes()).toEqual([text]);
});

test("Text Open preserves Chat drafts, real file reads, refused/submitting sends and pending rename", async ({ run: c }) => {
  const saved = await save(c, [file("Saved plain text", "text/plain", "saved.txt")]); await show(c.page, `chat?id=${saved.session.id}`); await expect(open(c.page, "saved.txt")).toBeVisible(); const url = c.page.url(), input = c.page.getByTestId("composer-input");
  const blocked = async () => { await open(c.page, "saved.txt").click(); await expect(c.page.getByText(copy["image.finishDraft"], { exact: true }).first()).toBeVisible(); expect(c.page.url()).toBe(url); };
  await input.fill("Keep my text draft"); await blocked(); await expect(input).toHaveValue("Keep my text draft"); await input.fill("");
  const reading = await c.page.evaluateHandle(() => { const read = FileReader.prototype.readAsDataURL; let release = () => {}; FileReader.prototype.readAsDataURL = function (b) { FileReader.prototype.readAsDataURL = read; const resume = read.bind(this, b); release = () => { release = () => {}; resume(); }; }; return { release: () => release(), restore: () => { FileReader.prototype.readAsDataURL = read; release(); } }; });
  let restored = false; const restoreRead = async () => { if (restored) return; restored = true; await reading.evaluate((h) => h.restore()); await reading.dispose(); }; c.cleanup.push(restoreRead);
  await c.page.getByTestId("attach-input").setInputFiles({ name: "draft.txt", mimeType: "text/plain", buffer: Buffer.from("draft bytes") }); await blocked(); await reading.evaluate((h) => h.release()); await expect(c.page.locator(".chat-attach .ttl")).toHaveText("draft.txt"); await blocked();
  await input.fill("X".repeat(1000)); await c.page.getByTestId("model-trigger").click(); await c.page.getByTestId("model-option").filter({ hasText: "Plain Text" }).click(); await c.page.getByTestId("composer-send").click(); await expect(c.page.getByText(chat["err.context_window_exceeded.title"], { exact: true }).first()).toBeVisible(); await blocked(); await expect(input).toHaveValue("X".repeat(1000));
  await c.page.getByTestId("model-trigger").click(); await c.page.getByTestId("model-option").filter({ hasText: "Reasoner Large" }).click(); await input.fill("Accepted text request"); const ipc = await gate(c), prompt = `/api/sessions/${saved.session.id}/prompt`;
  await ipc.arm(prompt, "POST"); await c.page.getByTestId("composer-send").click(); await ipc.waiting(prompt, "POST"); await blocked(); await expect(input).toHaveValue("Accepted text request"); await ipc.release(); await expect(input).toHaveValue(""); await expect(c.page.locator(".chat-attach .ttl")).toHaveCount(0);
  await expect.poll(async () => (await histories(c.page, saved.session.id)).filter((m) => m.info.role === "assistant" && m.info.time.completed !== undefined).length).toBe(2); await restoreRead();
  const options = c.page.getByRole("button", { name: chat.options, exact: true }), rename = c.page.getByRole("textbox", { name: chat["history.newName"], exact: true }), session = `/api/sessions/${saved.session.id}`;
  await options.click(); await c.page.getByRole("menuitem", { name: chat["menu.rename"], exact: true }).click(); await rename.fill("Pending text title"); await ipc.arm(session, "PATCH"); await rename.press("Tab"); await ipc.waiting(session, "PATCH"); expect(await ipc.status()).toBe(200);
  await options.click(); await c.page.getByRole("menuitem", { name: chat["menu.rename"], exact: true }).click(); await expect(rename).toHaveCount(0); await blocked(); await ipc.release();
  await call(c.page, "/api/providers/fake", "PATCH", { enabled: false }); await c.page.reload(); await expect(c.page.getByTestId("model-trigger")).toHaveText("No model"); await input.fill("Refused no-model text"); await c.page.getByTestId("composer-send").click(); await expect(c.page.getByText("No model is set up.", { exact: true })).toBeVisible(); await blocked(); await expect(input).toHaveValue("Refused no-model text"); await input.fill("");
  const transition = await transitions(c); await open(c.page, "saved.txt").click(); await expect.poll(() => transition.h.evaluate((h) => h.pending.length)).toBe(1); await expect(input).toBeDisabled(); await transition.back(); await expect(input).toBeEnabled(); await input.fill("Restored after canceled text Open"); await expect(input).toHaveValue("Restored after canceled text Open");
});

test("Exact 5 MB/50000-row/100000-unit text and a long filename stay bounded in both themes", async ({ run: c }) => {
  const text = `${"L".repeat(100_000)}\n${"R".repeat(195)}\n${Array(49_998).fill("x".repeat(97)).join("\n")}`, filename = `${"W".repeat(5000)}.txt`; expect(Buffer.byteLength(text)).toBe(5_000_000);
  const saved = await save(c, [file(text, "text/plain", filename)]), ipc = await gate(c); await c.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  await ipc.arm(`/api/sessions/${saved.session.id}/messages`); await show(c.page, route(saved)); await ipc.waiting(`/api/sessions/${saved.session.id}/messages`); const started = performance.now(); await ipc.release();
  await expect.poll(() => c.page.evaluate(() => document.querySelector(".medias-text-source")?.textContent?.length), { timeout: 5000 }).toBe(5_000_000); const duration = performance.now() - started; expect(duration).toBeLessThan(5000); c.records.push({ budgetRenderMs: duration, bytes: 5_000_000, rows: 50_000, longestLine: 100_000 });
  for (const theme of ["light", "dark"]) {
    await show(c.page, route(saved), theme); await expect(copyButton(c.page)).toBeEnabled(); await expect(viewer(c.page).getByText(copy["text.lines_other"].replace("{count}", "50000"), { exact: true })).toBeVisible();
    const scroll = viewer(c.page).locator(".medias-text-scroll"), name = viewer(c.page).locator(".medias-name"), gutter = viewer(c.page).locator(".medias-text-gutter");
    await expect(scroll).toHaveAttribute("role", "region"); await expect(scroll).toHaveAttribute("tabindex", "0"); await expect(gutter).toHaveAttribute("aria-hidden", "true"); expect(await gutter.evaluate((el) => getComputedStyle(el).userSelect)).toBe("none");
    expect(await scroll.locator("*").count()).toBeLessThan(100); const bounds = (await scroll.boundingBox())!; expect(bounds.height).toBeGreaterThanOrEqual(120); expect(bounds.width).toBeGreaterThanOrEqual(120);
    await scroll.evaluate((el) => { el.scrollTop = 0; el.scrollLeft = 0; }); await scroll.focus(); await c.page.keyboard.press("ArrowRight"); await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0); await c.page.keyboard.press("End"); await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await source(c.page).evaluate((el) => [el.textContent!.startsWith("L".repeat(100_000) + "\n"), el.textContent!.endsWith("x".repeat(97))])).toEqual([true, true]); await expect(name).toHaveText(filename); await name.focus(); await name.press("End"); await expect.poll(() => name.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    for (const button of [copyButton(c.page), download(c.page)]) { await expect(button).toBeInViewport({ ratio: 1 }); await button.click({ trial: true }); }
    expect(await c.page.evaluate(() => [document.documentElement.scrollWidth <= innerWidth, document.documentElement.scrollHeight <= innerHeight])).toEqual([true, true]); await capture(c, `text-budget-${theme}`);
  }
});

test("Text metadata, controls and selectable Unicode remain readable across eight locales and both themes", async ({ run: c }) => {
  const text = "# Café 雪\r\n한글 <tag>\r", saved = await save(c, [file(`\ufeff${text}`, "text/markdown", `写真 ${"W".repeat(90)}.md`)]); await c.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  for (const locale of ["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"]) for (const theme of ["light", "dark"]) {
    const labels = JSON.parse(fs.readFileSync(path.join(root, `packages/i18n/locales/${locale}/files.json`), "utf8")) as Record<string, string>;
    await c.page.evaluate((locale) => localStorage.setItem("cortex.locale", locale), locale); await show(c.page, route(saved), theme); await c.page.reload(); await expect(c.page.locator("html")).toHaveAttribute("lang", locale); await expect(c.page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(source(c.page)).toHaveCount(1); expect(await source(c.page).textContent()).toBe(normalized(text)); for (const key of ["text.markdownSource", "text.utf8Bom"]) await expect(viewer(c.page).getByText(labels[key], { exact: true })).toBeVisible();
    for (const key of ["text.copy", "head.download"]) await expect(viewer(c.page).getByRole("button", { name: labels[key], exact: true })).toBeEnabled(); await expect(viewer(c.page).getByText(labels["text.lines_other"].replace("{count}", (3).toLocaleString(locale)), { exact: true })).toBeVisible();
    await capture(c, `text-locale-${locale}-${theme}`, theme === "dark");
  }
});
