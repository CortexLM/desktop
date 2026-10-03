import { test, expect, type Page } from "@playwright/test";
import type { MessageWithParts, ModelRef, PromptInput, Session } from "@cortex/schema";
import fs from "node:fs";
import path from "node:path";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const A = { providerID: "plain", modelID: "text-only" };
const B = { providerID: "fake", modelID: "reasoner" };
const models = {
  fake: { ...catalog.fake, models: { reasoner: catalog.fake.models.reasoner } },
  plain: { ...catalog.fake, id: "plain", name: "Plain Compatible", models: {
    "text-only": { ...catalog.fake.models["text-only"], limit: { context: 100000, output: 1000 } },
  } },
  mistralish: catalog.mistralish,
};
const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify(models))}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
test.setTimeout(30_000);

async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ url, method, body }) => {
    const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
    const response = await bridge(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
    return response.json();
  }, { url, method, body });
}

async function select(page: Page, name: string) {
  await page.locator(".composer .model").click();
  await page.getByRole("menuitemradio").filter({ hasText: name }).click({ timeout: 2500 });
  await expect(page.locator(".composer .model")).toHaveAttribute("aria-expanded", "false");
}

for (const theme of ["light", "dark"]) {
  test(`Code sends the chosen model, restores session selection and refuses unavailable models — ${theme}`, async () => {
    const fake = await startFakeProvider();
    const { app, page, dataDir } = await launch({ hash: `#/code?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PICK_DIRECTORY: "", CORTEX_TEST_PROVIDER_BASEURL: "" } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const directory = path.join(dataDir, "project");
      fs.mkdirSync(directory);
      await app.evaluate(({ app, BrowserWindow, dialog }) => {
        BrowserWindow.getAllWindows()[0].setSize(960, 640);
        dialog.showOpenDialog = (() => new Promise((resolve) => {
          (app as NodeJS.EventEmitter).once("code-model-directory", (folder: string | null) => resolve({ canceled: !folder, filePaths: folder ? [folder] : [] }));
        })) as typeof dialog.showOpenDialog;
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(960);
      // Both configured providers are genuinely keyless; a copied Chat key-only picker must fail.
      for (const provider of [A.providerID, B.providerID]) await call(page, `/api/providers/${provider}`, "PATCH", { enabled: true, baseURL: fake.url });
      await call(page, "/api/sessions", "POST", { title: "Unrelated latest chat", model: A });
      await page.evaluate(() => localStorage.setItem("cortex.model", "plain/text-only"));
      await page.addInitScript(() => {
        const w = window as unknown as { codePrompts: unknown[] };
        w.codePrompts = [];
        const text = Request.prototype.text;
        // Observe the real IPC payload without replacing its response or bypassing the engine.
        Request.prototype.text = async function () {
          const body = await text.call(this);
          if (this.method === "POST" && /\/api\/sessions\/[^/]+\/prompt$/.test(new URL(this.url).pathname)) w.codePrompts.push(JSON.parse(body));
          return body;
        };
      });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await select(page, "Reasoner Large");
      await page.locator(".composer .model").click();
      await page.getByTestId("thinking-toggle").getByRole("switch").setChecked(false);
      await page.keyboard.press("Escape");
      const input = page.getByTestId("code-composer-input"), form = page.locator("form.composer");
      const draft = "  Use the chosen model in this folder  ";
      await input.fill(draft);
      await input.press("Enter");
      await expect(input).toBeDisabled();
      await expect(form).toHaveAttribute("aria-busy", "true");
      await form.evaluate((el: HTMLFormElement) => { el.requestSubmit(); el.requestSubmit(); });
      await expect.poll(() => app.evaluate(({ app }) => app.listenerCount("code-model-directory"))).toBe(1);
      await app.evaluate(({ app }) => app.emit("code-model-directory", null));
      await expect(input).toBeEnabled();
      await expect(input).toHaveValue(draft);
      expect(await call<Session[]>(page, "/api/sessions?kind=code")).toEqual([]);
      expect(fake.requests).toHaveLength(0);

      await input.press("Enter");
      await expect.poll(() => app.evaluate(({ app }) => app.listenerCount("code-model-directory"))).toBe(1);
      await app.evaluate(({ app }, folder) => app.emit("code-model-directory", folder), directory);
      await expect(page).toHaveURL(/#\/code-session\?/);
      const id = new URLSearchParams(page.url().split("?")[1]).get("id")!;
      await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
      expect(fake.requests).toHaveLength(1);
      expect(fake.requests[0].body.model).toBe(B.modelID);
      expect(await call<Session>(page, `/api/sessions/${id}`)).toMatchObject({ kind: "code", model: B, directory, agent: "build" });
      expect(await page.evaluate(() => (window as unknown as { codePrompts: PromptInput[] }).codePrompts.at(-1))).toMatchObject({ model: B, reasoning: false });
      await expect(input).toHaveValue("");
      await expect(page.getByTestId("composer-send")).toBeVisible();

      await select(page, "Plain Text");
      await input.fill("Continue with the plain model");
      await input.press("Enter");
      await expect.poll(async () => {
        const messages = await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
        return messages.length === 4 && !!messages.at(-1)?.info.time.completed;
      }).toBe(true);
      expect(fake.requests).toHaveLength(2);
      expect(fake.requests[1].body.model).toBe(A.modelID);
      expect(fake.requests[1].body.tools).toBeUndefined();
      const messages = await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
      expect(messages.map((m) => m.info.model)).toEqual([B, B, A, A]);
      expect(await page.evaluate(() => (window as unknown as { codePrompts: PromptInput[] }).codePrompts.at(-1)?.reasoning)).toBeUndefined();

      await call(page, "/api/sessions", "POST", { title: "Newer unrelated chat", model: B });
      await page.evaluate(() => localStorage.setItem("cortex.model", "fake/reasoner"));
      await page.reload();
      await expect(page.locator(".composer .model")).toHaveText("Plain Text");
      await call(page, `/api/providers/${A.providerID}`, "PATCH", { enabled: false });
      await input.fill(draft);
      await input.press("Enter");
      await expect(page.getByText("Message not sent", { exact: true })).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(input).toBeEnabled();
      expect(await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`)).toEqual(messages);
      expect((await call<Session>(page, `/api/sessions/${id}`)).model).toEqual(A);
      expect(fake.requests).toHaveLength(2);

      await page.reload();
      await expect(page.locator(".composer .model")).toHaveText("No model");
      await input.fill(draft);
      await input.press("Enter");
      await expect(page.getByText("Message not sent", { exact: true })).toBeVisible();
      await expect(input).toHaveValue(draft);
      expect(fake.requests).toHaveLength(2);
      for (const control of [input, page.locator(".composer .model"), page.getByTestId("composer-send")]) {
        await expect(control).toBeInViewport({ ratio: 1 });
        await control.click({ trial: true, timeout: 1500 });
      }
      const shot = test.info().outputPath(`code-models-${theme}.png`);
      await page.screenshot({ path: shot, animations: "disabled" });
      await test.info().attach(`code-models-${theme}`, { path: shot, contentType: "image/png" });
      expect(errors).toEqual([]);
    } finally { await app.close(); await fake.close(); }
  });

  test(`Code image refusal leaves attachment recovery controls reachable — ${theme}`, async () => {
    const fake = await startFakeProvider();
    const { app, page, dataDir } = await launch({ hash: `#/code?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: "" } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(960);
      for (const provider of [A.providerID, B.providerID]) await call(page, `/api/providers/${provider}`, "PATCH", { enabled: true, baseURL: fake.url });
      const session = await call<Session>(page, "/api/sessions", "POST", { kind: "code", directory: dataDir, model: A });
      await page.goto(`${page.url().split("#")[0]}#/code-session?id=${session.id}&theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByTestId("model-trigger")).toHaveText("Plain Text");
      await select(page, "Reasoner Large");
      const filename = "architecture-screenshot-with-long-filename.png";
      await page.getByTestId("attach-input").setInputFiles({ name: filename, mimeType: "image/png", buffer: PNG });
      await expect(page.locator(".chat-att-img")).toBeVisible();
      await select(page, "Plain Text");
      await page.evaluate(() => {
        const w = window as unknown as { codeRefusals: { status: number; code?: string }[] };
        w.codeRefusals = [];
        const json = Response.prototype.json;
        // Observe real engine refusals; requests and responses still pass through IPC.
        Response.prototype.json = async function () {
          const value = await json.call(this);
          if (this.status >= 400) w.codeRefusals.push({ status: this.status, code: value?.error?.code });
          return value;
        };
      });
      const input = page.getByTestId("code-composer-input"), draft = "  Keep this image request  ";
      await input.fill(draft);
      await input.press("Enter");
      const toast = page.locator(".toast").filter({ hasText: "Message not sent" });
      await expect(toast).toBeVisible();
      await toast.hover();
      await expect(input).toHaveValue(draft);
      await expect(page.locator(".chat-att")).toContainText(filename);
      expect(await page.evaluate(() => (window as unknown as { codeRefusals: unknown[] }).codeRefusals)).toEqual([{ status: 422, code: "model_no_image_input" }]);
      expect(await call<MessageWithParts[]>(page, `/api/sessions/${session.id}/messages`)).toEqual([]);
      expect((await call<Session>(page, `/api/sessions/${session.id}`)).model).toEqual(A);
      expect(fake.requests).toHaveLength(0);
      const shot = test.info().outputPath(`code-attachment-refusal-${theme}.png`);
      await page.screenshot({ path: shot, animations: "disabled" });
      await test.info().attach(`code-attachment-refusal-${theme}`, { path: shot, contentType: "image/png" });
      for (const control of [page.getByRole("button", { name: `Remove ${filename}`, exact: true }), page.getByTestId("model-trigger"), input, page.getByTestId("composer-send")]) {
        await expect(control).toBeInViewport({ ratio: 1 });
        expect(await control.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), "Attachment recovery control must not be covered by the refusal toast").toBe(true);
        await control.click({ trial: true, timeout: 1000 });
      }
      const box = await page.locator(".split-l .chat-box").boundingBox(), toastBox = await toast.boundingBox();
      expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(box!.y - 11);
      await expect(toast).toBeVisible();

      await select(page, "Reasoner Large");
      await expect(input).toHaveValue(draft);
      await expect(page.locator(".chat-att")).toHaveCount(1);
      await page.locator("form.composer").evaluate((el: HTMLFormElement) => { el.requestSubmit(); el.requestSubmit(); });
      await expect(input).toHaveValue("");
      await expect(page.locator(".chat-att")).toHaveCount(0);
      await expect.poll(async () => {
        const messages = await call<MessageWithParts[]>(page, `/api/sessions/${session.id}/messages`);
        return messages.length === 2 && !!messages.at(-1)?.info.time.completed;
      }).toBe(true);
      expect(fake.requests).toHaveLength(1);
      expect(fake.requests[0].body.model).toBe(B.modelID);
      const sent = fake.requests[0].body.messages as { role: string; content: { type: string; image_url?: { url: string } }[] }[];
      expect(sent.filter((m) => m.role === "user").flatMap((m) => m.content).filter((p) => p.type === "image_url")).toEqual([{ type: "image_url", image_url: { url: `data:image/png;base64,${PNG.toString("base64")}` } }]);
      const saved = await call<MessageWithParts[]>(page, `/api/sessions/${session.id}/messages`);
      expect(saved.map((m) => m.info.model)).toEqual([B, B]);
      expect(saved[0].parts.filter((p) => p.type === "text")).toMatchObject([{ text: draft.trim() }]);
      expect(saved[0].parts.filter((p) => p.type === "file")).toMatchObject([{ filename, mime: "image/png", url: `data:image/png;base64,${PNG.toString("base64")}` }]);
      expect(saved[1].info.error).toBeUndefined();
      expect(await call<Session[]>(page, "/api/sessions?kind=code")).toMatchObject([{ id: session.id, model: B, directory: dataDir }]);
      await page.reload();
      await expect(page.getByTestId("model-trigger")).toHaveText("Reasoner Large");
      expect(await call<MessageWithParts[]>(page, `/api/sessions/${session.id}/messages`)).toEqual(saved);
      expect(fake.requests).toHaveLength(1);
      expect(errors).toEqual([]);
    } finally { await app.close(); await fake.close(); }
  });
}

