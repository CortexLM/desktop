import { test as base, expect, type Page } from "@playwright/test";
import http from "node:http";
import type { RemoteAuthState, RemoteMessageView, RemoteSessionView, Session } from "@cortex/schema";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import chatCopy from "../../packages/i18n/locales/en/chat.json" with { type: "json" };
import { launch } from "./fixtures";

const conversationID = "cnv_01h45ytscbeewvwm6xr90nbxp4";
const assistantID = "msg_01h45ytscbeewvwm6xr90nbxp4";
const fileID = "lbf_01h45ytscbeewvwm6xr90nbxp4";
const nextFileID = "lbf_01h45ytscbeewvwm6xr90nbxp5";
const nextConversationID = "cnv_01h45ytscbeewvwm6xr90nbxp5";
const nextAssistantID = "msg_01h45ytscbeewvwm6xr90nbxp5";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const turnPath = "/v1/conversations/turns";
// Turn streams carry Redis stream IDs (`<ms>-<seq>`); bare numbers are refused as cursors.
const cursor = (seq: number) => `1700000000000-${seq}`;
const frame = (id: number | string, event: unknown) => `id: ${typeof id === "number" ? cursor(id) : id}\ndata: ${JSON.stringify(event)}\n\n`;
const textFrame = (text: string) => frame(7, { type: "text_delta", message_id: assistantID, delta: text });
const doneFrame = () => frame(8, { type: "done", message_id: assistantID, finish_reason: "stop" });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
type Turn = { path: string; raw: string; headers: http.IncomingHttpHeaders; response: http.ServerResponse };

