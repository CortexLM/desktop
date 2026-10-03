import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import type { FilePart, MessageWithParts, PromptPartInput, Session } from "@cortex/schema";
import fs from "node:fs";
import path from "node:path";
import { launch, root } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import copy from "../../packages/i18n/locales/en/files.json" with { type: "json" };

const MODEL = { providerID: "fake", modelID: "reasoner" };
const CATALOG = `data:application/json,${encodeURIComponent(JSON.stringify({ fake: catalog.fake }))}`;
const viewer = (page: Page) => page.locator(".medias-image-live"), image = (page: Page) => viewer(page).locator(".medias-view img");
const download = (page: Page) => viewer(page).getByRole("button", { name: copy["head.download"], exact: true });
const open = (page: Page, name: string) => page.getByRole("button", { name: copy["upload.open"].replace("{name}", name), exact: true });
type Saved = { session: Session; message: string; parts: FilePart[] };
const route = (s: Saved, index = 0) => `file-image?${new URLSearchParams({ session: s.session.id, message: s.message, part: s.parts[index].id })}`;
const show = (page: Page, value: string, theme = "light") => page.evaluate(({ value, theme }) => history.pushState(null, "", `#/${value}${value.includes("?") ? "&" : "?"}theme=${theme}`), { value, theme });
async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ url, method, body }) => {
    const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  }, { url, method, body });
}
const histories = (page: Page, id: string) => call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
async function fence(page: Page) { await call(page, "/api/health"); await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))); }
async function start() {
  const fake = await startFakeProvider(), env = { CORTEX_CATALOG_URL: CATALOG, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` };
  const c = await launch({ locale: "en", env }).catch(async (error) => { await fake.close(); throw error; });
  const errors: string[] = []; c.page.on("pageerror", (error) => errors.push(error.message));
  try { await c.page.emulateMedia({ reducedMotion: "reduce" }); await call(c.page, "/api/providers/fake/key", "PUT", { key: "sk-test-files" }); }
  catch (error) { try { await c.app.close(); } finally { await fake.close(); fs.rmSync(c.dataDir, { recursive: true, force: true }); } throw error; }
  return { ...c, fake, env, errors, cleanup: [] as (() => Promise<void>)[] };
}
const test = base.extend<{ run: Awaited<ReturnType<typeof start>> }>({ run: async ({}, use) => {
  const c = await start();
  try { await use(c); expect(c.errors).toEqual([]); }
  finally {
    try {
      const failures: unknown[] = []; for (const restore of c.cleanup.reverse()) { try { await restore(); } catch (error) { failures.push(error); } }
      expect(failures, "Files collector cleanup failed").toEqual([]);
    }
    finally { try { await c.app.close(); } finally { try { await c.fake.close(); } finally { fs.rmSync(c.dataDir, { recursive: true, force: true }); } } }
  }
} });
async function pixels(page: Page, mime = "image/png", width = 240, height = 120, color = "#dc321e") {
  return page.evaluate(({ mime, width, height, color }) => {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
    const url = canvas.toDataURL(mime, 0.9); if (!url.startsWith(`data:${mime};base64,`)) throw new Error("Native fixture encoder unavailable"); return url;
  }, { mime, width, height, color });
}
async function save(page: Page, parts: PromptPartInput[], kind: Session["kind"] = "chat"): Promise<Saved> {
  const session = await call<Session>(page, "/api/sessions", "POST", { kind, model: MODEL, title: "Saved images" });
  const { messageID } = await call<{ messageID: string }>(page, `/api/sessions/${session.id}/prompt`, "POST", { parts: [{ type: "text", text: "Inspect these attachments." }, ...parts] });
  await expect.poll(async () => (await histories(page, session.id)).some((m) => m.info.role === "assistant" && m.info.time.completed !== undefined)).toBe(true);
  const user = (await histories(page, session.id)).find((m) => m.info.id === messageID)!;
  return { session, message: messageID, parts: user.parts.filter((p): p is FilePart => p.type === "file") };
}
async function ready(page: Page, width = 240, height = 120) {
  await expect(image(page)).toBeVisible();
  await expect.poll(() => image(page).evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([width, height]);
  await expect(download(page)).toBeEnabled();
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready); await fence(page);
  expect(await viewer(page).locator(".content-top, .medias-bar, .medias-exif, .medias-name, .medias-zoomv, .medias-meta, .medias-kv > span, button").evaluateAll((elements) => elements.filter((el) => {
    const r = el.getBoundingClientRect(); if (!r.width) return false;
    if (r.left < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || el.scrollWidth > el.clientWidth + 1) return true;
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const p = parent.getBoundingClientRect(), style = getComputedStyle(parent);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (r.top < p.top - 1 || r.bottom > p.bottom + 1)) return true;
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (r.left < p.left - 1 || r.right > p.right + 1)) return true;
    }
    return false;
  }).map((el) => el.className))).toEqual([]);
  const file = test.info().outputPath(`${name}.png`); await page.screenshot({ path: file, animations: "disabled" }); await test.info().attach(name, { path: file, contentType: "image/png" });
}

type Wire = { url: string; method: string; headers: [string, string][]; body?: string };
type Reply = { status: number; headers: [string, string][]; body: string };
async function gate(app: ElectronApplication, page: Page) {
  const handle = await app.evaluateHandle(({ ipcMain }) => {
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<Reply>> })._invokeHandlers.get("cortex:fetch")!;
    const g = { hold: "", method: "GET", fail: "", held: "", status: 0, returned: false, release: undefined as (() => void) | undefined, calls: [] as string[] };
    ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", async (event, req: Wire) => {
      const u = new URL(req.url), url = u.pathname + u.search, key = `${req.method} ${url}`, hold = url === g.hold && req.method === g.method;
      g.calls.push(key); if (hold) g.hold = "";
      // Genuine protocol validation refusal; never synthesize a response or engine record.
      const reply = await original(event, req.method === "GET" && url === g.fail ? { ...req, url: "cortex://local/api/catalog/search?limit=0" } : req);
      if (hold) { g.held = key; g.status = reply.status; await new Promise<void>((r) => { g.release = r; }); g.returned = true; }
      return reply;
    });
    return { g, restore: () => { g.release?.(); ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", original); } };
  });
  return {
    arm: (url: string, method = "GET") => handle.evaluate(({ g }, { url, method }) => { Object.assign(g, { hold: url, method, held: "", status: 0, returned: false }); }, { url, method }),
    fail: (url: string) => handle.evaluate(({ g }, url) => { g.fail = url; }, url),
    waiting: async (url: string, method = "GET") => { await expect.poll(() => handle.evaluate(({ g }) => g.release ? g.held : "")).toBe(`${method} ${url}`); },
    status: () => handle.evaluate(({ g }) => g.status), calls: () => handle.evaluate(({ g }) => g.calls),
    release: async () => { await handle.evaluate(({ g }) => { g.release?.(); g.release = undefined; }); await expect.poll(() => handle.evaluate(({ g }) => g.returned)).toBe(true); await fence(page); },
    close: async () => { await handle.evaluate((h) => h.restore()); await handle.dispose(); },
  };
}
async function downloads(app: ElectronApplication, directory: string) {
  const handle = await app.evaluateHandle(({ BrowserWindow }, directory) => {
    const session = BrowserWindow.getAllWindows()[0].webContents.session;
    const rows: { file: string; name: string; state: string }[] = [];
    const listener = (_event: unknown, item: import("electron").DownloadItem) => {
      const row = { file: `${directory}/download-${rows.length}`, name: item.getFilename(), state: "pending" }; rows.push(row);
      item.setSavePath(row.file); item.once("done", (_e, state) => { row.state = state; });
    };
    session.on("will-download", listener);
    return { rows, restore: () => session.removeListener("will-download", listener) };
  }, directory);
  return { rows: () => handle.evaluate((h) => h.rows), close: async () => { await handle.evaluate((h) => { h.restore(); }); await handle.dispose(); } };
}
async function decoding(page: Page) {
  const handle = await page.evaluateHandle(() => {
    const proto = HTMLImageElement.prototype, src = Object.getOwnPropertyDescriptor(proto, "src")!, decode = proto.decode, attr = proto.setAttribute, revoke = URL.revokeObjectURL;
    const g = { hold: false, waiting: "", release: undefined as (() => void) | undefined, assigned: [] as string[], revoked: [] as string[], decoded: [] as string[] };
    Object.defineProperty(proto, "src", { ...src, set(value: string) { g.assigned.push(value); src.set!.call(this, value); } });
    proto.setAttribute = function (name, value) { if (name === "src") g.assigned.push(value); attr.call(this, name, value); };
    proto.decode = function () {
      const url = this.src, result = decode.call(this); g.decoded.push(url);
      if (!g.hold || !url.startsWith("blob:")) return result;
      g.hold = false; return result.then(() => new Promise<void>((r) => { g.waiting = url; g.release = r; }));
    };
    URL.revokeObjectURL = (url) => { g.revoked.push(url); revoke.call(URL, url); };
    return { g, restore: () => { g.release?.(); Object.defineProperty(proto, "src", src); proto.decode = decode; proto.setAttribute = attr; URL.revokeObjectURL = revoke; } };
  });
  return { arm: () => handle.evaluate(({ g }) => { g.hold = true; g.waiting = ""; }), state: () => handle.evaluate(({ g }) => ({ assigned: g.assigned, revoked: g.revoked, decoded: g.decoded, waiting: g.waiting })),
    waiting: () => expect.poll(() => handle.evaluate(({ g }) => g.waiting)).not.toBe(""),
    release: async () => { await handle.evaluate(({ g }) => { g.release?.(); g.release = undefined; }); await fence(page); },
    close: async () => { await handle.evaluate((h) => h.restore()); await handle.dispose(); } };
}
async function transitions(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const handle = await page.evaluateHandle(() => {
    const start = document.startViewTransition, live = location.href, owner = document.querySelector("main .content-top")!;
    const pending: { release: () => void; done: Promise<void> }[] = [];
    document.startViewTransition = (update) => { let release!: () => void; const done = new Promise<void>((r) => { release = r; }).then(() => typeof update === "function" ? update() : update?.update?.()); pending.push({ release, done }); return { ready: done, finished: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} }; };
    return { live, owner, pending, restore: () => { document.startViewTransition = start; pending.forEach((p) => p.release()); } };
  });
  return { handle, close: async () => { await handle.evaluate((h) => h.restore()); await handle.dispose(); await page.emulateMedia({ reducedMotion: "reduce" }); } };
}

for (const theme of ["light", "dark"]) test(`Saved image identity, fit, native original download and provider-disabled restart — ${theme}`, async ({ run: c }) => {
  const { fake, env, dataDir } = c; let { page } = c;
  const name = `Café ${"portrait-".repeat(12)}.png`, png = await pixels(page), jpeg = await pixels(page, "image/jpeg", 90, 180, "#206bd9"), webp = await pixels(page, "image/webp", 180, 90, "#28a645");
  const saved = await save(page, [{ type: "file", mime: "image/png", filename: name, url: png }, { type: "file", mime: "image/jpeg", filename: name, data: jpeg.split(",")[1].replace(/=+$/, "") }, { type: "file", mime: "image/webp", filename: "../../original.exe", url: webp }]);
  expect((await histories(page, saved.session.id)).at(-1)?.info.error).toBeUndefined(); expect(fake.requests).toHaveLength(1);
  await call(page, "/api/providers/fake", "PATCH", { enabled: false }); const count = fake.requests.length;
  await c.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  await show(page, `chat?id=${saved.session.id}`, theme); await expect(open(page, name)).toHaveCount(2); await expect(open(page, name).nth(1)).toBeEnabled(); await open(page, name).nth(1).focus(); await page.keyboard.press("Enter");
  await ready(page, 90, 180); const params = new URLSearchParams(new URL(page.url()).hash.split("?")[1]); expect([params.getAll("session"), params.getAll("message"), params.getAll("part")]).toEqual([[saved.session.id], [saved.message], [saved.parts[1].id]]);
  await expect(viewer(page).getByText("90 × 180", { exact: true })).toBeVisible(); await expect(viewer(page).getByText(`${Buffer.from(jpeg.split(",")[1], "base64").length.toLocaleString("en")} bytes`, { exact: true })).toBeVisible();
  const stage = viewer(page).locator(".medias-view"); await stage.focus(); await page.keyboard.press("+"); await expect(viewer(page).locator(".medias-zoomv")).toContainText("150%");
  const miniature = (await viewer(page).locator(".medias-mini").boundingBox())!; expect(miniature.width / miniature.height).toBeCloseTo(0.5, 1);
  await page.keyboard.press("ArrowDown"); await expect.poll(() => image(page).evaluate((img: HTMLImageElement) => img.style.translate)).not.toBe("0px 0px");
  await viewer(page).getByRole("button", { name: copy["zoom.out"], exact: true }).click(); await expect(viewer(page).locator(".medias-zoomv")).toContainText("100%");
  await stage.focus(); await page.keyboard.press("+"); await viewer(page).getByRole("button", { name: copy["image.fit"], exact: true }).click(); await expect(viewer(page).locator(".medias-zoomv")).toContainText("100%");
  await expect(viewer(page)).not.toContainText(copy["head.ask"]); await capture(page, `files-portrait-${theme}`);
  await show(page, route(saved), theme); await ready(page); await viewer(page).getByRole("button", { name: copy["zoom.in"], exact: true }).click();
  const box = (await image(page).boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20); await page.mouse.up(); await expect.poll(() => image(page).evaluate((img: HTMLImageElement) => img.style.translate)).not.toBe("0px 0px");
  await c.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900)); await viewer(page).getByRole("button", { name: "Fit", exact: true }).click(); await ready(page); await capture(page, `files-fit-${theme}`);
  await show(page, route(saved, 2), theme); await ready(page, 180, 90);
  const files = await downloads(c.app, dataDir); c.cleanup.push(files.close); await download(page).click(); await expect.poll(async () => (await files.rows())[0]?.state).toBe("completed");
  const result = (await files.rows())[0]; expect(fs.readFileSync(result.file)).toEqual(Buffer.from(webp.split(",")[1], "base64")); expect(result.name).toMatch(/\.webp$/); expect(result.name).not.toMatch(/[/\\\p{Cc}\p{Cf}]/u); await files.close(); c.cleanup.splice(c.cleanup.indexOf(files.close), 1);
  await page.reload(); await ready(page, 180, 90); await c.app.close();
  c.app = await electron.launch({ args: [path.join(root, "packages/desktop/dist/main.cjs"), `--user-data-dir=${path.join(dataDir, "renderer")}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])], env: { ...process.env, ...env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: `#/${route(saved, 2)}&theme=${theme}`, CORTEX_LOCALE: "en" } as Record<string, string> });
  c.page = page = await c.app.firstWindow(); page.on("pageerror", (error) => c.errors.push(error.message)); await page.waitForFunction(() => "__bridgeFetch" in window); await page.emulateMedia({ reducedMotion: "reduce" }); await ready(page, 180, 90);
  expect((await histories(page, saved.session.id)).find((m) => m.info.id === saved.message)?.parts.filter((p) => p.type === "file")).toEqual(saved.parts); expect(fake.requests).toHaveLength(count);
});