test("Code keeps unsupported and missing session models instead of falling back", async () => {
  const fake = await startFakeProvider();
  const { app, page, dataDir } = await launch({ hash: "#/code", env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: "" } });
  try {
    await call(page, "/api/providers/fake", "PATCH", { baseURL: fake.url });
    await call(page, "/api/providers/mistralish", "PATCH", { baseURL: fake.url });
    for (const model of [{ providerID: "mistralish", modelID: "m" }, { providerID: "fake", modelID: "missing" }] satisfies ModelRef[]) {
      const session = await call<Session>(page, "/api/sessions", "POST", { kind: "code", directory: dataDir, model });
      await page.goto(`${page.url().split("#")[0]}#/code-session?id=${session.id}`);
      await page.reload();
      await expect(page.locator(".composer .model")).toHaveText(model.modelID === "m" ? "M" : "No model", { timeout: 2500 });
      const input = page.getByTestId("code-composer-input");
      await input.fill("Keep this unsupported request");
      await input.press("Enter");
      await expect(page.getByText("Message not sent", { exact: true })).toBeVisible();
      await expect(input).toHaveValue("Keep this unsupported request");
      expect((await call<Session>(page, `/api/sessions/${session.id}`)).model).toEqual(model);
      expect(await call<MessageWithParts[]>(page, `/api/sessions/${session.id}/messages`)).toEqual([]);
      expect(fake.requests).toHaveLength(0);
    }
  } finally { await app.close(); await fake.close(); }
});

