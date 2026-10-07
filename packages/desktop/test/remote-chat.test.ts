// Real SDK, native Fetch and loopback HTTP: account ownership and stream admission, not inference fixtures.
import http from "node:http";
import { CLOUD_URL, createCore, memoryCredentials } from "@cortex/core";
import { createServer } from "@cortex/server";
import { createCortexClient } from "@cortex/sdk";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteSession } from "../src/remote-session";
import { createRemoteCodeBinding } from "../src/remote-code";
import { createRemoteChatBinding, remoteChatFetch, type MainRemoteAdmission, type MainRemoteEvent, type MainRemoteObserver, type MainRemoteTurn } from "../src/remote-chat";

const suffix = "01h45ytscbeewvwm6xr90nbxp4";
const cnv = `cnv_${suffix}`, msg = `msg_${suffix}`, fileID = `lbf_${suffix}`;
const otherCnv = `cnv_${suffix.slice(0, -1)}5`, otherMsg = `msg_${suffix.slice(0, -1)}5`;
// Same 1×1 PNG as the image-input Electron fixture.
const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const image = () => ({ body: new Blob([png], { type: "image/png" }), filename: "fixture.png" });
const begin = { action: "email" as const, email: "owner@example.test" };
const code = { action: "code" as const, code: "123456" };
const prompt = (): MainRemoteTurn => ({ message: "Describe the image", modelSlug: "fixture", effort: "high", attachmentIDs: [] });
const model = { slug: "fixture", display_name: "Cortex Fixture", description: "", context_tokens: 8192, max_output_tokens: 1024, supports_reasoning: true, supports_tools: true, supports_vision: true, kind: "chat" };
const instance = { mode: "cloud", auth: { mode: "cortex", required: true } };
const done = { type: "done", message_id: msg, finish_reason: "stop" };
type Seen = { path: string; method?: string; url: URL; headers: http.IncomingHttpHeaders; bytes: Buffer };
const requests: Seen[] = [];
const routes = new Map<string, (res: http.ServerResponse, req: Seen) => void>();
const sessions: RemoteSession[] = [];
let server: http.Server, origin = "";
const json = (body: unknown, status = 200) => (res: http.ServerResponse) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const frame = (id: number | string, event: unknown) => `id: ${typeof id === "number" ? `${id}-0` : id}\ndata: ${JSON.stringify(event)}\n\n`;
const headers = (res: http.ServerResponse, conversation = cnv, assistant = msg) => {
  res.writeHead(200, { "content-type": "text/event-stream", "x-conversation-id": conversation, "x-message-id": assistant });
  res.flushHeaders();
};
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };
const observe = () => {
  const ids: MainRemoteAdmission[] = [], events: MainRemoteEvent[] = [], cursors: string[] = [];
  const ready = deferred();
  const waits = new Set<() => void>();
  const changed = () => { for (const check of waits) check(); };
  const observer: MainRemoteObserver = { admitted(id) { ids.push(id); ready.resolve(); changed(); }, event(e) { events.push(e); changed(); }, cursor(id) { cursors.push(id); changed(); } };
  const until = (predicate: () => boolean) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { waits.delete(check); reject(new Error("Observer event timeout")); }, 5000);
    const check = () => { if (predicate()) { clearTimeout(timer); waits.delete(check); resolve(); } };
    waits.add(check); check();
  });
  return { ids, events, cursors, ready, observer, until };
};
const signIn = async (transport?: typeof fetch, base = origin) => {
  const session = new RemoteSession({ fetch: transport }); sessions.push(session);
  await session.authenticate(base, { ...begin, owner: session.state(base).owner! }); await session.authenticate(base, { ...code, owner: session.state(base).owner! });
  return session;
};
// Test-only routing: the SDK still sees canonical requests and responses; the socket stays loopback.
const cloudTransport: typeof fetch = async (value, init) => {
  const req = value instanceof Request ? value : new Request(value, init), url = new URL(req.url);
  expect(url.origin).toBe(CLOUD_URL); expect(req.redirect).toBe("error"); expect(req.credentials).toBe("omit");
  const local = new Request(new URL(url.pathname + url.search, origin), {
    method: req.method, headers: req.headers, signal: req.signal, redirect: "error", credentials: "omit",
    ...(req.body ? { body: await req.arrayBuffer() } : {}),
  });
  const res = await fetch(local), detached = new Response(res.body, res);
  Object.defineProperty(detached, "url", { value: req.url });
  return detached;
};
const turnRequests = () => requests.filter((r) => r.path.endsWith("/turns"));

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const url = new URL(req.url!, origin);
    const seen = { path: url.pathname, method: req.method, url, headers: req.headers, bytes: Buffer.concat(chunks) };
    requests.push(seen);
    const route = routes.get(url.pathname);
    if (route) route(res, seen); else { res.writeHead(404); res.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
beforeEach(() => {
  requests.length = 0; routes.clear();
  routes.set("/v1/auth/magic-auth", (res) => { res.writeHead(204); res.end(); });
  routes.set("/v1/auth/magic-auth/verify", (res) => {
    res.writeHead(200, { "content-type": "application/json", "set-cookie": "cortex_rt=fixture-cookie; HttpOnly; Path=/" });
    res.end(JSON.stringify({ status: "session", access_token: "fixture-token" }));
  });
  routes.set("/v1/auth/local", json({ status: "session", access_token: "fixture-local", token_type: "Bearer", expires_at: new Date(Date.now() + 60000).toISOString() }));
  routes.set("/v1/auth/local/logout", (res) => { res.writeHead(204); res.end(); });
  routes.set("/v1/instance", json(instance));
  routes.set("/v1/models", json({ items: [model, { ...model, slug: "image", kind: "image" }], has_more: false }));
  routes.set("/v1/library", (res, req) => json({ id: fileID, filename: "fixture.png", content_type: "image/png", byte_size: png.length,
    access: "owner", kind: "image", source: "upload", ...(req.url.searchParams.has("conversation_id") ? { conversation_id: req.url.searchParams.get("conversation_id") } : {}) })(res));
  routes.set("/v1/conversations/turns", (res) => { headers(res); res.end(frame(1, done)); });
  routes.set(`/v1/conversations/${cnv}/turns`, (res) => { headers(res, cnv, otherMsg); res.end(frame(1, { ...done, message_id: otherMsg })); });
  routes.set(`/v1/conversations/${cnv}`, json({ id: cnv, title: "Saved title", model_slug: "fixture", message_count: 2 }));
  routes.set(`/v1/conversations/${cnv}/messages`, json({ items: [{ id: msg, parent_message_id: null, role: "assistant", text: "Saved answer", created_at: new Date().toISOString(),
    version_index: 0, version_count: 1, is_active_version: true, finish_reason: "stop", reasoning: "Retained reasoning" }], has_more: false, has_older: false, has_newer: false }));
});
afterEach(() => { for (const session of sessions.splice(0)) session.clear(); vi.restoreAllMocks(); });
afterAll(async () => {
  await new Promise<void>((resolve, reject) => { server.close((e) => e ? reject(e) : resolve()); server.closeAllConnections(); });
});

it("admits only exact Code methods and paths with the original main-only authenticated owner", async () => {
  const controller = new AbortController();
  const owner = { origin, fetch: globalThis.fetch, signal: controller.signal, check: () => controller.signal.throwIfAborted(), unauthorized: () => {} };
  routes.set("/v1/code/sessions", (res) => { res.writeHead(201, { "content-type": "application/json" }); res.end(JSON.stringify({ id: cnv })); });
  const response = await remoteChatFetch(new Request(origin + "/v1/code/sessions", { method: "POST", headers: { authorization: "Bearer main-only-code-token" }, body: "{}" }), owner);
  expect(response.status).toBe(201);
  expect(requests.at(-1)?.headers.authorization).toBe("Bearer main-only-code-token");
  const admitted = requests.length;
  for (const [method, path] of [["GET", `/v1/code/sessions/${cnv}/terminal`], ["GET", `/v1/code/sessions/${cnv}/file?path=secret`], ["DELETE", `/v1/code/sessions/${cnv}`], ["POST", `/v1/code/sessions/${cnv}/messages`], ["GET", "/v1/code/sessions?arbitrary=1"], ["POST", `/v1/code/sessions/${cnv}/permissions/prm_bad`]]) {
    await expect(remoteChatFetch(new Request(origin + path, { method }), owner)).rejects.toMatchObject({ code: "invalid_request" });
  }
  expect(requests).toHaveLength(admitted);
  controller.abort();
  await expect(remoteChatFetch(new Request(origin + "/v1/code/sessions"), owner)).rejects.toBeDefined();
  expect(requests).toHaveLength(admitted);
});

it("admits only the read-only Code environment/usage/settings/pickers, the default-model PUT, metadata PATCH, per-file review and the AGENTS.md read", async () => {
  const owner = { origin, fetch: globalThis.fetch, signal: new AbortController().signal, check: () => {}, unauthorized: () => {} };
  for (const path of ["/v1/code/runtimes", "/v1/code/runtimes/images", "/v1/code/usage", "/v1/code/providers", "/v1/code/settings", "/v1/code/repositories", "/v1/code/branches", `/v1/code/sessions/${cnv}`, `/v1/code/sessions/${cnv}/file`, `/v1/code/sessions/${cnv}/diff/review`]) routes.set(path, json({ ok: true }));
  for (const [method, path] of [["GET", "/v1/code/runtimes"], ["GET", "/v1/code/runtimes/images"], ["GET", "/v1/code/usage"], ["GET", "/v1/code/providers"], ["PUT", "/v1/code/settings"], ["PATCH", `/v1/code/sessions/${cnv}`], ["GET", `/v1/code/sessions/${cnv}/file?path=AGENTS.md`], ["GET", "/v1/code/repositories"], ["GET", "/v1/code/branches?repo=octo%2Fdemo"], ["POST", `/v1/code/sessions/${cnv}/diff/review`]]) {
    expect((await remoteChatFetch(new Request(origin + path, { method, ...(method === "GET" ? {} : { body: "{}" }) }), owner)).status).toBe(200);
  }
  const admitted = requests.length;
  for (const [method, path] of [["POST", "/v1/code/runtimes"], ["DELETE", "/v1/code/runtimes/images/x"], ["PUT", "/v1/code/providers/openai"], ["GET", `/v1/code/sessions/${cnv}/file?path=.env`], ["GET", `/v1/code/sessions/${cnv}/file`], ["GET", `/v1/code/sessions/${cnv}/file?path=AGENTS.md&path=x`], ["GET", "/v1/code/usage?days=1"], ["PATCH", "/v1/code/sessions"], ["POST", `/v1/code/sessions/${cnv}/run`], ["GET", `/v1/code/sessions/${cnv}/files`], ["GET", "/v1/code/branches"], ["GET", "/v1/code/branches?repo=a%2Fb&x=1"], ["GET", "/v1/code/repositories?per_page=100"], ["GET", `/v1/code/sessions/${cnv}/diff/review`], ["POST", "/v1/code/repositories"]]) {
    await expect(remoteChatFetch(new Request(origin + path, { method, ...(method === "GET" || method === "DELETE" ? {} : { body: "{}" }) }), owner)).rejects.toMatchObject({ code: "invalid_request" });
  }
  expect(requests).toHaveLength(admitted);
});

it("narrows a refused live diff to its public workspace tag and never exposes producer detail", async () => {
  const owner = { origin, fetch: globalThis.fetch, signal: new AbortController().signal, check: () => {}, unauthorized: () => {} };
  const diff = `/v1/code/sessions/${cnv}/diff`;
  const refuse = (status: number, body: unknown) => routes.set(diff, (res) => { res.writeHead(status, { "content-type": "application/problem+json" }); res.end(JSON.stringify(body)); });
  refuse(422, { code: "invalid_state", detail: "secret producer path /srv/x", box_error: "code_runtime_not_running" });
  const refused = await remoteChatFetch(new Request(origin + diff), owner).catch((e: unknown) => e);
  expect(refused).toMatchObject({ reason: "code_runtime_not_running", code: "provider_unsupported" });
  expect(JSON.stringify(refused) + String(refused)).not.toContain("secret");
  refuse(503, { code: "service_unavailable", box_error: "invented_tag" });
  await expect(remoteChatFetch(new Request(origin + diff), owner)).rejects.toMatchObject({ reason: "unavailable" });
  routes.set(diff, (res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ diff: "", exit_code: 0 })); });
  expect((await remoteChatFetch(new Request(origin + diff), owner)).status).toBe(200);
  await expect(remoteChatFetch(new Request(origin + diff, { method: "POST" }), owner)).rejects.toMatchObject({ code: "invalid_request" });
});