// Only HTTP responses are fixtures. Authentication, discovery, admission and replay
// run through the installed SDK in the real Electron main process.
async function backend() {
  const turns: Turn[] = [], localBodies: Record<string, unknown>[] = [], errors: string[] = [];
  const historyRequests: { path: string; authorization: string | undefined }[] = [];
  const uploads: { bytes: Buffer; filename: string | null }[] = [];
  const uploadURLs: string[] = [];
  const arrivals = Array.from({ length: 3 }, () => deferred<Turn>());
  const historyControl = { held: false, arrival: deferred<http.ServerResponse>() };
  const models = [{
    id: "fixture", name: "Cortex Fixture", configured: true,
    capabilities: { reasoning: true, image: true, tools: true, context_tokens: 8192, output_tokens: 1024 },
  }, {
    id: "fixture-next", name: "Cortex Next Fixture", configured: true,
    capabilities: { reasoning: true, image: true, tools: true, context_tokens: 8192, output_tokens: 1024 },
  }, {
    id: "fixture-no-image", name: "Cortex Text Fixture", configured: true,
    capabilities: { reasoning: true, image: false, tools: true, context_tokens: 8192, output_tokens: 1024 },
  }, {
    id: "fixture-unknown", name: "Cortex Unknown Fixture", configured: true,
    capabilities: { reasoning: false, image: false, tools: false, context_tokens: 0, output_tokens: 0 },
  }, {
    id: "fixture-disabled", name: "Cortex Disabled Fixture", configured: false,
    capabilities: { reasoning: true, image: true, tools: true, context_tokens: 8192, output_tokens: 1024 },
  }];
  const modelQueries: string[] = [];
  const json = (res: http.ServerResponse, body: unknown, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks), raw = bytes.toString();
      const url = new URL(req.url!, "http://127.0.0.1"), route = url.pathname;
      if (req.method === "POST" && route === "/v1/library") {
        const filename = url.searchParams.get("filename");
        uploads.push({ bytes, filename });
        uploadURLs.push(url.href);
        return json(res, {
          id: uploads.length === 1 ? fileID : nextFileID, filename, content_type: "image/png", byte_size: bytes.length,
          access: "owner", kind: "image", source: "upload",
          ...(url.searchParams.has("conversation_id") ? { conversation_id: url.searchParams.get("conversation_id") } : {}),
        });
      }
      if (route === "/readyz") { res.end("ok"); return; }
      // The signed-in sidebar reads the account's Bots for its shortcut; this account has none.
      if (req.method === "GET" && route === "/v1/mascots") return json(res, { items: [], has_more: false });
      if (req.method === "GET" && route === "/v1/bot/inbox") return json(res, { items: [], working_mascot_ids: [] });
      if (req.method === "GET" && route === "/v1/notifications") return json(res, { items: [], has_more: false });
      if (route === "/v1/instance") return json(res, {
        mode: "self_host", version: "test",
        auth: { mode: "cortex", required: true, providers: ["cortex"] },
        registry: { enabled: true },
      });
      if (route === "/v1/registry/models") {
        modelQueries.push(url.search);
        return json(res, {
          items: models.filter((model) => url.searchParams.get("configured") !== "true" || model.configured),
          source: "cache", has_more: false,
        });
      }
      if (req.method === "POST" && route === "/v1/auth/magic-auth") {
        res.writeHead(204); res.end(); return;
      }
      // A producer without native rotation keeps the email-code session process-local.
      if (req.method === "POST" && route === "/v1/auth/refresh") { res.writeHead(401); res.end(); return; }
      if (req.method === "POST" && route === "/v1/auth/magic-auth/verify") {
        res.setHeader("set-cookie", "cortex_rt=test-only-chat-cookie; HttpOnly; Path=/v1/auth");
        return json(res, { status: "session", access_token: "test-only-chat-token" });
      }
      if (req.method === "GET" && (route === `/v1/conversations/${conversationID}`
        || route === `/v1/conversations/${conversationID}/messages`)) {
        historyRequests.push({ path: route, authorization: req.headers.authorization });
        if (route === `/v1/conversations/${conversationID}`) return json(res, {
          id: conversationID, title: "Saved title", model_slug: "fixture", message_count: 99,
        });
        if (historyControl.held) { historyControl.arrival.resolve(res); return; }
        return json(res, {
          items: [
            {
              id: nextAssistantID, parent_message_id: null, role: "user", text: "Saved question",
              created_at: "2026-10-04T00:00:00.000Z",
              version_index: 0, version_count: 1, is_active_version: true,
            },
            {
              id: assistantID, parent_message_id: nextAssistantID, role: "assistant", text: "Saved answer",
              created_at: "2026-10-04T00:00:01.000Z",
              version_index: 0, version_count: 1, is_active_version: true,
              finish_reason: "stop", reasoning: "Retained reasoning",
              parts: [{ id: "history-reasoning", sequence: 0, kind: "reasoning", text: "Retained reasoning", retention: "retained" },
                { id: "history-answer", sequence: 1, kind: "text", text: "Saved answer", retention: "retained" }],
            },
          ],
          has_more: false, has_older: false, has_newer: false,
        });
      }
      if (req.method === "POST" && route.endsWith("/turns")) {
        const turn = { path: route, raw, headers: req.headers, response: res };
        turns.push(turn);
        arrivals[turns.length - 1]?.resolve(turn);
        return; // Each test explicitly releases headers and terminal frames.
      }
      if (req.method === "POST" && route === "/v1/chat/completions") {
        localBodies.push(JSON.parse(raw) as Record<string, unknown>);
        res.writeHead(200, { "content-type": "text/event-stream" });
        const chunk = (delta: object, finish: string | null) => `data: ${JSON.stringify({
          id: "local-fixture", object: "chat.completion.chunk", created: 1, model: "reasoner",
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`;
        res.end(chunk({ role: "assistant", content: "Local fixture answer" }, null)
          + chunk({}, "stop") + "data: [DONE]\n\n");
        return;
      }
      errors.push(`${req.method} ${route}`);
      json(res, { code: "not_found" }, 404);
    })().catch((error: unknown) => {
      errors.push(String(error));
      if (!res.destroyed) { res.statusCode = 500; res.end(); }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    turns, localBodies, errors, arrivals, uploads, uploadURLs, models, modelQueries, historyRequests, historyControl,
    admit(turn: Turn, text: string) {
      turn.response.writeHead(200, {
        "content-type": "text/event-stream",
        "x-conversation-id": conversationID, "x-message-id": assistantID,
      });
      turn.response.flushHeaders();
      turn.response.write(textFrame(text));
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ route, method, body }) => {
    const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(
      `cortex://local${route}`, {
        method, headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error(`${method} ${route}: ${response.status}`);
    return response.json();
  }, { route, method, body });
}
async function show(page: Page, route: string) {
  await page.evaluate((route) => history.pushState(null, "", `#/${route}`), route);
}
const modelTrigger = (page: Page) => page.getByTestId("remote-model-trigger");
const modelOption = (page: Page, slug: string) => page.locator(`[data-testid="remote-model-option"][data-value="${slug}"]`);
async function openModels(page: Page) {
  await modelTrigger(page).click();
  await expect(page.getByRole("menu")).toBeVisible();
}
async function choose(page: Page, slug: string) {
  await openModels(page);
  await modelOption(page, slug).click();
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(modelTrigger(page)).toHaveAttribute("data-value", slug);
}
async function signIn(page: Page, origin: string) {
  await call(page, "/api/connection", "PUT", { mode: "selfhost", url: origin, signedIn: false });
  const { owner } = await call<RemoteAuthState>(page, "/api/connection/auth");
  expect(owner).not.toBeNull();
  const pending = await call<RemoteAuthState>(page, "/api/connection/auth", "POST", { action: "email", owner, email: "chat@example.test" });
  const state = await call<RemoteAuthState>(page, "/api/connection/auth", "POST", {
    action: "code", owner: pending.owner, code: "123456",
  });
  expect(state.signedIn).toBe(true);
}
async function prepare(page: Page, draft: string) {
  const trigger = modelTrigger(page);
  await expect(trigger).toBeEnabled();
  // A new chat preselects the first discovered model.
  await expect(trigger).toHaveAttribute("data-value", "fixture");
  await openModels(page);
  await page.locator('[data-testid="remote-effort-option"][data-value="high"]').click();
  await page.keyboard.press("Escape");
  await expect(trigger).toContainText(chatCopy["remote.effort.high"]);
  await page.getByTestId("composer-input").fill(draft);
}
async function routedSession(page: Page) {
  await expect(page).toHaveURL(/#\/chat\?/);
  const params = new URLSearchParams(new URL(page.url()).hash.split("?")[1]);
  expect(params.get("source")).toBe("remote");
  expect(params.get("epoch")).toBeTruthy();
  expect(params.get("id")).toBeTruthy();
  const session = await call<RemoteSessionView>(page, `/api/remote/sessions/${params.get("id")}`);
  expect(session).toMatchObject({
    source: "remote", scope: "process", epoch: params.get("epoch"), id: params.get("id"),
    conversationID, modelSlug: "fixture", effort: "high",
  });
  return session;
}
async function prepareRecorded(page: Page, draft: string) {
  await expect(page.getByTestId("composer-input")).toBeEditable();
  const { epoch } = await call<{ epoch: string }>(page, "/api/remote/models");
  const session = await call<RemoteSessionView>(page, "/api/remote/sessions", "POST", {
    epoch, modelSlug: "fixture", effort: "high",
  });
  await show(page, `chat?source=remote&epoch=${epoch}&id=${session.id}`);
  await page.getByTestId("composer-input").fill(draft);
  const oneOff = modelTrigger(page);
  await expect(oneOff).toBeEnabled();
  await expect(oneOff).toHaveAttribute("data-value", "");
  return { session, oneOff };
}
async function settled(page: Page, id: string) {
  await expect(page.getByRole("status").filter({
    hasText: chatCopy["remote.state.settled"],
  })).toBeVisible();
  const session = await call<RemoteSessionView>(page, `/api/remote/sessions/${id}`);
  expect(session).toMatchObject({
    state: "settled", outcome: { finishReason: "stop" },
  });
  await expect(page.getByTestId("remote-session-note")).toBeVisible();
}

const test = base.extend<{ chat: { page: Page; app: Awaited<ReturnType<typeof launch>>["app"]; backend: Awaited<ReturnType<typeof backend>> } }>({
  chat: async ({}, use) => {
    const remote = await backend();
    let app: Awaited<ReturnType<typeof launch>>["app"] | undefined;
    const errors: string[] = [], rendererHttp: string[] = [];
    try {
      const launched = await launch({
        hash: "#/settings?section=connection", locale: "en",
        env: {
          CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify({ fake: catalog.fake }))}`,
          CORTEX_TEST_PROVIDER_BASEURL: "",
        },
      });
      app = launched.app;
      const page = launched.page;
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => { if (/^https?:/.test(request.url())) rendererHttp.push(request.url()); });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await signIn(page, remote.origin);
      await show(page, "home");
      await use({ page, app, backend: remote });
      expect(errors).toEqual([]);
      expect(rendererHttp).toEqual([]);
      expect(remote.errors).toEqual([]);
    } finally {
      try { await app?.close(); } finally { await remote.close(); }
    }
  },
});
test.setTimeout(30_000);

test("opaque reset keeps draft and retained history in the built Electron app", async ({ chat: { page, backend, app } }) => {
  await prepare(page, "Original reset request");
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  turn.response.writeHead(200, { "content-type": "text/event-stream", "x-conversation-id": conversationID, "x-message-id": assistantID });
  turn.response.write(frame("9007199254740993-18446744073709551613", { type: "text_delta", message_id: assistantID, delta: "initial" }));
  await expect(page.getByTestId("assistant-text")).toHaveText("initial");
  const session = await routedSession(page);
  turn.response.end(frame("", { type: "text_delta", message_id: assistantID, delta: "A" }) + frame("", { type: "text_delta", message_id: assistantID, delta: "B" }));
  await expect(page.getByRole("status").filter({ hasText: chatCopy["remote.state.history_required"] })).toBeVisible();
  await expect(page.getByTestId("assistant-text")).toHaveText("initialAB");
  await expect(page.getByRole("button", { name: chatCopy["remote.resume"], exact: true })).toHaveCount(0);
  const draft = "  Keep next draft\nexactly  ";
  await page.getByTestId("composer-input").fill(draft);
  await page.getByRole("button", { name: chatCopy["remote.loadHistory"], exact: true }).click();
  const history = page.getByRole("region", { name: chatCopy["remote.knownHistory"], exact: true });
  await expect(history.locator("article")).toHaveCount(2);
  await history.getByText(`${chatCopy["remote.historyPart.reasoning"]} - ${chatCopy["remote.retention.retained"]}`, { exact: true }).click();
  await expect(history.getByText("Retained reasoning", { exact: true })).toBeVisible();
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  expect(backend.turns).toHaveLength(1);
  expect(backend.historyRequests).toHaveLength(2);
  for (const width of [960, 1440]) for (const theme of ["light", "dark"]) {
    await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, width === 960 ? 640 : 900), width);
    await page.evaluate((theme) => { localStorage.setItem("cortex.theme", theme); document.documentElement.dataset.theme = theme; }, theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.omo/native-chat/reset-history-${width}-${theme}.png` });
  }
  expect((await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).state).toBe("settled");
});

test("explicit incomplete stop remains visible without success in built Electron", async ({ chat: { page, backend } }) => {
  await prepare(page, "Incomplete terminal request");
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  turn.response.writeHead(200, { "content-type": "text/event-stream", "x-conversation-id": conversationID, "x-message-id": assistantID });
  turn.response.end(frame("18446744073709551615-18446744073709551615", { type: "done", message_id: assistantID, finish_reason: "stop", outcome: "incomplete", termination_reason: "contradictory_terminal" }));
  await expect(page.getByRole("status").filter({ hasText: "Response not complete: incomplete. Reason: contradictory_terminal." })).toBeVisible();
  const session = await routedSession(page);
  expect((await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).outcome).toMatchObject({ complete: false, terminalOutcome: "incomplete", terminationReason: "contradictory_terminal" });
  expect(backend.turns).toHaveLength(1);
  await page.screenshot({ path: ".omo/native-chat/incomplete-terminal.png" });
});

test("remote Home admits selected model and effort only after backend headers", async ({ chat: { page, backend } }) => {
  await prepare(page, "  Remote admission request  ");
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  expect(turn.path).toBe(turnPath);
  expect(JSON.parse(turn.raw)).toEqual({
    message: "Remote admission request", model_slug: "fixture", reasoning_effort: "high", attachment_ids: [],
  });
  expect(turn.headers.authorization).toBe("Bearer test-only-chat-token");
  await expect(page.getByTestId("composer-input")).toHaveValue("  Remote admission request  ");
  backend.admit(turn, "Remote streamed answer");
  await expect(page.getByTestId("assistant-text")).toHaveText("Remote streamed answer");
  const session = await routedSession(page);
  await expect(page.getByTestId("composer-input")).toHaveValue("");
  await expect(page.getByRole("button", { name: /detach/i })).toBeVisible();
  turn.response.end(doneFrame());
  await settled(page, session.id);
  const messages = await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`);
  expect(messages).toHaveLength(2);
  expect(messages[0]).toMatchObject({ role: "user", parts: [expect.objectContaining({ type: "text", text: "Remote admission request" })] });
  expect(messages[1]).toMatchObject({ role: "assistant", remoteID: assistantID, partial: true, finishReason: "stop" });
  expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
  expect(backend.turns).toHaveLength(1);
  const recents = page.getByTestId("sidebar-remote-recents");
  await expect(recents).toContainText(session.title);
  await show(page, "history");
  const remoteHistory = page.locator("section").filter({ has: page.getByRole("heading", { name: chatCopy["remote.recents"], exact: true }) });
  const row = remoteHistory.getByRole("button").filter({ hasText: session.title });
  await expect(row).toBeVisible();
  await expect(row.locator("button")).toHaveCount(0);
  await row.focus(); await row.press("Enter");
  expect((await routedSession(page)).id).toBe(session.id);
  await call(page, "/api/connection/auth", "POST", { action: "logout" });
  await expect(recents).toHaveCount(0);
  await expect(page.getByTestId("assistant-text")).toHaveCount(0);
});

test("M1 historical-image refusal carries the exact next draft into a fresh remote record", async ({ chat: { page, app, backend } }) => {
  await prepare(page, "Original image conversation");
  await page.getByTestId("attach-input").setInputFiles({
    name: "original.png", mimeType: "image/png", buffer: png,
  });
  await page.getByTestId("composer-send").click();
  const first = await backend.arrivals[0].promise;
  backend.admit(first, "Original image answer");
  await expect(page.getByTestId("assistant-text")).toHaveText("Original image answer");
  const original = await routedSession(page);
  first.response.end(doneFrame());
  await settled(page, original.id);
  const originalRecord = await call<RemoteSessionView>(page, `/api/remote/sessions/${original.id}`);
  const originalMessages = await call<RemoteMessageView[]>(page, `/api/remote/sessions/${original.id}/messages`);
  expect(originalMessages[0].parts).toContainEqual(expect.objectContaining({
    type: "file", file: expect.objectContaining({ id: fileID, filename: "original.png" }),
  }));

  const draft = "  Carry this next draft\nwithout losing whitespace  ";
  await page.getByTestId("composer-input").fill(draft);
  const oneOff = modelTrigger(page);
  await choose(page, "fixture-next");
  await page.getByTestId("attach-input").setInputFiles({
    name: "next.png", mimeType: "image/png", buffer: png,
  });
  await expect(page.getByTestId("composer-send")).toBeDisabled();
  await expect(page.getByText(chatCopy["remote.historyImages"], { exact: true })).toBeVisible();
  await page.locator(".chat-box .chat-attach").getByRole("button").click();
  await expect(page.locator(".chat-box .chat-attach")).toHaveCount(0);
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(oneOff).toHaveAttribute("data-value", "fixture-next");
  await expect(page.getByTestId("composer-send")).toBeDisabled();
  await expect(page.getByText(chatCopy["remote.historyImages"], { exact: true })).toBeVisible();
  // Enter exercises the form guard independently of the disabled Send button.
  await page.getByTestId("composer-input").press("Enter");
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  expect(backend.turns).toHaveLength(1);
  expect(backend.uploads).toHaveLength(1);
  await page.getByTestId("attach-input").setInputFiles({
    name: "next.png", mimeType: "image/png", buffer: png,
  });
  await expect(page.locator(".chat-box .chat-attach")).toContainText("next.png");
  const gate = await app.evaluateHandle(({ ipcMain }) => {
    type WireRequest = { method: string; url: string; headers: [string, string][]; body?: string };
    type WireResponse = { status: number; headers: [string, string][]; body: string };
    const original = (ipcMain as unknown as {
      _invokeHandlers: Map<string, (event: unknown, request: WireRequest) => Promise<WireResponse>>;
    })._invokeHandlers.get("cortex:fetch");
    if (!original) throw new Error("Missing cortex:fetch handler");
    let target: string | undefined;
    let release!: () => void, observed!: () => void;
    let released = false;
    const reads = new Set<string>();
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const held = new Promise<void>((resolve) => { observed = resolve; });
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
      const path = new URL(request.url).pathname;
      const response = await original(event, request);
      if (request.method === "POST" && path === "/api/remote/sessions" && response.status < 300) {
        target = `/api/remote/sessions/${(JSON.parse(response.body) as { id: string }).id}`;
      }
      if (!released && target && request.method === "GET"
        && (path === target || path === `${target}/messages`)) {
        reads.add(path);
        if (reads.size === 2) observed();
        // Delay delivery only: preserve the real engine's response unchanged.
        await blocked;
      }
      return response;
    });
    return {
      async wait() {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            held,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("Destination IPC reads were not observed")), 10_000);
            }),
          ]);
        } finally { clearTimeout(timer); }
      },
      release() { released = true; release(); },
      restore() {
        released = true; release();
        ipcMain.removeHandler("cortex:fetch");
        ipcMain.handle("cortex:fetch", original);
      },
    };
  });
  try {
    // Register the signal before triggering the owned new-chat handoff.
    await Promise.all([
      gate.evaluate((gate) => gate.wait()),
      page.getByRole("button", { name: chatCopy["remote.newChatWithDraft"], exact: true }).click(),
    ]);
    const destination = new URLSearchParams(new URL(page.url()).hash.split("?")[1]);
    expect(destination.get("id")).toBeTruthy();
    expect(destination.get("id")).not.toBe(original.id);
    const input = page.getByTestId("composer-input");
    await expect(input).toBeDisabled();
    expect(await input.inputValue()).toBe("");
    // Bypass native disabled-input protection to exercise the mutation fence too.
    const value = await input.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (!setter) throw new Error("Missing native textarea value setter");
      setter.call(textarea, "Must not replace the transferred draft");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      return textarea.value;
    });
    expect(value).toBe("");
    await expect(input).toBeDisabled();
    await gate.evaluate((gate) => gate.release());
    await expect(input).toBeEditable();
    await expect(input).toHaveValue(draft);
    await expect(page.locator(".chat-box .chat-attach")).toContainText("next.png");
    await expect(oneOff).toHaveAttribute("data-value", "fixture-next");
  } finally {
    await gate.evaluate((gate) => gate.restore());
    await gate.dispose();
  }
  await expect(page.getByTestId("composer-send")).toBeEnabled();
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(page.locator(".chat-box .chat-attach")).toContainText("next.png");
  await expect(oneOff).toHaveAttribute("data-value", "fixture-next");
  await expect(page.getByTestId("assistant-text")).toHaveCount(0);

  const params = new URLSearchParams(new URL(page.url()).hash.split("?")[1]);
  const freshID = params.get("id");
  expect(freshID).toBeTruthy();
  expect(freshID).not.toBe(original.id);
  expect(params.get("source")).toBe("remote");
  expect(params.get("epoch")).toBe(original.epoch);
  const fresh = await call<RemoteSessionView>(page, `/api/remote/sessions/${freshID}`);
  expect(fresh).toMatchObject({
    id: freshID, epoch: original.epoch, state: "ready", modelSlug: "fixture", effort: "high",
  });
  expect(fresh.conversationID).toBeUndefined();
  expect(await call<RemoteMessageView[]>(page, `/api/remote/sessions/${freshID}/messages`)).toEqual([]);

  await page.getByTestId("composer-send").click();
  const second = await backend.arrivals[1].promise;
  expect(second.path).toBe(turnPath);
  expect(JSON.parse(second.raw)).toEqual({
    message: draft.trim(), model_slug: "fixture", one_off_model_slug: "fixture-next", reasoning_effort: "high", attachment_ids: [nextFileID],
  });
  expect(second.headers["idempotency-key"]).not.toBe(first.headers["idempotency-key"]);
  expect(second.headers["last-event-id"]).toBeUndefined();
  expect(backend.uploads).toEqual([
    { bytes: png, filename: "original.png" },
    { bytes: png, filename: "next.png" },
  ]);
  expect(new URL(backend.uploadURLs[1]).searchParams.has("conversation_id")).toBe(false);
  second.response.writeHead(200, {
    "content-type": "text/event-stream",
    "x-conversation-id": nextConversationID, "x-message-id": nextAssistantID,
  });
  second.response.end(
    frame(1, { type: "text_delta", message_id: nextAssistantID, delta: "Fresh conversation answer" })
    + frame(2, { type: "done", message_id: nextAssistantID, finish_reason: "stop" }),
  );
  await settled(page, fresh.id);
  await expect(page.getByTestId("composer-input")).toHaveValue("");
  await expect(page.getByTestId("assistant-text")).toHaveText("Fresh conversation answer");
  expect(await call<RemoteSessionView>(page, `/api/remote/sessions/${original.id}`)).toEqual(originalRecord);
  expect(await call<RemoteMessageView[]>(page, `/api/remote/sessions/${original.id}/messages`)).toEqual(originalMessages);
  expect(await call<RemoteSessionView>(page, `/api/remote/sessions/${fresh.id}`)).toMatchObject({
    conversationID: nextConversationID, modelSlug: "fixture", effort: "high",
  });
  expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
  expect(backend.turns).toHaveLength(2);

  await page.reload();
  await expect(page.getByTestId("assistant-text")).toHaveText("Fresh conversation answer");
  await expect(page.getByTestId("composer-input")).toHaveValue("");
  expect(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("id")).toBe(fresh.id);
});

test("an existing local Chat stays local with a signed-in remote connection", async ({ chat: { page, backend } }) => {
  await call(page, "/api/providers/fake", "PATCH", { enabled: true, baseURL: `${backend.origin}/v1` });
  await call(page, "/api/providers/fake/key", "PUT", { key: "sk-test-local-chat" });
  const session = await call<Session>(page, "/api/sessions", "POST", {
    kind: "chat", title: "Local conversation", model: { providerID: "fake", modelID: "reasoner" },
  });
  await show(page, `chat?id=${session.id}`);
  await page.getByTestId("composer-input").fill("Keep this request local");
  await page.getByTestId("composer-send").click();
  await expect(page.getByTestId("assistant-text")).toHaveText("Local fixture answer");
  expect(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("source")).toBeNull();
  expect(backend.localBodies).toHaveLength(1);
  expect(backend.localBodies[0].model).toBe("reasoner");
  expect(JSON.stringify(backend.localBodies[0].messages)).toContain("Keep this request local");
  expect(backend.turns).toEqual([]);
  expect(await call<RemoteSessionView[]>(page, "/api/remote/sessions")).toEqual([]);
  expect(await call<Session>(page, `/api/sessions/${session.id}`)).toMatchObject({
    id: session.id, model: { providerID: "fake", modelID: "reasoner" },
  });
});

test("header-held refusal preserves the exact draft without admitting messages", async ({ chat: { page, backend } }) => {
  const draft = "  Preserve this refused draft\nincluding whitespace  ";
  await prepare(page, draft);
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(page.getByTestId("composer-input")).toBeDisabled();
  await expect(page).toHaveURL(/#\/home(?:\?|$)/);
  const [session] = await call<RemoteSessionView[]>(page, "/api/remote/sessions");
  expect(session.state).toBe("admitting");
  expect(session.conversationID).toBeUndefined();
  expect(await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`)).toEqual([]);
  turn.response.writeHead(400, { "content-type": "application/problem+json" });
  turn.response.end(JSON.stringify({
    type: "about:blank", title: "Fixture refusal", status: 400, code: "invalid_request",
    detail: "test-only-private-refusal", request_id: "req_test_chat",
  }));
  await expect(page.getByTestId("composer-input")).toBeEditable();
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(page.locator(".chat-err[role=alert]")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("test-only-private-refusal");
  await expect(page).toHaveURL(/#\/home(?:\?|$)/);
  expect(await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`)).toEqual([]);
  expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
  expect(backend.turns).toHaveLength(1);
});

test("detach and resume replay the original one-off, then an ordinary turn uses the recorded model", async ({ chat: { page, backend } }) => {
  const { oneOff } = await prepareRecorded(page, "Original remote request");
  await choose(page, "fixture-next");
  await page.getByTestId("composer-send").click();
  const first = await backend.arrivals[0].promise;
  expect(JSON.parse(first.raw)).toEqual({
    message: "Original remote request", model_slug: "fixture", reasoning_effort: "high",
    attachment_ids: [], one_off_model_slug: "fixture-next",
  });
  backend.admit(first, "Before detach");
  await expect(page.getByTestId("assistant-text")).toHaveText("Before detach");
  const session = await routedSession(page);
  await page.getByRole("button", { name: /detach/i }).click();
  await expect(page.getByRole("button", { name: /resume/i })).toBeVisible();
  expect(await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).toMatchObject({ state: "detached" });
  await page.getByTestId("composer-input").fill("A different unsent draft");
  await page.getByRole("button", { name: /resume/i }).click();
  const replay = await backend.arrivals[1].promise;
  expect(replay.path).toBe(turnPath);
  expect(replay.path).toBe(first.path);
  expect(replay.raw).toBe(first.raw);
  expect(first.headers["idempotency-key"]).toMatch(/^[\da-f-]{36}$/i);
  expect(replay.headers["idempotency-key"]).toBe(first.headers["idempotency-key"]);
  expect(replay.headers["last-event-id"]).toBe(cursor(7));
  replay.response.writeHead(200, {
    "content-type": "text/event-stream",
    "x-conversation-id": conversationID, "x-message-id": assistantID,
  });
  replay.response.flushHeaders();
  replay.response.write(frame(8, { type: "text_delta", message_id: assistantID, delta: " after resume" }));
  await expect(page.getByTestId("assistant-text").filter({ hasText: "after resume" })).toBeVisible();
  await expect(page.getByRole("button", { name: /detach/i })).toBeVisible();
  replay.response.end(frame(9, { type: "done", message_id: assistantID, finish_reason: "stop" }));
  await settled(page, session.id);
  await expect(page.getByTestId("composer-input")).toHaveValue("A different unsent draft");
  await expect(oneOff).toHaveAttribute("data-value", "");
  const messages = await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`);
  expect(messages).toHaveLength(2);
  expect(messages[0]).toMatchObject({
    role: "user", parts: [expect.objectContaining({ type: "text", text: "Original remote request" })],
  });
  expect(backend.turns).toHaveLength(2);
  await page.getByTestId("composer-send").click();
  const ordinary = await backend.arrivals[2].promise;
  expect(ordinary.path).toBe(`/v1/conversations/${conversationID}/turns`);
  expect(JSON.parse(ordinary.raw)).toEqual({
    message: "A different unsent draft", model_slug: "fixture", reasoning_effort: "high", attachment_ids: [],
  });
  expect(ordinary.headers["idempotency-key"]).not.toBe(first.headers["idempotency-key"]);
  expect(ordinary.headers["last-event-id"]).toBeUndefined();
  ordinary.response.writeHead(200, {
    "content-type": "text/event-stream",
    "x-conversation-id": conversationID, "x-message-id": nextAssistantID,
  });
  ordinary.response.end(
    frame(1, { type: "text_delta", message_id: nextAssistantID, delta: "Ordinary answer" })
    + frame(2, { type: "done", message_id: nextAssistantID, finish_reason: "stop" }),
  );
  await expect(page.getByTestId("assistant-text").filter({ hasText: "Ordinary answer" })).toBeVisible();
  await settled(page, session.id);
  await expect(page.getByTestId("composer-input")).toHaveValue("");
  expect(await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).toMatchObject({
    modelSlug: "fixture", effort: "high",
  });
  expect(backend.turns).toHaveLength(3);
});

for (const slug of ["fixture-no-image", "fixture-unknown"]) {
  test(`${slug} preserves the image, exact draft and selection without sending`, async ({ chat: { page, backend } }) => {
    const draft = "  Keep this image request\nexactly  ";
    const { session, oneOff } = await prepareRecorded(page, draft);
    const discovered = await call<{
      models: { slug: string; vision: boolean | "unknown"; reasoning: boolean | "unknown"; tools: boolean | "unknown" }[];
    }>(page, "/api/remote/models");
    expect(discovered.models.find((model) => model.slug === slug)).toMatchObject({
      slug,
      ...(slug === "fixture-unknown"
        ? { vision: "unknown", reasoning: "unknown", tools: "unknown" }
        : { vision: false, reasoning: true, tools: true }),
    });
    await page.getByTestId("attach-input").setInputFiles({
      name: "retained.png", mimeType: "image/png", buffer: png,
    });
    await choose(page, slug);
    await expect(oneOff).toHaveAttribute("data-value", slug);
    await expect(page.getByText(chatCopy["remote.imageUnsupported"], { exact: true })).toBeVisible();
    await expect(page.getByTestId("composer-send")).toBeDisabled();
    await page.getByTestId("composer-input").press("Enter");
    await expect(page.getByTestId("composer-input")).toHaveValue(draft);
    await expect(page.locator(".chat-box .chat-attach")).toContainText("retained.png");
    await expect(oneOff).toHaveAttribute("data-value", slug);
    expect(backend.uploads).toEqual([]);
    expect(backend.turns).toEqual([]);
    expect(await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`)).toEqual([]);

    // Explicitly selecting a compatible model must send the retained bytes.
    await choose(page, "fixture-next");
    await page.getByTestId("composer-send").click();
    const turn = await backend.arrivals[0].promise;
    expect(JSON.parse(turn.raw)).toEqual({
      message: draft.trim(), model_slug: "fixture", reasoning_effort: "high",
      attachment_ids: [fileID], one_off_model_slug: "fixture-next",
    });
    expect(backend.uploads).toEqual([{ bytes: png, filename: "retained.png" }]);
    backend.admit(turn, "Compatible image answer");
    turn.response.end(doneFrame());
    await settled(page, session.id);
    await expect(page.getByTestId("composer-input")).toHaveValue("");
    await expect(page.locator(".chat-box .chat-attach")).toHaveCount(0);
  });
}

test("disabled registry entries cannot be selected in Home or recorded Chat", async ({ chat: { page, backend } }) => {
  await prepare(page, "Keep the configured selection");
  const model = modelTrigger(page);
  await openModels(page);
  await expect(modelOption(page, "fixture-disabled")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await choose(page, "fixture-unknown");
  await expect(model).toHaveAttribute("data-value", "fixture-unknown");
  const { oneOff } = await prepareRecorded(page, "Recorded selection");
  await openModels(page);
  await expect(modelOption(page, "fixture-disabled")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await choose(page, "fixture-unknown");
  await expect(oneOff).toHaveAttribute("data-value", "fixture-unknown");
  expect(backend.modelQueries.length).toBeGreaterThan(0);
  expect(backend.modelQueries.every((query) => new URLSearchParams(query).get("configured") === "true")).toBe(true);
  expect(backend.turns).toEqual([]);
  expect(backend.uploads).toEqual([]);
});

test("reopening a Chat whose recorded model disappeared never selects a fallback", async ({ chat: { page, backend } }) => {
  await prepare(page, "Recorded model conversation");
  await page.getByTestId("composer-send").click();
  const first = await backend.arrivals[0].promise;
  backend.admit(first, "Recorded answer");
  const session = await routedSession(page);
  first.response.end(doneFrame());
  await settled(page, session.id);
  await show(page, "history");
  const history = page.locator("section").filter({
    has: page.getByRole("heading", { name: chatCopy["remote.recents"], exact: true }),
  });
  const row = history.getByRole("button").filter({ hasText: session.title });
  await expect(row).toBeVisible();
  const index = backend.models.findIndex((model) => model.id === "fixture");
  expect(index).toBeGreaterThanOrEqual(0);
  backend.models.splice(index, 1);
  await row.click();
  await expect(page.getByText(chatCopy["remote.modelUnavailable"], { exact: true })).toBeVisible();
  const draft = "  Do not substitute another model  ";
  await page.getByTestId("composer-input").fill(draft);
  const oneOff = modelTrigger(page);
  await expect(oneOff).toHaveAttribute("data-value", "");
  await openModels(page);
  await expect(modelOption(page, "fixture")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await choose(page, "fixture-next");
  await expect(page.getByTestId("composer-send")).toBeDisabled();
  await page.getByTestId("composer-input").press("Enter");
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(oneOff).toHaveAttribute("data-value", "fixture-next");
  expect(await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).toMatchObject({
    modelSlug: "fixture", effort: "high", conversationID,
  });
  expect(backend.turns).toHaveLength(1);
  expect(backend.uploads).toEqual([]);
});

test("missing admission headers retain exact text, image and one-off without admitting messages", async ({ chat: { page, backend } }) => {
  const draft = "  Preserve ambiguous admission\nwith whitespace  ";
  const { session, oneOff } = await prepareRecorded(page, draft);
  await choose(page, "fixture-next");
  await page.getByTestId("attach-input").setInputFiles({
    name: "ambiguous.png", mimeType: "image/png", buffer: png,
  });
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  expect(JSON.parse(turn.raw)).toEqual({
    message: draft.trim(), model_slug: "fixture", reasoning_effort: "high",
    attachment_ids: [fileID], one_off_model_slug: "fixture-next",
  });
  turn.response.writeHead(200, { "content-type": "text/event-stream" });
  turn.response.end(textFrame("Must not be admitted") + doneFrame());
  await expect(page.getByRole("status").filter({ hasText: chatCopy["remote.state.uncertain"] })).toBeVisible();
  await expect(page.getByTestId("composer-input")).toBeEditable();
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(page.locator(".chat-box .chat-attach")).toContainText("ambiguous.png");
  await expect(oneOff).toHaveAttribute("data-value", "fixture-next");
  await expect(page.getByTestId("assistant-text")).toHaveCount(0);
  await expect(page.getByTestId("composer-send")).toBeDisabled();
  await expect(page.getByRole("button", { name: chatCopy["remote.resume"], exact: true })).toBeEnabled();
  expect(await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).toMatchObject({
    state: "uncertain", modelSlug: "fixture", effort: "high",
  });
  expect((await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).conversationID).toBeUndefined();
  expect(await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`)).toEqual([]);
  expect(backend.uploads).toEqual([{ bytes: png, filename: "ambiguous.png" }]);
  expect(backend.turns).toHaveLength(1);
});

test("keyboard model picker retains focus, exact draft, image and model selections", async ({ chat: { page, backend } }) => {
  const draft = "  Keyboard draft\nkeep every character  ";
  await prepare(page, draft);
  await page.getByTestId("attach-input").setInputFiles({
    name: "keyboard.png", mimeType: "image/png", buffer: png,
  });
  const trigger = modelTrigger(page);
  await trigger.focus();
  for (const key of ["Enter", "Space"]) {
    await trigger.press(key);
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(modelOption(page, "fixture")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId("composer-input")).toHaveValue(draft);
    await expect(page.locator(".chat-box .chat-attach")).toContainText("keyboard.png");
    await expect(trigger).toHaveAttribute("data-value", "fixture");
    await expect(trigger).toContainText(chatCopy["remote.effort.high"]);
  }
  expect(backend.uploads).toEqual([]);
  expect(backend.turns).toEqual([]);
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  expect(JSON.parse(turn.raw)).toEqual({
    message: draft.trim(), model_slug: "fixture", reasoning_effort: "high", attachment_ids: [fileID],
  });
  expect(backend.uploads).toEqual([{ bytes: png, filename: "keyboard.png" }]);
  backend.admit(turn, "Keyboard-preserved image answer");
  const session = await routedSession(page);
  turn.response.end(doneFrame());
  await settled(page, session.id);
});

test("new chat shows an empty state and a header model picker that sends at once", async ({ chat: { page, backend } }) => {
  await expect(page.getByRole("heading", { name: chatCopy["home.title"], exact: true })).toBeVisible();
  for (const hidden of ["remote.limited", "remote.options", "remote.detachNote"]) {
    expect(chatCopy).not.toHaveProperty(hidden);
  }
  await expect(page.locator(".chat-box details")).toHaveCount(0);
  const trigger = modelTrigger(page);
  await expect(trigger).toHaveText(/Cortex Fixture/);
  await expect(trigger).toHaveAccessibleName(chatCopy["remote.modelTrigger"].replace("{model}", "Cortex Fixture"));
  await trigger.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const options = page.getByTestId("remote-model-option");
  await expect(options).toHaveText([/Cortex Fixture/, /Cortex Next Fixture/, /Cortex Text Fixture/, /Cortex Unknown Fixture/]);
  await expect(modelOption(page, "fixture")).toHaveAttribute("aria-checked", "true");
  await expect(modelOption(page, "fixture-no-image")).toContainText(chatCopy["model.reasoning"]);
  await expect(modelOption(page, "fixture-no-image")).not.toContainText(chatCopy["model.image"]);
  await expect(page.getByTestId("remote-effort-option")).toHaveCount(3);
  await expect(page.locator('[data-testid="remote-effort-option"][data-value="medium"]')).toHaveAttribute("aria-checked", "true");
  // Arrow keys move between models; Enter selects and closes.
  await expect(modelOption(page, "fixture")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(modelOption(page, "fixture-next")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("data-value", "fixture-next");
  // A model without reasoning hides the effort control.
  await choose(page, "fixture-unknown");
  await expect(trigger).not.toContainText(chatCopy["remote.effort.medium"]);
  await openModels(page);
  await expect(page.getByTestId("remote-effort-option")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await choose(page, "fixture");
  const suggestion = page.locator(".remote-empty .suggestion").first();
  await suggestion.click();
  await expect(page.getByTestId("composer-input")).toHaveValue(chatCopy["remote.suggest.summary"]);
  await expect(page.getByTestId("composer-send")).toBeEnabled();
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  expect(JSON.parse(turn.raw)).toEqual({
    message: chatCopy["remote.suggest.summary"], model_slug: "fixture", reasoning_effort: "medium", attachment_ids: [],
  });
  backend.admit(turn, "Five key points.");
  const session = await call<RemoteSessionView[]>(page, "/api/remote/sessions");
  turn.response.end(doneFrame());
  await settled(page, session[0].id);
  await expect(page.locator(".content-top .remote-chat-title")).toBeVisible();
  await expect(page.locator(".remote-empty")).toHaveCount(0);
});

// Hold the same route callback as navigation.spec.ts, then traverse back to the
// original entry before releasing it. Observe the real connection recheck rather
// than replacing its result or waiting an arbitrary amount of time.
async function awayAndBack(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const input = await page.getByTestId("composer-input").elementHandle();
  if (!input) throw new Error("Missing outgoing composer");
  const probe = await page.evaluateHandle(() => {
    const navigation = (window as unknown as {
      navigation: EventTarget & { currentEntry: { key: string } };
    }).navigation;
    const originalKey = navigation.currentEntry.key, originalHash = location.hash;
    const start = document.startViewTransition, json = Response.prototype.json;
    let release: (() => void) | undefined, returned = false;
    let connectionRead!: () => void;
    const rechecked = new Promise<void>((resolve) => { connectionRead = resolve; });
    Response.prototype.json = async function () {
      const value: unknown = await json.call(this);
      if (returned && value && typeof value === "object" && "mode" in value && "signedIn" in value) connectionRead();
      return value;
    };
    document.startViewTransition = (update) => {
      document.startViewTransition = start;
      const done = new Promise<void>((resolve) => { release = resolve; })
        .then(() => typeof update === "function" ? update() : update?.update?.());
      return { finished: done, ready: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} };
    };
    return {
      originalHash,
      async back() {
        const arrived = new Promise<void>((resolve) => {
          const listener = () => {
            if (navigation.currentEntry.key !== originalKey) return;
            returned = true;
            navigation.removeEventListener("currententrychange", listener);
            resolve();
          };
          navigation.addEventListener("currententrychange", listener);
        });
        history.back();
        await arrived;
        await rechecked;
        // Allow the observed connection continuation and React's render to commit.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
      async finish() {
        if (!release) throw new Error("Route update was not held");
        release();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
      restore() {
        document.startViewTransition = start;
        Response.prototype.json = json;
      },
    };
  });
  try {
    await show(page, "settings?section=connection");
    await expect(page).toHaveURL(/#\/settings\?section=connection$/);
    expect(await input.evaluate((element) => element.isConnected)).toBe(true);
    // Back commits immediately; the outbound route callback remains held.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await probe.evaluate((probe) => probe.back());
    expect(await input.evaluate((element) => element.isConnected)).toBe(true);
    await probe.evaluate((probe) => probe.finish());
    expect(await input.evaluate((element) => element.isConnected)).toBe(true);
    expect(new URL(page.url()).hash).toBe(await probe.evaluate((probe) => probe.originalHash));
  } finally {
    await probe.evaluate((probe) => probe.restore());
    await probe.dispose();
    await input.dispose();
  }
}

test("H1 local Home retains its exact draft, image and model across a cancelled departure", async ({ chat: { page, backend } }) => {
  await call(page, "/api/providers/fake", "PATCH", { enabled: true, baseURL: `${backend.origin}/v1` });
  await call(page, "/api/providers/fake/key", "PUT", { key: "sk-test-local-chat" });
  await call(page, "/api/connection", "PUT", { mode: "local", signedIn: false });
  await show(page, "settings?section=connection");
  await expect(page.getByTestId("connection-mode-local")).toBeVisible();
  await show(page, "home");
  const draft = "  Keep this local draft\nexactly as entered  ";
  await page.getByTestId("model-trigger").click();
  await page.getByTestId("model-option").filter({ hasText: "Reasoner Large" }).click();
  await page.getByTestId("composer-input").fill(draft);
  await page.getByTestId("attach-input").setInputFiles({ name: "local-retained.png", mimeType: "image/png", buffer: png });
  const attachment = page.locator(".chat-box .chat-att").filter({ hasText: "local-retained.png" });
  await expect(attachment).toBeVisible();
  const image = attachment.locator(".chat-att-img");
  const originalImage = await image.evaluate((element) => (element as HTMLElement).style.backgroundImage);
  expect(originalImage).toContain(png.toString("base64"));
  await awayAndBack(page);
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(page.getByTestId("model-trigger")).toContainText("Reasoner Large");
  await expect(attachment).toBeVisible();
  expect(await image.evaluate((element) => (element as HTMLElement).style.backgroundImage)).toBe(originalImage);
  await page.getByTestId("composer-send").click();
  await expect(page.getByTestId("assistant-text")).toHaveText("Local fixture answer");
  expect(backend.localBodies).toHaveLength(1);
  expect(backend.localBodies[0].model).toBe("reasoner");
  const messages = JSON.stringify(backend.localBodies[0].messages);
  expect(messages).toContain(JSON.stringify(draft.trim()).slice(1, -1));
  expect(messages).toContain(png.toString("base64"));
  expect(backend.turns).toEqual([]);
});

test("H1 header-held remote Home retains its draft, file and recovery owner across a cancelled departure", async ({ chat: { page, backend } }) => {
  const draft = "  Keep this remote draft\nwith its original image  ";
  await prepare(page, draft);
  await page.getByTestId("attach-input").setInputFiles({ name: "remote-retained.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".chat-box .chat-attach")).toContainText("remote-retained.png");
  await page.getByTestId("composer-send").click();
  const first = await backend.arrivals[0].promise;
  expect(backend.uploads).toEqual([{ bytes: png, filename: "remote-retained.png" }]);
  expect(JSON.parse(first.raw)).toEqual({
    message: draft.trim(), model_slug: "fixture", reasoning_effort: "high", attachment_ids: [fileID],
  });
  const [session] = await call<RemoteSessionView[]>(page, "/api/remote/sessions");
  expect(session.state).toBe("admitting");
  await awayAndBack(page);
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(page.locator(".chat-box .chat-attach")).toContainText("remote-retained.png");
  await expect(page.getByRole("button", { name: chatCopy["remote.detach"], exact: true })).toBeEnabled();
  await page.getByRole("button", { name: chatCopy["remote.detach"], exact: true }).click();
  const resume = page.getByRole("button", { name: chatCopy["remote.resume"], exact: true });
  await expect(resume).toBeEnabled();
  await resume.click();
  const replay = await backend.arrivals[1].promise;
  expect(replay.raw).toBe(first.raw);
  expect(replay.path).toBe(first.path);
  expect(replay.headers["idempotency-key"]).toBe(first.headers["idempotency-key"]);
  backend.admit(replay, "Recovered original image request");
  const recovered = await routedSession(page);
  expect(recovered.id).toBe(session.id);
  await expect(page.getByTestId("composer-input")).toHaveValue("");
  await expect(page.locator(".chat-box .chat-attach")).toHaveCount(0);
  await expect(page.getByRole("button", { name: chatCopy["remote.detach"], exact: true })).toBeVisible();
  replay.response.end(doneFrame());
  await settled(page, session.id);
  expect(backend.uploads).toHaveLength(1);
  expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
});

test("H2 header-held Home resume preserves an edited next draft and file without routing", async ({ chat: { page, backend } }) => {
  const original = "Original header-held request";
  await prepare(page, original);
  await page.getByTestId("composer-send").click();
  const first = await backend.arrivals[0].promise;
  const [session] = await call<RemoteSessionView[]>(page, "/api/remote/sessions");
  expect(session.state).toBe("admitting");
  expect(session.conversationID).toBeUndefined();
  await page.getByRole("button", { name: chatCopy["remote.detach"], exact: true }).click();
  const resume = page.getByRole("button", { name: chatCopy["remote.resume"], exact: true });
  await expect(resume).toBeEnabled();
  await expect(page.getByTestId("composer-input")).toBeEditable();
  const next = "  A different next draft\nretain its whitespace  ";
  await page.getByTestId("composer-input").fill(next);
  await page.getByTestId("attach-input").setInputFiles({ name: "next-draft.png", mimeType: "image/png", buffer: png });
  await choose(page, "fixture");
  await expect(page.locator(".chat-box .chat-attach")).toContainText("next-draft.png");
  const route = await page.evaluateHandle(() => {
    const navigation = (window as unknown as {
      navigation: EventTarget & { currentEntry: { key: string } };
    }).navigation;
    const key = navigation.currentEntry.key;
    let changed = false;
    const listener = () => { changed ||= navigation.currentEntry.key !== key; };
    navigation.addEventListener("currententrychange", listener);
    return {
      changed: () => changed,
      dispose: () => navigation.removeEventListener("currententrychange", listener),
    };
  });
  try {
    await resume.click();
    const replay = await backend.arrivals[1].promise;
    expect(JSON.parse(first.raw)).toEqual({
      message: original, model_slug: "fixture", reasoning_effort: "high", attachment_ids: [],
    });
    expect(replay.raw).toBe(first.raw);
    expect(replay.path).toBe(first.path);
    expect(first.headers["idempotency-key"]).toMatch(/^[\da-f-]{36}$/i);
    expect(replay.headers["idempotency-key"]).toBe(first.headers["idempotency-key"]);
    expect(replay.headers["last-event-id"]).toBeUndefined();
    backend.admit(replay, "Original request recovered");
    // Editing becomes available only after Home's resume continuation finishes.
    await expect(page.getByTestId("composer-input")).toBeEditable();
    await expect(page.getByTestId("composer-input")).toHaveValue(next);
    await expect(modelTrigger(page)).toHaveAttribute("data-value", "fixture");
    await expect(page.locator(".chat-box .chat-attach")).toContainText("next-draft.png");
    await expect(page.getByTestId("assistant-text")).toHaveText("Original request recovered");
    await expect(page).toHaveURL(/#\/home(?:\?|$)/);
    expect(await route.evaluate((probe) => probe.changed())).toBe(false);
    replay.response.end(doneFrame());
    await settled(page, session.id);
    await expect(page.getByTestId("composer-input")).toHaveValue(next);
    await expect(page.locator(".chat-box .chat-attach")).toContainText("next-draft.png");
    expect(await route.evaluate((probe) => probe.changed())).toBe(false);
    const messages = await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "user", parts: [expect.objectContaining({ type: "text", text: original })],
    });
    expect(backend.uploads).toEqual([]);
    expect(backend.turns).toHaveLength(2);
    expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
  } finally {
    await route.evaluate((probe) => probe.dispose());
    await route.dispose();
  }
});

async function captureRemoteVisual(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const scrollPositions = await page.evaluateHandle(() =>
    [...document.querySelectorAll<HTMLElement>("main.content, main.content *")]
      .filter((element) => element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)
      .map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft })),
  );
  const geometry = () => page.evaluate(() => {
    const root = document.documentElement;
    // The shared composer surface extends 3px outside its box by design.
    // Measure layout without that decoration; restore it before hit tests/capture.
    const decoration = document.createElement("style");
    decoration.textContent = ".composer::before { content: none !important; }";
    document.head.append(decoration);
    try {
    return {
      windowOverflow: {
        x: root.scrollWidth - innerWidth,
        y: root.scrollHeight - innerHeight,
      },
      horizontalOverflow: [...document.querySelectorAll<HTMLElement>(
        "main.content, .thread, .thread-inner, .dock, .chat-box, .composer, .content-top, .page, .pg-narrow",
      )].filter((element) => element.getClientRects().length)
        .map((element) => ({
          element: element.className || element.tagName,
          overflow: element.scrollWidth - element.clientWidth,
          scrollLeft: element.scrollLeft,
        })),
    };
    } finally { decoration.remove(); }
  });
  const before = await geometry();
  await test.info().attach(`${name}-initial-geometry`, {
    body: JSON.stringify(before, null, 2), contentType: "application/json",
  });
  expect(before.windowOverflow.x).toBeLessThanOrEqual(1);
  expect(before.windowOverflow.y).toBeLessThanOrEqual(1);
  for (const area of before.horizontalOverflow) {
    expect(area.overflow, `${area.element}: horizontal overflow ${JSON.stringify(before)}`).toBeLessThanOrEqual(1);
    expect(area.scrollLeft, `${area.element}: horizontal scroll`).toBe(0);
  }
  const controls = page.locator(
    "main.content button:visible, main.content textarea:visible, main.content select:visible, main.content summary:visible, main.content [role=button]:visible",
  );
  const reachability: { control: string; reachable: boolean }[] = [];
  try {
    for (const control of await controls.all()) {
      // Vertical scrolling is valid; horizontal clipping is checked independently.
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ ratio: 1 });
      const result = await control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return {
          control: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName,
          reachable: !!hit && (hit === element || element.contains(hit)),
        };
      });
      reachability.push(result);
      expect(result.reachable, `${result.control}: unobscured control`).toBe(true);
    }
    const after = await geometry();
    expect(after.windowOverflow.x).toBeLessThanOrEqual(1);
    expect(after.windowOverflow.y).toBeLessThanOrEqual(1);
    for (const area of after.horizontalOverflow) {
      expect(area.overflow, `${area.element}: horizontal overflow after scrolling`).toBeLessThanOrEqual(1);
      expect(area.scrollLeft, `${area.element}: no concealed horizontal clipping`).toBe(0);
    }
    await test.info().attach(`${name}-geometry`, {
      body: JSON.stringify({ before, after, reachability }, null, 2),
      contentType: "application/json",
    });
  } finally {
    await scrollPositions.evaluate((positions) => {
      for (const { element, top, left } of positions) {
        element.scrollTop = top;
        element.scrollLeft = left;
      }
    });
    await scrollPositions.dispose();
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

// Initial English scope: three live states, two native content sizes, two themes.
for (const size of [{ width: 960, height: 640 }, { width: 1280, height: 900 }]) {
  for (const theme of ["light", "dark"] as const) {
    test(`remote live visual capture ${size.width}x${size.height} ${theme}`, async ({ chat: { page, app, backend } }) => {
      test.setTimeout(60_000);
      await page.evaluate((size) => {
        (window as unknown as { remoteResize: Promise<void> }).remoteResize = new Promise((resolve) => {
          if (innerWidth === size.width && innerHeight === size.height) { resolve(); return; }
          window.addEventListener("resize", () => resolve(), { once: true });
        });
      }, size);
      await app.evaluate(({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height);
      }, size);
      await page.evaluate(() => (window as unknown as { remoteResize: Promise<void> }).remoteResize);
      expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual(size);
      await show(page, `home?theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "shown");
      expect(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).has("preview")).toBe(false);
      expect(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).has("shot")).toBe(false);

      const prefix = `remote-en-${size.width}x${size.height}-${theme}`;
      const draft = "Summarize the next steps for this conversation.";
      await prepare(page, draft);
      await expect(modelTrigger(page)).toHaveAttribute("data-value", "fixture");
      await expect(modelTrigger(page)).toContainText(chatCopy["remote.effort.high"]);
      await expect(page.getByTestId("composer-input")).toBeEditable();
      await expect(page.getByTestId("composer-input")).toHaveValue(draft);
      await expect(page.getByTestId("composer-send")).toBeEnabled();
      await expect(page.locator(".chat-err")).toHaveCount(0);
      await expect(page.getByTestId("remote-session-note")).toBeVisible();
      await captureRemoteVisual(page, `${prefix}-home-options`);

      await page.getByTestId("composer-send").click();
      const turn = await backend.arrivals[0].promise;
      backend.admit(turn, "Review the summary, confirm the priorities, then continue with the next question.");
      await expect(page.getByTestId("assistant-text")).toHaveText(
        "Review the summary, confirm the priorities, then continue with the next question.",
      );
      const session = await routedSession(page);
      turn.response.end(doneFrame());
      await settled(page, session.id);
      await expect(page.getByTestId("composer-input")).toBeEditable();
      await expect(page.getByTestId("composer-input")).toHaveValue("");
      const oneOff = modelTrigger(page);
      await choose(page, "fixture-next");
      await expect(oneOff).toHaveAttribute("data-value", "fixture-next");
      await expect(page.getByTestId("remote-one-off-note")).toHaveAccessibleName(chatCopy["remote.oneOffNote"]);
      await expect(page.getByRole("button", { name: chatCopy["remote.loadHistory"], exact: true })).toBeEnabled();
      await expect(page.locator(".chat-err")).toHaveCount(0);
      await captureRemoteVisual(page, `${prefix}-settled-options`);
      for (const [name, target] of [
        ["answer", page.getByTestId("assistant-text")],
        ["partial", page.getByText(chatCopy["remote.partial"], { exact: true })],
      ] as const) {
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeInViewport({ ratio: 1 });
        const inside = await target.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const thread = element.closest(".thread")!.getBoundingClientRect();
          return box.top >= thread.top && box.bottom <= thread.bottom;
        });
        expect(inside, `${name}: reachable within transcript scrollport`).toBe(true);
        await page.screenshot({ path: test.info().outputPath(`${prefix}-scroll-${name}.png`), animations: "disabled" });
      }

      await show(page, `history?theme=${theme}`);
      await expect(page.locator(".content-top .title")).toHaveText(chatCopy["screen.history"]);
      const remoteHistory = page.locator("section").filter({
        has: page.getByRole("heading", { name: chatCopy["remote.recents"], exact: true }),
      });
      const row = remoteHistory.getByRole("button").filter({ hasText: session.title });
      await expect(row).toBeVisible();
      await expect(row).toContainText("fixture");
      await expect(row.locator("button")).toHaveCount(0);
      await expect(remoteHistory.getByRole("button")).toHaveCount(1);
      await expect(page.locator("main.content .thinking")).toHaveCount(0);
      await expect(page.locator("main.content [role=alert]")).toHaveCount(0);
      await expect(page.getByTestId("sidebar-remote-recents")).toContainText(session.title);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await captureRemoteVisual(page, `${prefix}-history`);
      expect(backend.turns).toHaveLength(1);
      expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
    });
  }
}

test("late retained history cannot cross a same-origin account switch", async ({ chat: { page, backend } }) => {
  await prepare(page, "Owner A request");
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  backend.admit(turn, "Owner A answer"); turn.response.end(doneFrame());
  await expect(page.getByRole("status").filter({ hasText: chatCopy["remote.state.settled"] })).toBeVisible();
  const old = await routedSession(page);
  backend.historyControl.held = true;
  const arrival = backend.historyControl.arrival.promise;
  await page.getByRole("button", { name: chatCopy["remote.loadHistory"], exact: true }).click();
  const held = await arrival;
  const owner = (await call<{ owner: string }>(page, "/api/connection/auth")).owner;
  await call(page, "/api/connection/auth", "POST", { action: "logout", owner });
  await signIn(page, backend.origin);
  expect((await call<{ epoch: string }>(page, "/api/remote/models")).epoch).not.toBe(old.epoch);
  const closed = deferred<void>();
  if (held.destroyed) closed.resolve(); else held.once("close", () => closed.resolve());
  held.writeHead(200, { "content-type": "application/json" });
  held.end(JSON.stringify({ items: [{ id: assistantID, parent_message_id: null, role: "assistant", text: "OWNER_A_LATE_HISTORY",
    created_at: "2026-10-04T00:00:00Z", version_index: 0, version_count: 1, is_active_version: true, finish_reason: "stop" }], has_more: false, has_older: false, has_newer: false }));
  await closed.promise;
  expect(await call<RemoteSessionView[]>(page, "/api/remote/sessions")).toEqual([]);
  await expect(page.getByText("OWNER_A_LATE_HISTORY", { exact: true })).toHaveCount(0);
  expect(backend.turns).toHaveLength(1); expect(backend.historyRequests).toHaveLength(2);
  expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
  expect(await call<unknown[]>(page, "/api/providers")).toEqual([]);
  await page.screenshot({ path: ".omo/native-chat/late-history-account-switch.png" });
});

test("remote lists reject pre-logout snapshots delivered after removal", async ({ chat: { page, app, backend } }) => {
  await prepare(page, "Remote list ownership regression");
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  backend.admit(turn, "A process-owned remote answer");
  await expect(page.getByTestId("assistant-text")).toHaveText("A process-owned remote answer");
  const session = await routedSession(page);
  turn.response.end(doneFrame());
  await settled(page, session.id);
  const recents = page.getByTestId("sidebar-remote-recents");
  await expect(recents).toContainText(session.title);

  const gate = await app.evaluateHandle(({ ipcMain }, sessionID) => {
    type Request = { method: string; url: string; headers: [string, string][]; body?: string };
    type Response = { status: number; headers: [string, string][]; body: string };
    const original = (ipcMain as unknown as {
      _invokeHandlers: Map<string, (event: unknown, request: Request) => Promise<Response>>;
    })._invokeHandlers.get("cortex:fetch");
    if (!original) throw new Error("Missing cortex:fetch handler");
    let release!: () => void, observed!: () => void;
    let released = false;
    const held: Response[] = [];
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const bothHeld = new Promise<void>((resolve) => { observed = resolve; });
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: Request) => {
      const response = await original(event, request);
      if (!released && request.method === "GET"
        && new URL(request.url).pathname === "/api/remote/sessions"
        && response.status === 200) {
        const rows = JSON.parse(response.body) as { id: string }[];
        if (!rows.some((row) => row.id === sessionID)) throw new Error("Missing real pre-logout record");
        held.push(response);
        if (held.length === 2) observed();
        await blocked;
      }
      return response;
    });
    return {
      async wait() {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            bothHeld,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("Both committed History list reads were not held")), 10_000);
            }),
          ]);
          return held.map((response) => response.body);
        } finally { clearTimeout(timer); }
      },
      release() { released = true; release(); },
      restore() {
        released = true; release();
        ipcMain.removeHandler("cortex:fetch");
        ipcMain.handle("cortex:fetch", original);
      },
    };
  }, session.id);
  const probe = await page.evaluateHandle(({ sessionID, heading }) => {
    const json = Response.prototype.json;
    let staleCount = 0, signedOutCount = 0;
    let releasing = false;
    const waiters = new Set<() => void>();
    const notify = () => { for (const check of [...waiters]) check(); };
    Response.prototype.json = async function () {
      const value: unknown = await json.call(this);
      if (releasing && Array.isArray(value) && value.some((row: unknown) =>
        row !== null && typeof row === "object" && "id" in row && row.id === sessionID)) staleCount++;
      if (value !== null && typeof value === "object" && "mode" in value
        && "signedIn" in value && value.signedIn === false) signedOutCount++;
      notify();
      return value;
    };
    const remoteSections = () => [...document.querySelectorAll(".sb-group, main.content section")]
      .filter((element) => element.textContent?.includes(heading));
    const observer = new MutationObserver(notify);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const wait = (condition: () => boolean, message: string) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error(message));
      }, 10_000);
      const check = () => {
        if (!condition()) return;
        clearTimeout(timer);
        waiters.delete(check);
        resolve();
      };
      waiters.add(check);
      check();
    });
    return {
      removed: () => wait(
        () => signedOutCount >= 2 && remoteSections().length === 0,
        "Remote removal did not hide both list owners",
      ),
      armRelease() { releasing = true; },
      async consumed() {
        await wait(() => staleCount === 2, "Both stale list bodies were not consumed by the renderer");
        // The observed JSON continuations must reach the hooks and commit before asserting absence.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return { staleCount, sections: remoteSections().length };
      },
      async revisited() {
        const baseline = signedOutCount;
        await wait(() => signedOutCount >= baseline + 2, "Revisited History did not recheck both list owners");
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return remoteSections().length;
      },
      restore() {
        Response.prototype.json = json;
        observer.disconnect();
      },
    };
  }, { sessionID: session.id, heading: chatCopy["remote.recents"] });
  try {
    // Register the main-process signal before committed navigation starts either read.
    const [bodies] = await Promise.all([
      gate.evaluate((gate) => gate.wait()),
      show(page, "history"),
    ]);
    expect(bodies).toHaveLength(2);
    for (const body of bodies) expect(JSON.parse(body)).toContainEqual(expect.objectContaining({
      id: session.id, epoch: session.epoch, source: "remote", scope: "process",
    }));
    await expect(page.locator(".content-top .title")).toHaveText(chatCopy["screen.history"]);
    await expect(page.getByRole("heading", { name: chatCopy["remote.recents"], exact: true })).toBeVisible();
    await expect(recents).toHaveCount(1);

    await Promise.all([
      probe.evaluate((probe) => probe.removed()),
      call<RemoteAuthState>(page, "/api/connection/auth", "POST", { action: "logout" })
        .then((state) => { expect(state.signedIn).toBe(false); }),
    ]);
    await expect(recents).toHaveCount(0);
    await expect(page.getByRole("heading", { name: chatCopy["remote.recents"], exact: true })).toHaveCount(0);

    await probe.evaluate((probe) => probe.armRelease());
    const [consumed] = await Promise.all([
      probe.evaluate((probe) => probe.consumed()),
      gate.evaluate((gate) => gate.release()),
    ]);
    expect(consumed).toEqual({ staleCount: 2, sections: 0 });
    await expect(page.locator("main.content")).not.toContainText(session.title);
    await expect(recents).toHaveCount(0);

    // A fresh entry remounts History and refreshes the persistent sidebar owner.
    const [sections] = await Promise.all([
      probe.evaluate((probe) => probe.revisited()),
      show(page, "history"),
    ]);
    expect(sections).toBe(0);
    await expect(page.locator(".content-top .title")).toHaveText(chatCopy["screen.history"]);
    await expect(page.locator("main.content")).not.toContainText(session.title);
    await expect(recents).toHaveCount(0);
    await expect(page.getByRole("heading", { name: chatCopy["remote.recents"], exact: true })).toHaveCount(0);
  } finally {
    await gate.evaluate((gate) => gate.restore());
    await probe.evaluate((probe) => probe.restore());
    await gate.dispose();
    await probe.dispose();
  }
});

test("remote settled options stay reachable across eight locales and two themes", async ({ chat: { page, app, backend } }) => {
  test.setTimeout(180_000);
  const { readFile } = await import("node:fs/promises");
  const locales = ["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"] as const;
  const captures: { locale: string; theme: string; name: string }[] = [];

  await prepare(page, "Remote locale geometry request");
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  const answer = "Review the summary, confirm the priorities, then continue with the next question.";
  backend.admit(turn, answer);
  await expect(page.getByTestId("assistant-text")).toHaveText(answer);
  const session = await routedSession(page);
  turn.response.end(doneFrame());
  await settled(page, session.id);

  const resized = await page.evaluateHandle(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let check = () => {};
    const ready = new Promise<void>((resolve, reject) => {
      check = () => {
        if (innerWidth !== 960 || innerHeight !== 640) return;
        clearTimeout(timer);
        removeEventListener("resize", check);
        resolve();
      };
      timer = setTimeout(() => {
        removeEventListener("resize", check);
        reject(new Error("Native content size did not reach 960x640"));
      }, 10_000);
      addEventListener("resize", check);
      check();
    });
    void ready.catch(() => {});
    return {
      wait: () => ready,
      dispose() { clearTimeout(timer); removeEventListener("resize", check); },
    };
  });
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
    await resized.evaluate((signal) => signal.wait());
  } finally {
    await resized.evaluate((signal) => signal.dispose());
    await resized.dispose();
  }

  for (const locale of locales) {
    const copy = JSON.parse(await readFile(
      new URL(`../../packages/i18n/locales/${locale}/chat.json`, import.meta.url), "utf8",
    )) as Record<string, string>;
    for (const theme of ["light", "dark"] as const) {
      await test.step(`${locale} ${theme}`, async () => {
        // Match remote-auth's locale mechanism; renderer reload preserves real main ownership.
        await page.evaluate((locale) => localStorage.setItem("cortex.locale", locale), locale);
        const query = new URLSearchParams({
          source: "remote", epoch: session.epoch, id: session.id, theme,
        });
        await show(page, `chat?${query}`);
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
        await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "shown");
        expect(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("source")).toBe("remote");
        await expect(page.locator(".content-top .title")).toHaveText(session.title);
        await expect(page.getByTestId("assistant-text")).toHaveText(answer);
        await expect(page.getByRole("status").filter({
          hasText: copy["remote.state.settled"],
        })).toBeVisible();
        await expect(page.getByTestId("remote-session-note")).toHaveAccessibleName(copy["remote.sessionOnly"]);
        await expect(page.getByTestId("composer-input")).toBeEditable();
        await expect(page.getByTestId("composer-input")).toHaveValue("");

        const model = modelTrigger(page);
        await expect(model).toBeEnabled();
        await choose(page, "fixture-next");
        await expect(model).toHaveAttribute("data-value", "fixture-next");
        await expect(page.getByTestId("remote-one-off-note")).toHaveAccessibleName(copy["remote.oneOffNote"]);
        // A retained unsent draft makes Send an actionable control without another backend turn.
        await page.getByTestId("composer-input").fill("Unsent geometry check");
        await expect(page.getByTestId("composer-send")).toBeEnabled();
        await expect(page.getByRole("button", {
          name: copy["remote.loadHistory"], exact: true,
        })).toBeEnabled();
        await expect(page.locator(".chat-err")).toHaveCount(0);

        const name = `remote-locale-${locale}-960x640-${theme}-settled-options`;
        await captureRemoteVisual(page, name);
        captures.push({ locale, theme, name });
        expect(await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).toMatchObject({
          source: "remote", scope: "process", epoch: session.epoch,
          id: session.id, state: "settled", modelSlug: "fixture", effort: "high",
        });
      });
    }
  }
  expect(captures).toHaveLength(16);
  expect(new Set(captures.map((capture) => capture.name)).size).toBe(16);
  expect(backend.turns).toHaveLength(1);
  expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
  await test.info().attach("remote-locale-capture-matrix", {
    body: JSON.stringify({
      scope: "Localized renderer geometry; backend text remains English",
      size: { width: 960, height: 640 },
      captures,
    }, null, 2),
    contentType: "application/json",
  });
});

test("expired replay loads two known messages without generating or losing the next draft", async ({ chat: { page, backend } }) => {
  await prepare(page, "Original request before expiry");
  await page.getByTestId("composer-send").click();
  const first = await backend.arrivals[0].promise;
  backend.admit(first, "Before expiry");
  await expect(page.getByTestId("assistant-text")).toHaveText("Before expiry");
  const session = await routedSession(page);
  await page.getByRole("button", { name: chatCopy["remote.detach"], exact: true }).click();
  const resume = page.getByRole("button", { name: chatCopy["remote.resume"], exact: true });
  await expect(resume).toBeEnabled();
  const draft = "  Keep this next draft\nwith its whitespace  ";
  await page.getByTestId("composer-input").fill(draft);
  await resume.click();
  const replay = await backend.arrivals[1].promise;
  expect(replay.path).toBe(first.path);
  expect(replay.raw).toBe(first.raw);
  expect(first.headers["idempotency-key"]).toMatch(/^[\da-f-]{36}$/i);
  expect(replay.headers["idempotency-key"]).toBe(first.headers["idempotency-key"]);
  expect(replay.headers["last-event-id"]).toBe(cursor(7));
  replay.response.writeHead(200, {
    "content-type": "text/event-stream",
    "x-conversation-id": conversationID, "x-message-id": assistantID,
  });
  replay.response.end(frame(8, {
    type: "error", code: "stream_expired",
    detail: "fixture-secret-vendor-detail", request_id: "fixture-private",
  }));
  await expect(page.getByRole("status").filter({
    hasText: chatCopy["remote.state.history_required"],
  })).toBeVisible();
  await expect(resume).toHaveCount(0);
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(page.getByTestId("composer-send")).toBeDisabled();
  expect(backend.historyRequests).toEqual([]);
  await expect(page.locator("body")).not.toContainText("fixture-secret-vendor-detail");
  await expect(page.locator("body")).not.toContainText("fixture-private");
  expect(await call<RemoteSessionView>(page, `/api/remote/sessions/${session.id}`)).toMatchObject({
    state: "history_required", outcome: { complete: false, partial: true, errorCode: "provider_error" },
  });

  await page.getByRole("button", { name: chatCopy["remote.loadHistory"], exact: true }).click();
  const history = page.getByRole("region", { name: chatCopy["remote.knownHistory"], exact: true });
  await expect(history.locator("article")).toHaveCount(2);
  await expect(history.locator("article").nth(0)).toContainText("Saved question");
  await expect(history.locator("article").nth(1)).toContainText("Saved answer");
  await expect(history.getByTestId("remote-history-part")).toHaveCount(2);
  await page.screenshot({ path: ".omo/native-chat/expired-replay-rebuilt-history.png" });
  await expect(page.getByText(chatCopy["remote.returnedCount"].replace("{count}", "2"), { exact: true })).toBeVisible();
  await settled(page, session.id);
  await expect(page.getByTestId("composer-input")).toHaveValue(draft);
  await expect(page.getByTestId("composer-send")).toBeEnabled();
  await expect(page.getByTestId("assistant-text")).toHaveText("Before expiry");
  await expect(page.locator("body")).not.toContainText("not in the public projection");
  expect(backend.historyRequests).toHaveLength(2);
  expect(backend.historyRequests.map((request) => request.path).sort()).toEqual([
    `/v1/conversations/${conversationID}`,
    `/v1/conversations/${conversationID}/messages`,
  ]);
  for (const request of backend.historyRequests) {
    expect(request.authorization).toBe("Bearer test-only-chat-token");
  }
  expect((await routedSession(page)).id).toBe(session.id);
  expect(await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`)).toHaveLength(2);
  expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
  expect(backend.localBodies).toEqual([]);
  expect(backend.turns).toHaveLength(2);
});

test("SDK reasoning, completed tools, disclosure and post-done media render without private payloads", async ({ chat: { page, backend } }) => {
  await prepare(page, "Show the supported stream parts");
  await page.getByTestId("composer-send").click();
  const turn = await backend.arrivals[0].promise;
  const invocationID = "tci_01h45ytscbeewvwm6xr90nbxp4";
  turn.response.writeHead(200, {
    "content-type": "text/event-stream",
    "x-conversation-id": conversationID, "x-message-id": assistantID,
  });
  turn.response.flushHeaders();
  const events = [
    { type: "disclosure", reason: "conversation_start", text: "Cortex is an AI assistant.", blocking: false },
    { type: "reasoning_delta", message_id: assistantID, delta: "Consider the image" },
    { type: "reasoning_done", message_id: assistantID, duration_ms: 12 },
    { type: "tool_start", invocation_id: invocationID, tool_name: "search", label: "Searching" },
    { type: "tool_result", invocation_id: invocationID, payload: { rows: [1] } },
    { type: "tool_end", invocation_id: invocationID, outcome: "ok", duration_ms: 2 },
    { type: "text_delta", message_id: assistantID, delta: "Answer" },
    { type: "image_generation", generation_id: "fixture-generation", status: "generating" },
    { type: "done", message_id: assistantID, finish_reason: "stop" },
  ];
  turn.response.write(events.map((event, index) => frame(index + 1, event)).join(""));
  await expect(page.getByTestId("assistant-text")).toHaveText("Answer");
  const session = await routedSession(page);
  const reasoning = page.locator("details.chat-reason");
  await expect(reasoning.locator("summary")).toContainText(chatCopy.thought);
  await expect(reasoning.locator("summary")).toContainText(chatCopy["remote.duration"].replace("{ms}", "12"));
  await expect(reasoning.locator(".chat-reason-p")).not.toBeVisible();
  await reasoning.locator("summary").click();
  await expect(reasoning.locator(".chat-reason-p")).toHaveText("Consider the image");
  await expect(reasoning.locator(".chat-reason-p")).toBeVisible();
  await expect(page.locator(".chat-tool")).toContainText(chatCopy["remote.tool.ok"]);
  await expect(page.locator(".chat-tool")).toContainText(chatCopy["remote.duration"].replace("{ms}", "2"));
  await expect(page.getByRole("status").filter({ hasText: "Cortex is an AI assistant." })).toBeVisible();
  await expect(page.getByText(chatCopy["remote.unsupported.tool_result"], { exact: true })).toBeVisible();
  await expect(page.getByText(chatCopy["remote.unsupported.media"], { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: chatCopy["remote.state.streaming"] })).toBeVisible();

  // Match the main-process fixture: media completes after the done frame.
  turn.response.end(frame(10, {
    type: "image_generation", generation_id: "fixture-generation", status: "done",
    file_id: fileID, filename: "fixture.png", content_type: "image/png", byte_size: png.length,
  }));
  await settled(page, session.id);
  await expect(page.getByText(chatCopy["remote.partial"], { exact: true })).toBeVisible();
  await expect(page.getByText(chatCopy["remote.unsupported.media"], { exact: true })).toHaveCount(1);
  const messages = await call<RemoteMessageView[]>(page, `/api/remote/sessions/${session.id}/messages`);
  expect(messages).toHaveLength(2);
  expect(messages[1]).toMatchObject({ role: "assistant", remoteID: assistantID, partial: true, finishReason: "stop" });
  expect(messages[1].parts).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "reasoning", text: "Consider the image", durationMs: 12 }),
    expect.objectContaining({ type: "tool", invocationID, status: "ok", durationMs: 2 }),
    expect.objectContaining({ type: "disclosure", reason: "conversation_start", text: "Cortex is an AI assistant.", blocking: false }),
    expect.objectContaining({ type: "unsupported", kind: "tool_result", blocking: false }),
    expect.objectContaining({ type: "unsupported", kind: "media", blocking: false }),
  ]));
  const projection = JSON.stringify(messages);
  const markup = await page.locator("main.content").innerHTML();
  for (const privateValue of ['"payload"', '"rows"', "Searching", "fixture-generation", "fixture.png"]) {
    expect(projection).not.toContain(privateValue);
    expect(markup).not.toContain(privateValue);
  }
  expect(backend.turns).toHaveLength(1);
  expect(backend.historyRequests).toEqual([]);
  expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
});