// Independent malformed fixtures: preserve chunk framing/CRC, change the declared dimensions or payload.
function crc(bytes: Uint8Array) { let n = 0xffffffff; for (const b of bytes) { n ^= b; for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; }
function damaged(png: string, oversized: boolean) {
  const b = Buffer.from(png.split(",")[1], "base64");
  if (oversized) { b.writeUInt32BE(10000, 16); b.writeUInt32BE(5000, 20); b.writeUInt32BE(crc(b.subarray(12, 29)), 29); }
  else for (let at = 8; at + 12 <= b.length; at += b.readUInt32BE(at) + 12) if (b.toString("ascii", at + 4, at + 8) === "IDAT") { const size = b.readUInt32BE(at); b[at + 8] ^= 0xff; b.writeUInt32BE(crc(b.subarray(at + 4, at + 8 + size)), at + 8 + size); break; }
  return b.toString("base64");
}
function animated(png: string) {
  const b = Buffer.from(png.split(",")[1], "base64"), chunk = Buffer.alloc(20);
  chunk.writeUInt32BE(8); chunk.write("acTL", 4); chunk.writeUInt32BE(2, 8); chunk.writeUInt32BE(crc(chunk.subarray(4, 16)), 16);
  return Buffer.concat([b.subarray(0, 33), chunk, b.subarray(33)]).toString("base64");
}
test("Saved image sources and tuples refuse unsafe/oversized bytes before native assignment", async ({ run: c }) => {
  const { page } = c, png = await pixels(page), url = `${c.fake.url}/never-display-this.png`;
  const inputs: { part: PromptPartInput; title: string }[] = [
    { part: { type: "file", mime: "image/png", url }, title: copy["image.unsupportedTitle"] },
    { part: { type: "file", mime: "image/png", data: png.split(",")[1], url: png }, title: copy["image.unsupportedTitle"] },
    { part: { type: "file", mime: "image/png" }, title: copy["image.unsupportedTitle"] },
    { part: { type: "file", mime: "image/jpeg", data: png.split(",")[1] }, title: copy["image.invalidTitle"] },
    { part: { type: "file", mime: "image/svg+xml", data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.FILE_EXECUTED=1"/>').toString("base64") }, title: copy["image.unsupportedTitle"] },
    { part: { type: "file", mime: "text/html", data: Buffer.from("<script>window.FILE_EXECUTED=1</script>").toString("base64") }, title: copy["image.unsupportedTitle"] },
    { part: { type: "file", mime: "image/png", data: damaged(png, true) }, title: copy["image.tooLargeTitle"] },
    { part: { type: "file", mime: "image/png", data: animated(png) }, title: copy["image.unsupportedTitle"] },
  ];
  const saved = await save(page, inputs.map(({ part }, i) => ({ ...part, filename: `unsafe-${i}.png` }))), good = await save(page, [{ type: "file", mime: "image/png", url: png }]);
  const probe = await decoding(page); c.cleanup.push(probe.close); const requests: string[] = []; page.on("request", (r) => { if (r.url() === url) requests.push(r.url()); });
  await show(page, `chat?id=${saved.session.id}`); await expect(page.locator(".chat-ufiles .chat-att")).toHaveCount(inputs.length); await expect(page.locator(".chat-thumb")).toHaveCount(0);
  for (const [i, input] of inputs.entries()) { await show(page, route(saved, i)); await fence(page); await expect(viewer(page).getByText(input.title, { exact: true })).toBeVisible(); await expect(image(page)).toHaveCount(0); await expect(download(page)).toHaveCount(0); }
  expect((await probe.state()).assigned.filter((s) => /^(data:|blob:|https?:|file:)/.test(s))).toEqual([]); expect((await probe.state()).decoded).toEqual([]); expect(requests).toEqual([]); expect(await page.evaluate(() => "FILE_EXECUTED" in window)).toBe(false);
  for (const invalid of [`file-image?session=${good.session.id}`, `${route(good)}&part=${good.parts[0].id}`, route(good).replace(good.message, saved.message), route(good).replace(good.parts[0].id, saved.parts[0].id), route(good).replace(good.session.id, "..%2Fcredentials.json")]) {
    await show(page, invalid); await fence(page); await expect(viewer(page).getByText(copy["image.unavailableTitle"], { exact: true })).toBeVisible(); await expect(image(page)).toHaveCount(0);
  }
  const code = await save(page, [{ type: "file", mime: "image/png", url: png }], "code"); await show(page, route(code)); await expect(viewer(page).getByText(copy["image.unavailableTitle"], { exact: true })).toBeVisible();
  const corrupt = await save(page, [{ type: "file", mime: "image/png", data: damaged(png, false) }]), decoded = (await probe.state()).decoded.length; await show(page, route(corrupt)); await expect(viewer(page).getByText(copy["image.invalidTitle"], { exact: true })).toBeVisible(); await expect(image(page)).toHaveCount(0); expect((await probe.state()).decoded.length).toBeGreaterThan(decoded);
  await show(page, "file-image"); await expect(page.getByTestId("upload-dropzone")).toBeVisible();
});

test("Saved image read failures offer one real pending Retry", async ({ run: c }) => {
  const { page } = c, png = await pixels(page), saved = await save(page, [{ type: "file", mime: "image/png", url: png }]);
  const ipc = await gate(c.app, page); c.cleanup.push(ipc.close);
  for (const source of [`/api/sessions/${saved.session.id}`, `/api/sessions/${saved.session.id}/messages`]) {
    await show(page, "home"); await ipc.fail(source); await show(page, route(saved)); await expect(viewer(page).getByText(copy["image.loadTitle"], { exact: true })).toBeVisible();
    await ipc.fail(""); await ipc.arm(source); const before = (await ipc.calls()).filter((s) => s === `GET ${source}`).length;
    await viewer(page).getByRole("button", { name: "Try again", exact: true }).click(); await ipc.waiting(source);
    const retry = viewer(page).getByRole("button", { name: "Try again", exact: true }); if (await retry.count()) expect(await retry.isEnabled()).toBe(false);
    expect((await ipc.calls()).filter((s) => s === `GET ${source}`)).toHaveLength(before + 1); await ipc.release(); await ready(page);
  }
});

test("Deletion fences held history and download validation, clearing visible pixels immediately", async ({ run: c }) => {
  const { page } = c, png = await pixels(page), a = await save(page, [{ type: "file", mime: "image/png", url: png }]), b = await save(page, [{ type: "file", mime: "image/png", url: png }]);
  const ipc = await gate(c.app, page), probe = await decoding(page), files = await downloads(c.app, c.dataDir); c.cleanup.push(ipc.close, probe.close, files.close);
  const source = `/api/sessions/${a.session.id}/messages`; await ipc.arm(source); await show(page, route(a)); await ipc.waiting(source); expect(await ipc.status()).toBe(200);
  await call(page, `/api/sessions/${a.session.id}`, "DELETE"); await expect(viewer(page).getByText(copy["image.unavailableTitle"], { exact: true })).toBeVisible(); await ipc.release(); await expect(image(page)).toHaveCount(0);
  await show(page, route(b)); await ready(page); const src = await image(page).getAttribute("src"), validation = `/api/sessions/${b.session.id}`;
  await ipc.arm(validation); await download(page).click(); await ipc.waiting(validation); expect(await ipc.status()).toBe(200);
  await call(page, validation, "DELETE"); await expect(image(page)).toHaveCount(0); await expect(download(page)).toHaveCount(0); await expect(viewer(page).locator(".medias-exif, .medias-mini")).toHaveCount(0);
  await expect.poll(async () => (await probe.state()).revoked).toContain(src); await ipc.release(); expect(await files.rows()).toEqual([]); await expect(image(page)).toHaveCount(0);
  await probe.close(); c.cleanup.splice(c.cleanup.indexOf(probe.close), 1); await page.reload(); await expect(viewer(page).getByText(copy["image.unavailableTitle"], { exact: true })).toBeVisible();
});

test("Native decode and canceled preview callbacks cannot restore an older attachment owner", async ({ run: c }) => {
  const { page } = c, png = await pixels(page), tall = await pixels(page, "image/png", 90, 180, "#206bd9");
  const saved = await save(page, [{ type: "file", mime: "image/png", filename: "same.png", url: png }, { type: "file", mime: "image/png", filename: "same.png", url: tall }]);
  const probe = await decoding(page), ipc = await gate(c.app, page); c.cleanup.push(probe.close, ipc.close);
  await probe.arm(); await show(page, route(saved)); await probe.waiting(); const obsolete = (await probe.state()).waiting;
  await show(page, route(saved, 1)); await ready(page, 90, 180); const current = await image(page).getAttribute("src"); await probe.release(); await expect(image(page)).toHaveAttribute("src", current!); await ready(page, 90, 180); await expect.poll(async () => (await probe.state()).revoked).toContain(obsolete);
  await show(page, "home"); const source = `/api/sessions/${saved.session.id}/messages`; await ipc.arm(source); await show(page, route(saved, 1)); await ipc.waiting(source); await fence(page);
  const transition = await transitions(page); c.cleanup.push(transition.close);
  await show(page, "home?preview"); await expect.poll(() => transition.handle.evaluate((h) => h.pending.length)).toBe(1); expect(new URL(page.url()).hash).toContain("home?preview"); await ipc.release(); await expect(image(page)).toHaveCount(0);
  const reads = (await ipc.calls()).filter((s) => s === `GET ${source}`).length; await page.evaluate(() => history.back());
  await expect.poll(() => page.url()).toBe(await transition.handle.evaluate((h) => h.live)); await expect.poll(() => transition.handle.evaluate((h) => h.pending.length)).toBe(2);
  await transition.handle.evaluate(async (h) => { for (const p of [...h.pending].reverse()) { p.release(); await p.done; } h.restore(); }); await ready(page, 90, 180);
  expect(await transition.handle.evaluate((h) => h.owner.isConnected)).toBe(true); expect((await ipc.calls()).filter((s) => s === `GET ${source}`).length).toBeGreaterThan(reads);
  await transition.close(); c.cleanup.splice(c.cleanup.indexOf(transition.close), 1);
  await show(page, "home"); await probe.arm(); await show(page, route(saved)); await probe.waiting(); const deleted = (await probe.state()).waiting;
  await call(page, `/api/sessions/${saved.session.id}`, "DELETE"); await expect(viewer(page).getByText(copy["image.unavailableTitle"], { exact: true })).toBeVisible(); await probe.release(); await expect(image(page)).toHaveCount(0); await expect.poll(async () => (await probe.state()).revoked).toContain(deleted);
});

test("Opening a saved attachment preserves dirty, refused, reading and submitting Chat drafts", async ({ run: c }) => {
  const { page } = c, png = await pixels(page), saved = await save(page, [{ type: "file", mime: "image/png", filename: "saved.png", url: png }]);
  await show(page, `chat?id=${saved.session.id}`); await expect(open(page, "saved.png")).toBeVisible(); const url = page.url(), input = page.getByTestId("composer-input");
  const blocked = async () => { await open(page, "saved.png").click(); await expect(page.getByText(copy["image.finishDraft"], { exact: true }).first()).toBeVisible(); expect(page.url()).toBe(url); };
  await input.fill("Keep this draft"); await blocked(); await expect(input).toHaveValue("Keep this draft"); await input.fill("");
  const reading = await page.evaluateHandle(() => {
    const read = FileReader.prototype.readAsDataURL; let release = () => {};
    FileReader.prototype.readAsDataURL = function (blob) { FileReader.prototype.readAsDataURL = read; const resume = read.bind(this, blob); release = () => { release = () => {}; resume(); }; };
    return { release: () => release(), restore: () => { FileReader.prototype.readAsDataURL = read; release(); } };
  });
  const restoreRead = async () => { await reading.evaluate((h) => h.restore()); await reading.dispose(); }; c.cleanup.push(restoreRead);
  await page.getByTestId("attach-input").setInputFiles({ name: "draft.png", mimeType: "image/png", buffer: Buffer.from(png.split(",")[1], "base64") }); await blocked();
  await reading.evaluate((h) => h.release()); await expect(page.locator(".chat-attach .ttl")).toHaveText("draft.png"); await blocked();
  await input.fill("Refused draft"); await page.getByTestId("model-trigger").click(); await page.getByTestId("model-option").filter({ hasText: "Plain Text" }).click(); await page.getByTestId("composer-send").click();
  await expect(page.getByText("This model can’t read images.", { exact: true }).first()).toBeVisible(); await blocked(); await expect(input).toHaveValue("Refused draft"); await expect(page.locator(".chat-attach .ttl")).toHaveText("draft.png");
  await page.getByTestId("model-trigger").click(); await page.getByTestId("model-option").filter({ hasText: "Reasoner Large" }).click();
  const ipc = await gate(c.app, page); c.cleanup.push(ipc.close); const source = `/api/sessions/${saved.session.id}/prompt`; await ipc.arm(source, "POST"); await page.getByTestId("composer-send").click(); await ipc.waiting(source, "POST"); await blocked(); await expect(input).toHaveValue("Refused draft"); await ipc.release(); await expect(input).toHaveValue("");
  await expect.poll(async () => (await histories(page, saved.session.id)).filter((m) => m.info.role === "assistant" && m.info.time.completed !== undefined).length).toBe(2);
  await restoreRead(); c.cleanup.splice(c.cleanup.indexOf(restoreRead), 1);
  await call(page, "/api/providers/fake", "PATCH", { enabled: false }); await expect(page.getByTestId("model-trigger")).toHaveText("No model"); await input.fill("No-model draft"); await page.getByTestId("composer-send").click(); await expect(page.getByText("No model is set up.", { exact: true })).toBeVisible(); await blocked(); await expect(input).toHaveValue("No-model draft"); await input.fill("");
  const transition = await transitions(page); c.cleanup.push(transition.close); await open(page, "saved.png").click(); await expect.poll(() => transition.handle.evaluate((h) => h.pending.length)).toBe(1);
  await expect(input).toBeDisabled(); await page.evaluate(() => history.back()); await expect.poll(() => page.url()).toBe(url); await expect.poll(() => transition.handle.evaluate((h) => h.pending.length)).toBe(2);
  await transition.handle.evaluate(async (h) => { for (const p of [...h.pending].reverse()) { p.release(); await p.done; } h.restore(); }); await expect(input).toBeEnabled(); await input.fill("Recovered after canceled Open"); await expect(input).toHaveValue("Recovered after canceled Open");
});

test("Saved image metadata and controls remain reachable in all eight locales at minimum size", async ({ run: c }) => {
  const { page } = c, png = await pixels(page), saved = await save(page, [{ type: "file", mime: "image/png", filename: `写真 ${"W".repeat(90)}.png`, url: png }]);
  await c.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  for (const locale of ["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"]) {
    const labels = JSON.parse(fs.readFileSync(path.join(root, "packages/i18n/locales", locale, "files.json"), "utf8"));
    await page.evaluate((locale) => localStorage.setItem("cortex.locale", locale), locale); await show(page, route(saved), "dark"); await page.reload();
    await expect(image(page)).toBeVisible(); await expect(viewer(page).getByRole("button", { name: labels["head.download"], exact: true })).toBeEnabled();
    await expect(viewer(page).getByText(labels["image.details"], { exact: true })).toBeVisible(); await capture(page, `files-locale-${locale}`);
  }
});