it("refuses IPC-forced cloud create and cloud prompt in main with no producer write while no farm is admitted", async () => {
  routes.set("/v1/code/capabilities", json({ runtimes: { available: false, unavailable_reason: "code_compute_not_configured" } }));
  routes.set("/v1/code/sessions", json({ id: cnv, runtime: "cloud", model_slug: "fixture", title: "", state: "cloud_only" }, 201));
  routes.set(`/v1/code/sessions/${cnv}`, json({ id: cnv, runtime: "cloud", model_slug: "fixture", title: "", state: "cloud_only" }));
  routes.set(`/v1/code/sessions/${cnv}/messages`, json({ items: [] }));
  routes.set(`/v1/code/sessions/${cnv}/permissions`, json({ items: [] }));
  routes.set(`/v1/code/sessions/${cnv}/diff`, json({ diff: "", exit_code: 0 }));
  routes.set(`/v1/code/sessions/${cnv}/events`, (res) => { res.writeHead(200, { "content-type": "text/event-stream" }); });
  routes.set(`/v1/code/sessions/${cnv}/turns`, (res) => { headers(res); res.end(frame(1, done)); });
  const signal = new AbortController().signal, client = createCortexClient({ baseUrl: origin });
  const chat = createRemoteChatBinding(client, origin, "fixture-epoch", signal, () => {}, "usr_fixture");
  const code = createRemoteCodeBinding(client, chat, () => {});
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteCode: { bindCode: () => code } });
  core.connection.set({ mode: "cloud", signedIn: false });
  // Same path as window.cortex.request: main rebuilds the request for the typed engine server.
  const ipc = (path: string, body: unknown) => createServer(core).fetch(new Request(`http://local${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const writes = () => requests.filter((r) => r.method === "POST" && r.path.startsWith("/v1/code/"));
  try {
    const created = await ipc("/api/code/sessions", { epoch: "fixture-epoch", runtime: "cloud", modelSlug: "fixture" });
    expect(created.status).toBeGreaterThanOrEqual(400);
    expect(await created.text()).not.toContain(cnv);
    const prompted = await ipc(`/api/code/sessions/${cnv}/prompt`, { epoch: "fixture-epoch", message: "Forced cloud turn" });
    expect(prompted.status).toBeGreaterThanOrEqual(400);
    expect(writes()).toEqual([]);
    expect(requests.filter((r) => r.path === "/v1/code/capabilities")).toHaveLength(2);
  } finally { await core.close(); }
});

describe("private remote Chat binding", () => {
  it("discovers all 205 owned rows through typed created-order pages without a total cap", async () => {
    const rows = Array.from({ length: 205 }, (_, n) => ({ id: `cnv_${String(n + 1).padStart(26, "0")}`, title: "Saved title", model_slug: "fixture", message_count: 2 }));
    routes.set("/v1/conversations", (res, req) => {
      expect(req.url.searchParams.get("sort")).toBe("created");
      expect(req.url.searchParams.get("limit")).toBe("100");
      const offset = Number(req.url.searchParams.get("cursor") ?? 0);
      json(req.url.searchParams.get("archived") === "true" ? { items: [], has_more: false } : { items: rows.slice(offset, offset + 100), has_more: offset + 100 < rows.length, ...(offset + 100 < rows.length ? { next_cursor: String(offset + 100) } : {}) })(res);
    });
    const binding = createRemoteChatBinding(createCortexClient({ baseUrl: origin }), origin, "fixture-epoch", new AbortController().signal, () => {}, "usr_fixture");
    if (!binding.discover) throw new Error("Missing account discovery");
    expect((await binding.discover()).map((row) => row.conversationID)).toEqual(rows.map((row) => row.id));
    expect(requests.filter((r) => r.path === "/v1/conversations")).toHaveLength(4);
    expect(turnRequests()).toHaveLength(0);
  });

  it("preserves image hydration requirements across repeated owner discovery", async () => {
    routes.set("/v1/conversations", (res, req) => json({ items: req.url.searchParams.get("archived") === "true" ? [] : [{ id: cnv, title: "Saved title", model_slug: "fixture", message_count: 2 }], has_more: false })(res));
    const binding = createRemoteChatBinding(createCortexClient({ baseUrl: origin }), origin, "fixture-epoch", new AbortController().signal, () => {}, "usr_fixture");
    await binding.models();
    const file = await binding.upload(image());
    await binding.turn({ ...prompt(), attachmentIDs: [file.id] }, observe().observer).completion;
    if (!binding.discover) throw new Error("Missing account discovery");
    await binding.discover();
    routes.set("/v1/models", json({ items: [model, { ...model, slug: "text-only", supports_vision: false }], has_more: false }));
    await binding.models();
    await expect(binding.turn({ ...prompt(), conversationID: cnv, oneOffModelSlug: "text-only" }, observe().observer).completion).rejects.toMatchObject({ code: "model_no_image_input" });
    expect(turnRequests()).toHaveLength(1);
  });

  it("preserves full opaque cursors and empty reset payloads without a second turn", async () => {
    const binding = (await signIn()).bind(origin), o = observe();
    const ids = ["9007199254740993-18446744073709551613", "", "", ""];
    const terminal = { ...done, finish_reason: "length", outcome: "incomplete", termination_reason: "upstream_eof" };
    routes.set("/v1/conversations/turns", (res) => {
      headers(res); res.end(frame(ids[0], { type: "text_delta", message_id: msg, delta: "initial" })
        + frame(ids[1], { type: "text_delta", message_id: msg, delta: "A" })
        + frame(ids[2], { type: "text_delta", message_id: msg, delta: "B" }) + frame(ids[3], terminal));
    });
    await expect(binding.turn(prompt(), o.observer).completion).resolves.toMatchObject({ terminal });
    expect(o.events.filter((e) => e.type === "text_delta").map((e) => e.delta).join("")).toBe("initialAB");
    expect(o.cursors).toEqual(ids);
    expect(turnRequests()).toHaveLength(1);
  });

  it("rejects the old integer cursor format on both sides of the trunk stream", async () => {
    // Pre-trunk clients resumed from a bare integer; SDK 0.4.4 refuses it before any request.
    const sdk = createCortexClient({ baseUrl: origin });
    await expect(sdk.streamTurn({ body: { message: "hi", model_slug: "fixture" }, idempotencyKey: "old-cursor" }, { lastEventId: "7" }).next())
      .rejects.toThrow("Turn resume cursor must be a Redis stream ID");
    expect(turnRequests()).toHaveLength(0);
    // An old-format event id from a stream is never acknowledged as a resume point.
    const binding = (await signIn()).bind(origin), o = observe();
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.end("id: 7\ndata: " + JSON.stringify({ type: "text_delta", message_id: msg, delta: "A" }) + "\n\n" + frame(8, done)); });
    const delivery = binding.turn(prompt(), o.observer);
    await expect(delivery.completion).rejects.toMatchObject({ code: "provider_error" });
    expect(o.cursors).toEqual([]);
    expect(turnRequests().map((r) => r.headers["last-event-id"])).toEqual([undefined]);
  });

  it("refuses replay after unbuffered EOF, keeping the admitted request reserved for history", async () => {
    const binding = (await signIn()).bind(origin), o = observe();
    routes.set("/v1/conversations/turns", (res) => {
      headers(res); res.end(frame("9007199254740993-0", { type: "text_delta", message_id: msg, delta: "initial" })
        + frame("", { type: "text_delta", message_id: msg, delta: "A" }) + frame("", { type: "text_delta", message_id: msg, delta: "B" }));
    });
    const delivery = binding.turn(prompt(), o.observer);
    await expect(delivery.completion).rejects.toMatchObject({ code: "provider_error" });
    await expect(delivery.resume(o.observer)).rejects.toMatchObject({ code: "conflict" });
    expect(o.events.filter((e) => e.type === "text_delta").map((e) => e.delta).join("")).toBe("initialAB");
    expect(turnRequests()).toHaveLength(1);
    expect(() => binding.turn(prompt(), o.observer)).toThrow();
  });

  it("loads every active-path page retaining ordered parts and parent identity", async () => {
    const binding = (await signIn()).bind(origin);
    await binding.turn(prompt(), observe().observer).completion;
    const older = { id: otherMsg, parent_message_id: null, role: "user", text: "Question", created_at: "2026-10-04T00:00:00Z",
      version_index: 0, version_count: 1, is_active_version: true,
      parts: [{ id: "block-user", sequence: 0, kind: "text", text: "Question", retention: "retained" }] };
    const newer = { id: msg, parent_message_id: otherMsg, role: "assistant", text: "Answer", created_at: "2026-10-04T00:00:01Z",
      version_index: 0, version_count: 1, is_active_version: true, finish_reason: "stop",
      parts: [{ id: "block-reason", sequence: 0, kind: "reasoning", text: "Consider", retention: "retained" },
        { id: "block-tool", sequence: 1, kind: "tool_result", text: "{\"rows\":[1]}", retention: "retained", metadata: { outcome: "ok" } },
        { id: "block-answer", sequence: 2, kind: "text", text: "Answer", retention: "retained" }] };
    routes.set(`/v1/conversations/${cnv}/messages`, (res, req) => json(req.url.searchParams.has("before")
      ? { items: [older], has_more: false, has_older: false, has_newer: true, next_after_cursor: otherMsg }
      : { items: [newer], has_more: true, has_older: true, has_newer: false, next_cursor: msg })(res));
    const history = await binding.history(cnv);
    expect(history.items).toEqual([older, newer]);
    expect(requests.filter((r) => r.path.endsWith("/messages")).map((r) => r.url.searchParams.get("before"))).toEqual([null, msg]);
  });

  it("reconstructs 257 messages and refuses repeated or changed-path history without another turn", async () => {
    const binding = (await signIn()).bind(origin);
    await binding.turn(prompt(), observe().observer).completion;
    const rows = Array.from({ length: 257 }, (_, n) => ({ id: `msg_${String(n + 1).padStart(26, "0")}`,
      parent_message_id: n ? `msg_${String(n).padStart(26, "0")}` : null, role: n % 2 ? "assistant" : "user",
      text: `Message ${n}`, created_at: "2026-10-04T00:00:00Z", version_index: 0, version_count: 1, is_active_version: true,
      parts: [{ id: `part-${n}`, sequence: 0, kind: "text", text: `Message ${n}`, retention: "retained" }] }));
    routes.set(`/v1/conversations/${cnv}/messages`, (res, req) => {
      const before = req.url.searchParams.get("before"), end = before ? rows.findIndex((r) => r.id === before) : rows.length;
      const start = Math.max(0, end - 73);
      json({ items: rows.slice(start, end), has_more: start > 0, has_older: start > 0, has_newer: end < rows.length,
        ...(start ? { next_cursor: rows[start].id } : {}), ...(end < rows.length ? { next_after_cursor: rows[end - 1].id } : {}) })(res);
    });
    expect((await binding.history(cnv)).items).toEqual(rows);
    expect(requests.filter((r) => r.path.endsWith("/messages"))).toHaveLength(4);
    routes.set(`/v1/conversations/${cnv}/messages`, json({ items: [rows[256]], has_more: true, has_older: true, has_newer: false, next_cursor: rows[256].id }));
    await expect(binding.history(cnv)).rejects.toMatchObject({ code: "provider_error" });
    routes.set(`/v1/conversations/${cnv}/messages`, json({ items: [rows[0], { ...rows[1], parent_message_id: msg }], has_more: false, has_older: false, has_newer: false }));
    await expect(binding.history(cnv)).rejects.toMatchObject({ code: "provider_error" });
    expect(turnRequests()).toHaveLength(1);
  });

  it("binds a promoted identity, sanitizes models and preserves the active epoch during refused replacement", async () => {
    const fresh = new RemoteSession(); sessions.push(fresh);
    expect(() => fresh.bind(origin)).toThrow();
    const transport = vi.fn<typeof fetch>(async (value, init) => {
      const req = value instanceof Request ? value : new Request(value, init);
      expect(new URL(req.url).origin).toBe(origin); expect(req.redirect).toBe("error"); expect(req.credentials).toBe("omit");
      return fetch(req);
    });
    const session = await signIn(transport), binding = session.bind(origin);
    expect(session.bind(`${origin}/`)).toBe(binding);
    expect(() => session.bind("https://other.example")).toThrow();
    expect(binding.signal.aborted).toBe(false);
    expect(Object.keys(binding).sort()).toEqual(["accountID", "discover", "epoch", "history", "models", "signal", "turn", "upload"]);
    const models = await binding.models();
    expect(models).toEqual([{ slug: "fixture", name: "Cortex Fixture", reasoning: true, vision: true, tools: true, contextTokens: 8192, outputTokens: 1024, source: "cloud" }]);
    expect(requests.at(-1)?.headers).toMatchObject({ authorization: "Bearer fixture-token", cookie: "cortex_rt=fixture-cookie" });
    models[0].slug = "mutated";
    routes.set("/v1/auth/magic-auth/verify", json({ detail: "fixture-secret" }, 401));
    await session.authenticate(origin, { ...begin, email: "replacement@example.test", owner: session.state(origin).owner! });
    await expect(session.authenticate(origin, { ...code, owner: session.state(origin).owner! })).rejects.toMatchObject({ code: "provider_auth_failed" });
    expect(session.bind(origin)).toBe(binding);
    expect(binding.signal.aborted).toBe(false);
    await expect(binding.turn(prompt(), observe().observer).completion).resolves.toMatchObject({ terminal: done });
  });

  it("replays the exact one-off body and returns to the recorded model on the next ordinary turn", async () => {
    routes.set("/v1/models", json({ items: [model, { ...model, slug: "alternate", supports_reasoning: false, supports_vision: false }], has_more: false }));
    const binding = (await signIn()).bind(origin);
    await binding.models();
    const cursor = deferred(), o = observe();
    routes.set("/v1/conversations/turns", (res) => {
      headers(res); res.write(frame(7, { type: "text_delta", message_id: msg, delta: "partial" }));
    });
    const value = { ...prompt(), oneOffModelSlug: "alternate" };
    const delivery = binding.turn(value, { ...o.observer, cursor(id) { o.observer.cursor?.(id); cursor.resolve(); } });
    const detached = expect(delivery.completion).rejects.toMatchObject({ code: "aborted" });
    await cursor.promise;
    value.message = "edited draft"; value.oneOffModelSlug = "missing";
    delivery.detach(); await detached;
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.end(frame(8, done)); });
    await delivery.resume(o.observer);
    const [first, replay] = turnRequests();
    expect(first.path).toBe("/v1/conversations/turns");
    expect(JSON.parse(first.bytes.toString())).toEqual({
      message: prompt().message, model_slug: "fixture", reasoning_effort: "high",
      attachment_ids: [], one_off_model_slug: "alternate",
    });
    expect(replay.path).toBe(first.path);
    expect(replay.bytes).toEqual(first.bytes);
    expect(replay.headers["idempotency-key"]).toBe(first.headers["idempotency-key"]);
    expect(replay.headers["last-event-id"]).toBe("7-0");
    expect(o.ids).toEqual(Array(2).fill({ conversationID: cnv, assistantID: msg }));
    expect((await binding.history(cnv)).modelSlug).toBe("fixture");
    for (const value of [
      { ...prompt(), conversationID: cnv, modelSlug: "alternate", oneOffModelSlug: "fixture" },
      { ...prompt(), conversationID: cnv, effort: "low" as const, oneOffModelSlug: "alternate" },
      { ...prompt(), conversationID: cnv, effort: undefined, oneOffModelSlug: "alternate" },
    ]) expect(() => binding.turn(value, observe().observer)).toThrow();
    await binding.turn({ ...prompt(), message: "ordinary", conversationID: cnv }, observe().observer).completion;
    expect(turnRequests()).toHaveLength(3);
    expect(turnRequests()[2].path).toBe(`/v1/conversations/${cnv}/turns`);
    expect(JSON.parse(turnRequests()[2].bytes.toString())).toEqual({
      message: "ordinary", model_slug: "fixture", reasoning_effort: "high", attachment_ids: [],
    });
  });

  it("validates one-off membership and image capability without replacing recorded effort validation", async () => {
    routes.set("/v1/instance", json({ mode: "self_host", auth: { mode: "local", required: true } }));
    const capabilities = { reasoning: true, image: false, tools: false, context_tokens: 8192, output_tokens: 1024 };
    routes.set("/v1/registry/models", json({ items: [
      { id: "fixture", name: "Recorded", configured: true, capabilities },
      { id: "vision", name: "Vision", configured: true, capabilities: { ...capabilities, reasoning: false, image: true } },
      { id: "unknown", name: "Unknown", configured: true, capabilities: { reasoning: false, image: false, tools: false, context_tokens: 0, output_tokens: 0 } },
      { id: "plain", name: "Plain", configured: true, capabilities: { ...capabilities, reasoning: false } },
    ], source: "cache", has_more: false }));
    const binding = (await signIn()).bind(origin), file = await binding.upload(image());
    for (const oneOffModelSlug of ["", " ", "x".repeat(1025)]) {
      expect(() => binding.turn({ ...prompt(), oneOffModelSlug }, observe().observer)).toThrow();
    }
    for (const oneOffModelSlug of ["missing", "unknown", "plain"]) {
      const delivery = binding.turn({ ...prompt(), attachmentIDs: [file.id], oneOffModelSlug }, observe().observer);
      await expect(delivery.completion).rejects.toMatchObject({ code: oneOffModelSlug === "missing" ? "model_not_found" : "model_no_image_input" });
      expect(delivery.admissionState).toBe("refused");
    }
    for (const value of [
      { ...prompt(), modelSlug: "missing", oneOffModelSlug: "vision" },
      { ...prompt(), effort: undefined, oneOffModelSlug: "vision" },
    ]) {
      const delivery = binding.turn(value, observe().observer);
      await expect(delivery.completion).rejects.toMatchObject({ code: value.modelSlug === "missing" ? "model_not_found" : "invalid_request" });
      expect(delivery.admissionState).toBe("refused");
    }
    const missing = binding.turn({ ...prompt(), oneOffModelSlug: "missing" }, observe().observer);
    await expect(missing.completion).rejects.toMatchObject({ code: "model_not_found" });
    expect(turnRequests()).toHaveLength(0);
    await binding.turn({ ...prompt(), oneOffModelSlug: "unknown" }, observe().observer).completion;
    expect(JSON.parse(turnRequests()[0].bytes.toString())).toEqual({
      message: prompt().message, model_slug: "fixture", reasoning_effort: "high", attachment_ids: [], one_off_model_slug: "unknown",
    });
    await binding.turn({ ...prompt(), conversationID: cnv, attachmentIDs: [file.id], oneOffModelSlug: "vision" }, observe().observer).completion;
    expect(JSON.parse(turnRequests()[1].bytes.toString())).toEqual({
      message: prompt().message, model_slug: "fixture", reasoning_effort: "high", attachment_ids: [file.id], one_off_model_slug: "vision",
    });
    expect((await binding.history(cnv)).modelSlug).toBe("fixture");
  });

  it("retains admitted image requirements across hydrated text-only follow-ups", async () => {
    const binding = (await signIn()).bind(origin), file = await binding.upload(image());
    await binding.turn({ ...prompt(), attachmentIDs: [file.id] }, observe().observer).completion;
    for (const vision of [false, true]) {
      routes.set("/v1/models", json({ items: [{ ...model, supports_vision: vision }, { ...model, slug: "compatible" }], has_more: false }));
      await binding.models();
      const delivery = binding.turn({ ...prompt(), message: "What about the earlier image?", conversationID: cnv }, observe().observer);
      if (vision) await expect(delivery.completion).resolves.toMatchObject({ terminal: { type: "done" } });
      else await expect(delivery.completion).rejects.toMatchObject({ code: "model_no_image_input" });
      expect(delivery.admissionState).toBe(vision ? "admitted" : "refused");
      const override = binding.turn({ ...prompt(), message: "Use another model", conversationID: cnv, oneOffModelSlug: "compatible" }, observe().observer);
      await expect(override.completion).resolves.toMatchObject({ terminal: { type: "done" } });
      expect(override.admissionState).toBe("admitted");
      expect(turnRequests()).toHaveLength(vision ? 4 : 2);
    }
  });

  it.each([200, 503])("does not let an older catalogue overwrite the latest %s response", async (status) => {
    const binding = (await signIn()).bind(origin), file = await binding.upload(image());
    const arrived = deferred(); let old!: http.ServerResponse, reads = 0;
    const body = JSON.stringify({ items: [model], has_more: false });
    routes.set("/v1/models", (res) => {
      if (++reads === 1) {
        old = res; res.writeHead(200, { "content-type": "application/json" }); res.write(body.slice(0, -1)); arrived.resolve();
      } else json({ items: [{ ...model, supports_vision: false }], has_more: false }, status)(res);
    });
    const stale = expect(binding.models()).rejects.toMatchObject({ code: "aborted" });
    await arrived.promise;
    if (status === 200) expect((await binding.models())[0].vision).toBe(false);
    else await expect(binding.models()).rejects.toMatchObject({ code: "provider_error" });
    old.end(body.slice(-1)); await stale;
    const delivery = binding.turn({ ...prompt(), attachmentIDs: [file.id] }, observe().observer);
    await expect(delivery.completion).rejects.toMatchObject({ code: status === 200 ? "model_no_image_input" : "provider_error" });
    expect(delivery.admissionState).toBe("refused");
    expect(turnRequests()).toHaveLength(0);
    expect(reads).toBe(status === 200 ? 2 : 3);
  });

  it("uses legacy model discovery only after canonical Cloud instance HTTP404", async () => {
    routes.set("/v1/instance", json({ code: "not_found", status: 404 }, 404));
    routes.set("/v1/models", json({ items: [
      { ...model, slug: "cortex-1-mini", supports_vision: false },
      { ...model, slug: "cortex-teutonic-1", supports_vision: false },
      { ...model, slug: "cortex-image-1", kind: "image", supports_reasoning: false, supports_vision: false },
    ], has_more: false }));
    const session = await signIn(cloudTransport, CLOUD_URL), binding = session.bind(CLOUD_URL);
    expect(await binding.models()).toEqual([
      expect.objectContaining({ slug: "cortex-1-mini", reasoning: true, vision: false, source: "cloud" }),
      expect.objectContaining({ slug: "cortex-teutonic-1", reasoning: true, vision: false, source: "cloud" }),
    ]);
    expect(requests.slice(-2).map((r) => r.path)).toEqual(["/v1/instance", "/v1/models"]);
    expect(requests.at(-1)?.headers).toMatchObject({ authorization: "Bearer fixture-token", cookie: "cortex_rt=fixture-cookie" });
    const file = await binding.upload(image());
    await expect(binding.turn({ ...prompt(), modelSlug: "cortex-1-mini", attachmentIDs: [file.id] }, observe().observer).completion)
      .rejects.toMatchObject({ code: "model_no_image_input" });
    expect(turnRequests()).toHaveLength(0);
    await expect(binding.turn({ ...prompt(), modelSlug: "cortex-1-mini" }, observe().observer).completion).resolves.toMatchObject({ terminal: done });
    expect(JSON.parse(turnRequests()[0].bytes.toString())).toMatchObject({ model_slug: "cortex-1-mini", reasoning_effort: "high" });
    expect(binding.signal.aborted).toBe(false);
  });

  it("refuses legacy fallback for malformed/forbidden/failed Cloud discovery and missing self-host discovery", async () => {
    for (const status of [200, 403, 500]) {
      const binding = (await signIn(cloudTransport, CLOUD_URL)).bind(CLOUD_URL);
      // A problem body claiming 404 never overrides the real HTTP status or instance validator.
      routes.set("/v1/instance", json({ code: "not_found", status: 404 }, status));
      const start = requests.length;
      await expect(binding.models()).rejects.toMatchObject({ code: "provider_error" });
      expect(requests.slice(start).map((r) => r.path)).toEqual(["/v1/instance"]);
      const delivery = binding.turn(prompt(), observe().observer);
      expect(delivery.admissionState).toBe("pending");
      await expect(delivery.completion).rejects.toMatchObject({ code: "provider_error" });
      expect(delivery.admissionState).toBe("refused");
      expect(binding.signal.aborted).toBe(false);
      expect(turnRequests()).toHaveLength(0);
    }
    routes.set("/v1/instance", json({ code: "not_found", status: 404 }, 404));
    const selfhost = (await signIn()).bind(origin), start = requests.length;
    await expect(selfhost.models()).rejects.toMatchObject({ code: "invalid_request" });
    expect(requests.slice(start).map((r) => r.path)).toEqual(["/v1/instance"]);
    // Only the instance route marks the exception; a models404 is still a refusal.
    const cloud = (await signIn(cloudTransport, CLOUD_URL)).bind(CLOUD_URL);
    routes.set("/v1/models", json({ code: "not_found", status: 404 }, 404));
    await expect(cloud.models()).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("uploads owned raw image bytes, admits headers immediately and preserves reasoning/tools/disclosure and post-done media", async () => {
    const session = await signIn(), binding = session.bind(origin);
    const file = await binding.upload(image());
    const upload = requests.find((r) => r.path === "/v1/library")!;
    expect(upload.bytes).toEqual(Buffer.from(png)); expect(upload.url.searchParams.get("filename")).toBe("fixture.png");
    expect(upload.headers["content-type"]).toBe("application/octet-stream");
    expect(file).toMatchObject({ id: fileID, contentType: "image/png", byteSize: png.length });
    let reply!: http.ServerResponse;
    routes.set("/v1/conversations/turns", (res) => { reply = res; headers(res); });
    const o = observe(), delivery = binding.turn({ ...prompt(), message: "", attachmentIDs: [file.id] }, o.observer);
    expect(delivery.admissionState).toBe("pending");
    expect(Object.isFrozen(delivery)).toBe(true);
    expect(Reflect.set(delivery, "admissionState", "refused")).toBe(false);
    await o.ready.promise;
    expect(delivery.admissionState).toBe("admitted");
    expect(o.ids).toEqual([{ conversationID: cnv, assistantID: msg }]);
    expect(JSON.parse(turnRequests()[0].bytes.toString())).toEqual({ message: "", model_slug: "fixture", reasoning_effort: "high", attachment_ids: [fileID] });
    expect(turnRequests()[0].headers["idempotency-key"]).toMatch(/^[\da-f-]{36}$/);
    const events = [
      { type: "disclosure", reason: "conversation_start", text: "Cortex is an AI assistant.", blocking: false },
      { type: "reasoning_delta", message_id: msg, delta: "Consider the image" },
      { type: "reasoning_done", message_id: msg, duration_ms: 12 },
      { type: "tool_start", invocation_id: `tci_${suffix}`, tool_name: "search", label: "Searching" },
      { type: "tool_result", invocation_id: `tci_${suffix}`, payload: { rows: [1] } },
      { type: "tool_end", invocation_id: `tci_${suffix}`, outcome: "ok", duration_ms: 2 },
      { type: "text_delta", message_id: msg, delta: "Answer" },
      { type: "image_generation", generation_id: "fixture-generation", status: "generating" },
      done,
      { type: "image_generation", generation_id: "fixture-generation", status: "done", file_id: fileID, filename: "fixture.png", content_type: "image/png", byte_size: png.length },
    ];
    const mediaReady = o.until(() => o.events.length === 9);
    reply.write(events.slice(0, -1).map((e, i) => frame(i + 1, e)).join(""));
    await mediaReady;
    let settled = false; void delivery.completion.then(() => { settled = true; });
    expect(settled).toBe(false);
    reply.end(frame(10, events[9]));
    await expect(delivery.completion).resolves.toEqual({ admission: { conversationID: cnv, assistantID: msg }, terminal: done });
    expect(delivery.admissionState).toBe("admitted");
    expect(o.events).toEqual(events); expect(o.cursors.at(-1)).toBe("10-0");
    const history = await binding.history(cnv);
    expect(history).toMatchObject({ title: "Saved title", modelSlug: "fixture", limit: 200, limited: false, projection: "retained-parts", reasoningAndTools: "retained" });
    expect(history.items[0].reasoning).toBe("Retained reasoning");
    // Stored version indices can have gaps after deletion; sibling count is not an upper index bound.
    routes.set(`/v1/conversations/${cnv}/messages`, json({ items: [{ ...history.items[0], version_index: 3, version_count: 1 }], has_more: false, has_older: false, has_newer: false }));
    expect((await binding.history(cnv)).items[0]).toMatchObject({ version_index: 3, version_count: 1 });
    expect(() => binding.turn({ ...prompt(), conversationID: cnv, effort: "low" }, o.observer)).toThrow();
    await expect(binding.history(otherCnv)).rejects.toMatchObject({ code: "invalid_request" });
    await binding.upload({ ...image(), conversationID: cnv });
    expect(() => binding.turn({ ...prompt(), attachmentIDs: [fileID] }, o.observer)).toThrow();
    const followUp = binding.turn({ ...prompt(), conversationID: cnv }, observe().observer);
    await expect(followUp.completion).resolves.toMatchObject({ terminal: { type: "done" } });
    expect(followUp.admissionState).toBe("admitted");
    expect(turnRequests()).toHaveLength(2);
  });

  it("replays immutable new-chat path/body/key and the last acknowledged cursor after disconnect or detach", async () => {
    const binding = (await signIn()).bind(origin); await binding.models();
    let response!: http.ServerResponse;
    routes.set("/v1/conversations/turns", (res) => { response = res; headers(res); res.write(frame(1, { type: "text_delta", message_id: msg, delta: "A" })); });
    const o = observe(), value = prompt();
    const firstCursor = o.until(() => o.cursors.length === 1);
    const delivery = binding.turn(value, o.observer);
    expect(delivery.admissionState).toBe("pending");
    const rejected = expect(delivery.completion).rejects.toMatchObject({ code: "provider_error" });
    await firstCursor;
    value.message = "changed draft"; value.attachmentIDs.push(fileID);
    response.destroy(); await rejected;
    expect(delivery.admissionState).toBe("admitted");
    expect(() => binding.turn(prompt(), o.observer)).toThrow();
    routes.set("/v1/conversations/turns", (res) => { response = res; headers(res); res.write(frame(2, { type: "text_delta", message_id: msg, delta: "B" })); });
    const nextCursor = o.until(() => o.cursors.length === 2);
    const resumed = delivery.resume(o.observer), detached = expect(resumed).rejects.toMatchObject({ code: "aborted" });
    await nextCursor;
    delivery.detach(); await detached;
    expect(delivery.admissionState).toBe("admitted");
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.end(frame(3, done)); });
    await delivery.resume(o.observer);
    const seen = turnRequests();
    expect(seen).toHaveLength(3);
    expect(new Set(seen.map((r) => r.path))).toEqual(new Set(["/v1/conversations/turns"]));
    expect(new Set(seen.map((r) => r.headers["idempotency-key"])).size).toBe(1);
    expect(new Set(seen.map((r) => r.bytes.toString())).size).toBe(1);
    expect(seen.map((r) => r.headers["last-event-id"])).toEqual([undefined, "1-0", "2-0"]);
    expect(o.ids).toEqual(Array(3).fill({ conversationID: cnv, assistantID: msg }));
    expect(o.events.map((e) => e.type)).toEqual(["text_delta", "text_delta", "done"]);
    await expect(delivery.resume(o.observer)).rejects.toMatchObject({ code: "conflict" });
  });

  it("suppresses repeated meaningful IDs across exact opaque-cursor replay", async () => {
    const binding = (await signIn()).bind(origin), o = observe(), order: string[] = [];
    let reply!: http.ServerResponse;
    const delta = (text: string) => ({ type: "text_delta", message_id: msg, delta: text });
    const cursor = deferred();
    routes.set("/v1/conversations/turns", (res) => { reply = res; headers(res); res.write(frame("9007199254740993-1", delta("A")) + frame("9007199254740993-1", delta("A"))); });
    const observer: MainRemoteObserver = { ...o.observer,
      event(e) { order.push(e.type === "text_delta" ? `event:${e.delta}` : e.type); o.observer.event(e); },
      cursor(id) { order.push(`cursor:${id}`); o.observer.cursor?.(id); cursor.resolve(); },
    };
    const original = prompt(), delivery = binding.turn(original, observer);
    const disconnected = expect(delivery.completion).rejects.toMatchObject({ code: "provider_error" });
    await cursor.promise;
    expect(order).toEqual(["event:A", "cursor:9007199254740993-1"]);
    expect(o.cursors).toEqual(["9007199254740993-1"]);
    expect(o.events.flatMap((e) => e.type === "text_delta" ? e.delta : []).join("")).toBe("A");
    original.message = "edited after sending";
    reply.destroy(); await disconnected;
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.end(frame("9007199254740993-1", delta("A")) + frame("9007199254740993-2", delta("B")) + frame("9007199254740993-3", done)); });
    await delivery.resume(observer);
    expect(order).toEqual(["event:A", "cursor:9007199254740993-1", "event:B", "cursor:9007199254740993-2", "done", "cursor:9007199254740993-3"]);
    const [first, replay] = turnRequests();
    expect(replay.path).toBe(first.path); expect(replay.path).toBe("/v1/conversations/turns");
    expect(replay.bytes).toEqual(first.bytes); expect(replay.headers["idempotency-key"]).toBe(first.headers["idempotency-key"]);
    expect(replay.headers["last-event-id"]).toBe("9007199254740993-1");
  });

  it.each(["event", "cursor"] as const)("does not acknowledge an observer %s failure before replay", async (failure) => {
    const binding = (await signIn()).bind(origin), o = observe();
    const a = { type: "text_delta", message_id: msg, delta: "A" }, b = { ...a, delta: "B" };
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.write(frame(1, a) + frame(2, b)); });
    const observer: MainRemoteObserver = { ...o.observer,
      event(e) {
        if (failure === "event" && e.type === "text_delta" && e.delta === "B") throw new Error("fixture-private-observer-error");
        o.observer.event(e);
      },
      cursor(id) {
        if (failure === "cursor" && id === "2-0") throw new Error("fixture-private-observer-error");
        o.observer.cursor?.(id);
      },
    };
    const delivery = binding.turn(prompt(), observer);
    const error = await delivery.completion.catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "provider_error" }); expect(JSON.stringify(error)).not.toContain("fixture-private");
    expect(o.cursors).toEqual(["1-0"]);
    expect(o.events).toEqual(failure === "event" ? [a] : [a, b]);
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.end(frame(2, b) + frame(3, done)); });
    await delivery.resume(o.observer);
    expect(o.cursors).toEqual(["1-0", "2-0", "3-0"]);
    expect(o.events).toEqual(failure === "event" ? [a, b, done] : [a, b, b, done]);
    const [first, replay] = turnRequests();
    expect(replay.path).toBe(first.path); expect(replay.bytes).toEqual(first.bytes);
    expect(replay.headers["idempotency-key"]).toBe(first.headers["idempotency-key"]); expect(replay.headers["last-event-id"]).toBe("1-0");
  });

  it("reannounces matching headers before replay events after the first admission observer fails", async () => {
    const binding = (await signIn()).bind(origin);
    const first = observe();
    const delivery = binding.turn(prompt(), { ...first.observer, admitted() { throw new Error("fixture-consumer-refused-admission"); } });
    await expect(delivery.completion).rejects.toMatchObject({ code: "provider_error" });
    expect(delivery.admissionState).toBe("admitted");
    expect(first.events).toEqual([]);
    const original = turnRequests()[0];
    let reply!: http.ServerResponse;
    routes.set("/v1/conversations/turns", (res) => {
      reply = res; headers(res); res.write(frame(1, { type: "text_delta", message_id: msg, delta: "Recovered" }));
    });
    const order: string[] = [], next = observe();
    const replayEvent = next.until(() => next.events.length === 1);
    const resumed = delivery.resume({ ...next.observer,
      admitted(ids) { order.push("admitted"); next.observer.admitted(ids); },
      event(event) { order.push(event.type); next.observer.event(event); },
    });
    await replayEvent;
    expect(order).toEqual(["admitted", "text_delta"]);
    expect(next.ids).toEqual([{ conversationID: cnv, assistantID: msg }]);
    reply.end(frame(2, done));
    await expect(resumed).resolves.toMatchObject({ terminal: done });
    const replay = turnRequests()[1];
    expect(replay.path).toBe(original.path);
    expect(replay.bytes).toEqual(original.bytes);
    expect(replay.headers["idempotency-key"]).toBe(original.headers["idempotency-key"]);
    expect(replay.headers["last-event-id"]).toBeUndefined();
  });

  it("keeps ambiguous headers reserved, rejects mismatched event IDs and strips in-band raw errors", async () => {
    const binding = (await signIn()).bind(origin), o = observe();
    const arrived = deferred();
    routes.set("/v1/conversations/turns", () => { arrived.resolve(); });
    const delivery = binding.turn(prompt(), o.observer);
    expect(delivery.admissionState).toBe("pending");
    const detached = expect(delivery.completion).rejects.toMatchObject({ code: "aborted" });
    await arrived.promise;
    delivery.detach(); await detached;
    expect(delivery.admissionState).toBe("uncertain");
    for (const reply of [json({ detail: "fixture-secret" }, 500), (res: http.ServerResponse) => {
      res.writeHead(200, { "content-type": "text/event-stream" }); res.end(frame(1, done));
    }]) {
      routes.set("/v1/conversations/turns", reply);
      const resumed = delivery.resume(o.observer);
      expect(delivery.admissionState).toBe("pending");
      await expect(resumed).rejects.toMatchObject({ code: "provider_error" });
      expect(delivery.admissionState).toBe("uncertain");
    }
    expect(o.events).toEqual([]); expect(o.ids).toEqual([]);
    expect(() => binding.turn(prompt(), o.observer)).toThrow();
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.end(frame(1, { type: "text_delta", message_id: otherMsg, delta: "wrong account" })); });
    await expect(delivery.resume(o.observer)).rejects.toMatchObject({ code: "provider_error" });
    expect(delivery.admissionState).toBe("admitted");
    expect(o.events).toEqual([]); expect(o.cursors).toEqual([]);
    routes.set("/v1/conversations/turns", (res) => { headers(res, otherCnv); res.end(frame(1, done)); });
    await expect(delivery.resume(o.observer)).rejects.toMatchObject({ code: "provider_error" });
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.end(frame(1, { type: "error", code: "stream_expired", detail: "fixture-secret-vendor-detail", request_id: "fixture-private" })); });
    await expect(delivery.resume(o.observer)).resolves.toMatchObject({ terminal: { type: "error", code: "provider_error", recovery: "history" } });
    expect(delivery.admissionState).toBe("admitted");
    expect(JSON.stringify(o.events)).not.toContain("fixture-secret");
    await expect(delivery.resume(o.observer)).rejects.toMatchObject({ code: "conflict" });
    expect(() => binding.turn({ ...prompt(), conversationID: cnv }, o.observer)).toThrow();
    await binding.history(cnv);
    expect(delivery.admissionState).toBe("admitted");
    await expect(binding.turn({ ...prompt(), conversationID: cnv }, observe().observer).completion).resolves.toMatchObject({ terminal: { type: "done" } });
  });

  it("distinguishes truncated completion, EOF without terminal, and incomplete media after done", async () => {
    for (const kind of ["length", "eof", "media"] as const) {
      const binding = (await signIn()).bind(origin), o = observe();
      routes.set("/v1/conversations/turns", (res) => {
        headers(res);
        res.end(kind === "length" ? frame(1, { ...done, finish_reason: "length" }) : kind === "eof"
          ? frame(1, { type: "text_delta", message_id: msg, delta: "partial" })
          : frame(1, { type: "image_generation", generation_id: "pending", status: "generating" }) + frame(2, done));
      });
      const delivery = binding.turn(prompt(), o.observer);
      if (kind === "length") await expect(delivery.completion).resolves.toMatchObject({ terminal: { finish_reason: "length" } });
      else await expect(delivery.completion).rejects.toMatchObject({ code: "provider_error" });
      expect(o.events.some((e) => e.type === "done")).toBe(kind !== "eof");
    }
  });

  it("rejects invalid inputs, unowned/oversized files and unsupported choices before posting a turn", async () => {
    const binding = (await signIn()).bind(origin), o = observe();
    for (const value of [{ ...prompt(), attachmentIDs: [fileID] }, { ...prompt(), message: "😀".repeat(50001) }, { ...prompt(), attachmentIDs: Array(21).fill(fileID) },
      { ...prompt(), conversationID: otherCnv }, { ...prompt(), effort: false }, { ...prompt(), reasoning: true }, { ...prompt(), path: "/v1/auth/guest" }]) {
      expect(() => binding.turn(value as MainRemoteTurn, o.observer)).toThrow();
    }
    await expect(binding.upload({ body: new Blob(["not an image"], { type: "image/png" }), filename: "fixture.png" })).rejects.toMatchObject({ code: "invalid_request" });
    await expect(binding.upload({ body: new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "image/png" }), filename: "fixture.png" })).rejects.toMatchObject({ code: "invalid_request" });
    routes.set("/v1/library", json({ id: fileID, filename: "fixture.png", content_type: "image/png", byte_size: 10, access: "viewer", kind: "image", source: "upload" }));
    await expect(binding.upload(image())).rejects.toMatchObject({ code: "provider_error" });
    expect(() => binding.turn({ ...prompt(), attachmentIDs: [fileID] }, o.observer)).toThrow();
    const missing = binding.turn({ ...prompt(), modelSlug: "missing" }, o.observer);
    await expect(missing.completion).rejects.toMatchObject({ code: "model_not_found" });
    expect(missing.admissionState).toBe("refused");
    const effort = binding.turn({ ...prompt(), effort: undefined }, o.observer);
    await expect(effort.completion).rejects.toMatchObject({ code: "invalid_request" });
    expect(effort.admissionState).toBe("refused");
    expect(turnRequests()).toHaveLength(0);
    await expect(binding.turn({ ...prompt(), message: "😀".repeat(50000) }, o.observer).completion).resolves.toMatchObject({ terminal: done });
  });

  it("preserves high bits when admitting GIF/WebP signatures before authenticated upload", async () => {
    const binding = (await signIn()).bind(origin);
    // Header-only transport fixtures, not complete images or proof of server image decoding.
    const fixtures = [
      { type: "image/gif", magic: "GIF89a", invalid: "c7c9c6b8b9e1" },
      { type: "image/webp", magic: "RIFF0000WEBP", invalid: "d2c9c6c6b0b0b0b0d7c5c2d0" },
    ];
    let storedType = "";
    routes.set("/v1/library", (res, req) => json({ id: fileID, filename: "fixture-image", content_type: storedType,
      byte_size: req.bytes.length, access: "owner", kind: "image", source: "upload" })(res));
    for (const fixture of fixtures) {
      storedType = fixture.type;
      const forged = new Blob([Buffer.from(fixture.invalid, "hex")], { type: fixture.type });
      const outcome = await binding.upload({ body: forged, filename: "fixture-image" }).then(() => "accepted", (e: { code?: string }) => e.code);
      expect.soft(outcome).toBe("invalid_request");
    }
    expect(requests.filter((r) => r.path === "/v1/library")).toEqual([]);
    expect(() => binding.turn({ ...prompt(), attachmentIDs: [fileID] }, observe().observer)).toThrow();
    for (const fixture of fixtures) {
      storedType = fixture.type;
      const bytes = Buffer.from(fixture.magic, "latin1");
      await expect(binding.upload({ body: new Blob([bytes], { type: fixture.type }), filename: "fixture-image" }))
        .resolves.toMatchObject({ id: fileID, contentType: fixture.type, byteSize: bytes.length });
      expect(requests.at(-1)?.path).toBe("/v1/library"); expect(requests.at(-1)?.bytes).toEqual(bytes);
    }
    expect(requests.filter((r) => r.path === "/v1/library")).toHaveLength(2);
  });

  it("validates configured registry pages, unknown capabilities and explicit unsupported operator mode", async () => {
    const binding = (await signIn()).bind(origin);
    routes.set("/v1/instance", json({ mode: "self_host", auth: { mode: "local", required: true } }));
    const cap = { reasoning: false, image: false, tools: false, context_tokens: 0, output_tokens: 0 };
    routes.set("/v1/registry/models", (res, req) => json({ items: [{ id: req.url.searchParams.has("cursor") ? "operator/known" : "operator/unknown", name: "Operator", configured: true,
      capabilities: req.url.searchParams.has("cursor") ? { ...cap, context_tokens: 8192 } : cap }],
      source: "cache", has_more: !req.url.searchParams.has("cursor"), ...(!req.url.searchParams.has("cursor") ? { next_cursor: "two" } : {}) })(res));
    const list = await binding.models();
    expect(list[0]).toMatchObject({ slug: "operator/unknown", reasoning: "unknown", vision: "unknown", contextTokens: undefined });
    expect(list[1]).toMatchObject({ slug: "operator/known", reasoning: false, vision: false, contextTokens: 8192 });
    expect(requests.filter((r) => r.path === "/v1/registry/models").map((r) => r.url.searchParams.get("configured"))).toEqual(["true", "true"]);
    expect(requests.some((r) => r.path === "/v1/models")).toBe(false);
    await binding.upload(image());
    await expect(binding.turn({ ...prompt(), modelSlug: "operator/unknown", effort: undefined, attachmentIDs: [fileID] }, observe().observer).completion).rejects.toMatchObject({ code: "model_no_image_input" });
    await expect(binding.turn({ ...prompt(), modelSlug: "operator/unknown", effort: undefined }, observe().observer).completion).resolves.toMatchObject({ terminal: done });
    expect(JSON.parse(turnRequests().at(-1)!.bytes.toString())).not.toHaveProperty("reasoning_effort");
    routes.set("/v1/registry/models", json({ items: [], source: "cache", has_more: true, next_cursor: "repeat" }));
    await expect(binding.models()).rejects.toMatchObject({ code: "provider_error" });
    routes.set("/v1/instance", json({ mode: "self_host", auth: { mode: "none", required: false } }));
    await expect(binding.models()).rejects.toMatchObject({ code: "provider_unsupported" });
    await expect(binding.turn({ ...prompt(), modelSlug: "operator/unknown", effort: undefined }, observe().observer).completion).rejects.toMatchObject({ code: "provider_unsupported" });
  });

  it("releases definitive admission refusals, refuses redirects and retains drafts on malformed JSON", async () => {
    const binding = (await signIn()).bind(origin);
    await binding.models();
    for (const [status, errorCode] of [[422, "invalid_request"], [429, "provider_rate_limited"], [403, "provider_error"]] as const) {
      routes.set("/v1/conversations/turns", json({ detail: "fixture-secret", status: 200 }, status));
      const delivery = binding.turn(prompt(), observe().observer);
      expect(delivery.admissionState).toBe("pending");
      const error = await delivery.completion.catch((e: unknown) => e);
      expect(delivery.admissionState).toBe("refused");
      expect(error).toMatchObject({ code: errorCode }); expect(JSON.stringify(error)).not.toContain("fixture-secret");
      expect(binding.signal.aborted).toBe(false);
    }
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.end(frame(1, done)); });
    await expect(binding.turn(prompt(), observe().observer).completion).resolves.toMatchObject({ terminal: done });
    routes.set("/v1/models", (res) => { res.writeHead(307, { location: `${origin}/leaked-redirect` }); res.end(); });
    await expect(binding.models()).rejects.toMatchObject({ code: "provider_error" });
    expect(requests.some((r) => r.path === "/leaked-redirect")).toBe(false);
    routes.set("/v1/models", json({ items: [{ ...model, supports_vision: "true" }], has_more: false }));
    await expect(binding.models()).rejects.toMatchObject({ code: "provider_error" });
  });

  it("invalidates on 401, logout, origin changes and local expiry; late old 401 cannot clear a replacement", async () => {
    const session = await signIn(), first = session.bind(origin);
    routes.set("/v1/models", json({ detail: "fixture-secret" }, 401));
    await expect(first.models()).rejects.toMatchObject({ code: "provider_auth_failed" });
    expect(first.signal.aborted).toBe(true); expect(session.state(origin).signedIn).toBe(false);
    await session.authenticate(origin, { ...begin, owner: session.state(origin).owner! }); await session.authenticate(origin, { ...code, owner: session.state(origin).owner! });
    const second = session.bind(origin); expect(second.epoch).not.toBe(first.epoch);
    await session.authenticate(origin, { action: "logout" }); expect(second.signal.aborted).toBe(true);
    await session.authenticate(origin, { ...begin, owner: session.state(origin).owner! }); await session.authenticate(origin, { ...code, owner: session.state(origin).owner! });
    const third = session.bind(origin); session.state("https://other.example"); expect(third.signal.aborted).toBe(true);
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    routes.set("/v1/auth/local", json({ status: "session", access_token: "fixture-local", token_type: "Bearer", expires_at: new Date(now + 1000).toISOString() }));
    await session.authenticate(origin, { action: "local", email: begin.email, password: "fixture", owner: session.state(origin).owner! });
    const local = session.bind(origin); clock.mockReturnValue(now + 1000);
    await expect(local.models()).rejects.toMatchObject({ code: "provider_auth_failed" }); expect(local.signal.aborted).toBe(true); clock.mockRestore();
    await session.authenticate(origin, { action: "local", email: begin.email, password: "fixture", owner: session.state(origin).owner! });
    const loggingOut = session.bind(origin), arrived = deferred(); let reply!: http.ServerResponse;
    routes.set("/v1/auth/local/logout", (res) => { reply = res; arrived.resolve(); });
    const logout = session.authenticate(origin, { action: "logout" });
    await arrived.promise;
    expect(loggingOut.signal.aborted).toBe(true);
    await expect(loggingOut.models()).rejects.toMatchObject({ code: "aborted" });
    reply.writeHead(204); reply.end(); await logout;

    const ready = deferred(), release = deferred();
    const race = await signIn(async (value, init) => {
      const req = value instanceof Request ? value : new Request(value, init);
      const response = await fetch(req);
      if (req.url.endsWith("/models")) { const copy = new Response(await response.arrayBuffer(), response); ready.resolve(); await release.promise; return copy; }
      return response;
    });
    const stale = race.bind(origin), waiting = expect(stale.models()).rejects.toMatchObject({ code: "aborted" });
    await ready.promise;
    await race.authenticate(origin, { ...begin, email: "new@example.test", owner: race.state(origin).owner! }); await race.authenticate(origin, { ...code, owner: race.state(origin).owner! });
    const replacement = race.bind(origin); release.resolve(); await waiting;
    expect(replacement.signal.aborted).toBe(false); expect(race.state(origin).email).toBe("new@example.test");
    routes.set("/v1/models", json({ items: [model], has_more: false }));
    const streaming = (await signIn()), active = streaming.bind(origin), o = observe();
    routes.set("/v1/conversations/turns", (res) => { headers(res); res.write(frame(1, { type: "text_delta", message_id: msg, delta: "old" })); });
    const delivery = active.turn(prompt(), o.observer), stopped = expect(delivery.completion).rejects.toMatchObject({ code: "aborted" });
    await o.ready.promise;
    await streaming.authenticate(origin, { ...begin, email: "new@example.test", owner: streaming.state(origin).owner! }); await streaming.authenticate(origin, { ...code, owner: streaming.state(origin).owner! });
    await stopped;
    expect(active.signal.aborted).toBe(true);
    await expect(delivery.resume(o.observer)).rejects.toMatchObject({ code: "aborted" });
  });

  it("bounds JSON bodies and ignores late commits from caller cancellation", async () => {
    const binding = (await signIn()).bind(origin);
    routes.set("/v1/models", json({ items: [], has_more: false, padding: "x".repeat(4 * 1024 * 1024) }));
    await expect(binding.models()).rejects.toMatchObject({ code: "provider_error" });
    routes.set("/v1/models", json({ items: [model], has_more: false }));
    await binding.models();
    const arrived = deferred(); let reply!: http.ServerResponse;
    routes.set("/v1/library", (res) => { reply = res; arrived.resolve(); });
    const cancel = new AbortController(); const upload = expect(binding.upload(image(), cancel.signal)).rejects.toMatchObject({ code: "aborted" });
    await arrived.promise; cancel.abort(); await upload;
    json({ id: fileID, filename: "fixture.png", content_type: "image/png", byte_size: 10, access: "owner", kind: "image", source: "upload" })(reply);
    expect(() => binding.turn({ ...prompt(), attachmentIDs: [fileID] }, observe().observer)).toThrow();
  });

  it("enforces the real JSON deadline while an SSE body has its separate idle deadline", async () => {
    const binding = (await signIn()).bind(origin);
    await binding.models();
    let reply!: http.ServerResponse;
    routes.set("/v1/conversations/turns", (res) => { reply = res; headers(res); res.write(frame(1, { type: "text_delta", message_id: msg, delta: "partial" })); });
    const first = observe(), stream = binding.turn(prompt(), first.observer);
    let settled = false;
    const delivered = stream.completion.then((value) => { settled = true; return value; });
    await first.ready.promise;
    routes.set("/v1/models", (res) => { res.writeHead(200, { "content-type": "application/json" }); res.write('{"items":'); });
    const jsonStarted = performance.now();
    await expect(binding.models()).rejects.toMatchObject({ code: "provider_error" });
    expect(performance.now() - jsonStarted).toBeGreaterThanOrEqual(9000);
    expect(settled).toBe(false);
    reply.end(frame(2, done));
    await expect(delivered).resolves.toMatchObject({ terminal: done });
    routes.set("/v1/models", json({ items: [model], has_more: false }));
    await binding.models();
    const nativeTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((handler: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) =>
      nativeTimeout(handler, ms === 60000 ? 30 : ms, ...args)) as typeof setTimeout);
    routes.set(`/v1/conversations/${cnv}/turns`, (res) => { headers(res, cnv, otherMsg); res.write(frame(1, { type: "text_delta", message_id: otherMsg, delta: "partial" })); });
    const o = observe();
    await expect(binding.turn({ ...prompt(), conversationID: cnv }, o.observer).completion).rejects.toMatchObject({ code: "provider_error" });
    expect(o.ids).toHaveLength(1); expect(o.events.map((e) => e.type)).toEqual(["text_delta"]);
  });
});