for (const theme of ["light", "dark"]) test(`Code persisted provider failure stays Failed across reload and recovers after a successful follow-up — ${theme}`, async () => {
  type EngineEvent = import("@cortex/schema").Event;
  type Probe = { buffer: string; events: EngineEvent[] };
  const fake = await startFakeProvider({ rejectFirst: true });
  const { app, page, dataDir } = await launch({ hash: `#/code?theme=${theme}`, locale: "en", env: {
    CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`, CORTEX_TEST_PICK_DIRECTORY: "",
  } }).catch(async (error) => { await fake.close(); throw error; });
  const errors: string[] = [], rendererHttp: string[] = [], evidence: Record<string, unknown> = { theme };
  const key = "sk-test-code-failure", first = "Persist this failed Code request", next = "Recover in the same Code session";
  const answer = "Hello from the streaming test provider. Everything works.";
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (/^https?:/.test(request.url())) rendererHttp.push(request.url()); });
  const capture = async (name: string) => {
    const image = test.info().outputPath(`${name}-${theme}.png`);
    await page.screenshot({ path: image, animations: "disabled" });
    await test.info().attach(name, { path: image, contentType: "image/png" });
  };
  try {
    const directory = path.join(dataDir, "project"); fs.mkdirSync(directory);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.evaluate(({ BrowserWindow, dialog }, directory) => {
      const window = BrowserWindow.getAllWindows()[0], contents = window.webContents, send = contents.send.bind(contents);
      window.setContentSize(960, 640);
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [directory] })) as typeof dialog.showOpenDialog;
      const probe: Probe = { buffer: "", events: [] };
      (globalThis as unknown as { codeFailureProbe: Probe }).codeFailureProbe = probe;
      // Observe the existing SSE delivery channel without resubscribing or changing chunks.
      contents.send = (channel, ...args) => {
        if (channel === "cortex:events:chunk") {
          probe.buffer += args[0] as string;
          let end: number;
          while ((end = probe.buffer.indexOf("\n\n")) >= 0) {
            const frame = probe.buffer.slice(0, end); probe.buffer = probe.buffer.slice(end + 2);
            const data = frame.split("\n").find((line) => line.startsWith("data:"))?.slice(5);
            if (data) probe.events.push(JSON.parse(data) as EngineEvent);
          }
        }
        send(channel, ...args);
      };
    }, directory);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await call(page, "/api/providers/fake/key", "PUT", { key });
    await select(page, "Reasoner Large");
    const input = page.getByTestId("code-composer-input"), badge = page.locator(".content-top .badge"), banner = page.locator(".code-banner");
    const badgeState = () => badge.evaluate((el) => ({ text: el.textContent, className: el.className }));
    const fence = async () => {
      await call(page, "/api/health");
      await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
    };
    await input.fill(first); await input.press("Enter");
    await expect(page).toHaveURL(/#\/code-session\?/);
    const id = new URLSearchParams(page.url().split("?")[1]).get("id")!;
    const messages = () => call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
    const events = () => app.evaluate(() => (globalThis as unknown as { codeFailureProbe: Probe }).codeFailureProbe.events);
    const statuses = async () => (await events()).filter((e) => e.type === "session.status" && e.properties.sessionID === id).map((e) => e.type === "session.status" && e.properties.status.type);
    await expect.poll(async () => {
      const rows = await messages(), last = rows.at(-1);
      return rows.length === 2 && last?.info.time.completed !== undefined ? last.info.error?.code : undefined;
    }).toBe("provider_error"); // Existing rejectFirst fixture is a real HTTP400, not an auth401.
    await expect.poll(statuses).toEqual(["busy", "error", "idle"]);
    await expect(banner).toContainText("The task stopped"); await expect(page.getByTestId("code-stop")).toHaveCount(0);
    await fence();
    const failed = await messages();
    expect(failed.map((m) => m.info.role)).toEqual(["user", "assistant"]);
    expect(failed[0].parts.filter((p) => p.type === "text")).toMatchObject([{ text: first }]);
    expect(fake.requests).toHaveLength(1);
    expect(await call<Session>(page, `/api/sessions/${id}`)).toMatchObject({ kind: "code", model: B, directory, agent: "build" });
    evidence.id = id; evidence.failed = failed; evidence.initialBadge = await badgeState();
    // Soft assertions reach the successful follow-up even on the original contradictory badge.
    expect.soft(evidence.initialBadge, "A persisted failed Code result must not be green Ready").toEqual({ text: "Failed", className: "badge err" });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(banner).toContainText("The task stopped"); await expect(page.getByTestId("code-stop")).toHaveCount(0);
    await expect(page.getByTestId("model-trigger")).toHaveText("Reasoner Large");
    await fence();
    expect(await messages()).toEqual(failed); expect(fake.requests).toHaveLength(1);
    evidence.reloadedBadge = await badgeState();
    expect.soft(evidence.reloadedBadge, "Reload must derive Failed from the persisted assistant error").toEqual({ text: "Failed", className: "badge err" });
    await capture("failed-reload");
    await input.fill(next); await input.press("Enter");
    await expect(badge).toHaveText("Running"); await expect(badge).toHaveClass("badge run");
    await expect(page.getByTestId("code-stop")).toBeVisible(); await expect(banner).toHaveCount(0);
    evidence.runningBadge = await badgeState();
    await expect.poll(async () => {
      const rows = await messages(), last = rows.at(-1);
      return rows.length === 4 && last?.info.time.completed !== undefined && !last.info.error ? last.parts.filter((p) => p.type === "text").map((p) => p.text).join("") : "";
    }).toBe(answer);
    await expect.poll(statuses).toEqual(["busy", "error", "idle", "busy", "idle"]);
    await expect(badge).toHaveText("Ready"); await expect(badge).toHaveClass("badge ok"); await expect(banner).toHaveCount(0);
    await expect(page.getByTestId("code-stop")).toHaveCount(0); await expect(input).toHaveValue("");
    const recovered = await messages();
    expect(recovered.slice(0, 2)).toEqual(failed);
    expect(recovered.map((m) => m.info.sessionID)).toEqual([id, id, id, id]);
    expect(recovered[2].parts.filter((p) => p.type === "text")).toMatchObject([{ text: next }]);
    expect(recovered[3].info.error).toBeUndefined();
    expect(await call<Session[]>(page, "/api/sessions?kind=code")).toMatchObject([{ id, model: B, directory }]);
    expect(fake.requests).toHaveLength(2);
    for (const request of fake.requests) { expect(request.body.model).toBe(B.modelID); expect(request.auth).toBe(`Bearer ${key}`); }
    const streamed = (await events()).filter((e) => e.type === "part.delta" && e.properties.messageID === recovered[3].info.id);
    expect(streamed.length).toBeGreaterThan(0);
    await expect(page.locator(".split-l .msg-user")).toHaveText([first, next]); await expect(page.locator(".split-l .msg-bot")).toHaveText([answer]);
    evidence.recovered = recovered; evidence.recoveredBadge = await badgeState();
    expect(errors).toEqual([]); expect(rendererHttp).toEqual([]);
    await capture("recovered");
  } finally {
    try {
      const events = await app.evaluate(() => (globalThis as unknown as { codeFailureProbe?: Probe }).codeFailureProbe?.events ?? []);
      await test.info().attach("code-failure-evidence", { body: JSON.stringify({ ...evidence, events, errors, rendererHttp, requests: fake.requests }, null, 2), contentType: "application/json" });
    } finally { try { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); } finally { await fake.close(); } }
  }
});
