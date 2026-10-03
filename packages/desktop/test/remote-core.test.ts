// Actual SDK/native HTTP through the process-only core service; no real account or inference.
import http from "node:http";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { BUILTIN_TOOLS, createCore, memoryCredentials } from "@cortex/core";
import { Event, RemoteMessageView, RemoteSessionView } from "@cortex/schema";
import { RemoteSession } from "../src/remote-session";

it("projects main SDK delivery without persistence, local execution or private payloads", async () => {
  const suffix = "01h45ytscbeewvwm6xr90nbxp4", cnv = `cnv_${suffix}`, assistantID = `msg_${suffix}`, fileID = `lbf_${suffix}`, invocation = `tci_${suffix}`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const privatePayload = "fixture-private-tool-payload", text = "A one-pixel image.", reasoning = "Inspect the attached pixels.";
  const requests: { path: string; method?: string; query: URLSearchParams; bytes: Buffer; contentType?: string }[] = [];
  const seen: { raw: unknown; source: string }[] = [];
  let origin = "", authOrdinal = 0, reply: http.ServerResponse | undefined;
  const json = (res: http.ServerResponse, body: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const frame = (id: number, event: unknown) => `id: ${id}\ndata: ${JSON.stringify(event)}\n\n`;
  const server = http.createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const url = new URL(req.url!, origin), bytes = Buffer.concat(chunks);
      requests.push({ path: url.pathname, method: req.method, query: url.searchParams, bytes, contentType: req.headers["content-type"] });
      if (url.pathname === "/v1/auth/magic-auth") { res.writeHead(204); res.end(); return; }
      if (url.pathname === "/v1/auth/magic-auth/verify") {
        res.setHeader("set-cookie", `cortex_rt=fixture-cookie-${++authOrdinal}; HttpOnly; Path=/`);
        json(res, { status: "session", access_token: `fixture-token-${authOrdinal}` }); return;
      }
      if (url.pathname === "/v1/instance") { json(res, { mode: "cloud", auth: { mode: "cortex", required: true, providers: ["cortex", "guest"] }, version: "fixture", registry: { enabled: false } }); return; }
      if (url.pathname === "/v1/models") {
        json(res, { items: [{ slug: "fixture-vision", display_name: "Cortex Fixture", description: "", context_tokens: 8192, max_output_tokens: 1024,
          supports_reasoning: true, supports_tools: true, supports_vision: true, is_preview: false, kind: "chat" }], has_more: false }); return;
      }
      if (url.pathname === "/v1/library") {
        json(res, { id: fileID, filename: "pixel.png", content_type: "image/png", byte_size: png.length, access: "owner", kind: "image", source: "upload",
          artifact_kind: "image", can_preview: true, created_at: "2026-10-03T00:00:00+00:00" }); return;
      }
      if (url.pathname === "/v1/conversations/turns") {
        reply = res; res.writeHead(200, { "content-type": "text/event-stream", "x-conversation-id": cnv, "x-message-id": assistantID }); res.flushHeaders(); return;
      }
      res.writeHead(404); res.end();
    } catch { res.destroy(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const remote = new RemoteSession({ fetch: async (value, init) => {
    const req = value instanceof Request ? value : new Request(value, init);
    if (new URL(req.url).origin !== origin) throw new Error("Unexpected remote proof origin");
    return fetch(req);
  } });
  const localFetch = vi.fn<typeof fetch>(async () => { throw new Error("Unexpected local network request"); });
  const credentials = memoryCredentials(), keys = vi.spyOn(credentials, "get");
  let close = async () => { remote.clear(); }, unsubscribe = () => {};
  try {
    const core = createCore({ dataDir: ":memory:", credentials, remoteAuth: remote, remoteChat: remote, fetch: localFetch });
    close = () => core.close();
    const pluginEvent = vi.fn(), localTool = vi.fn(async () => ({ output: "Local execution is forbidden in this proof" }));
    core.plugins.register("remote-proof", { event: pluginEvent, tools: [{ name: "contract_probe", description: "Local execution sentinel", parameters: z.object({}), execute: localTool }] });
    const hooks = vi.spyOn(core.plugins, "trigger"), localPrompt = vi.spyOn(core.sessions, "prompt"), provider = vi.spyOn(core.catalog, "provider");
    const tools = BUILTIN_TOOLS.map((tool) => vi.spyOn(tool, "execute").mockImplementation(async () => { throw new Error("Unexpected local tool execution"); }));
    unsubscribe = core.bus.subscribe((raw, source) => { seen.push({ raw, source }); });
    const counts = () => ["event", "session", "message", "part"].map((table) => core.storage.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n);
    const signIn = async (email: string) => {
      await core.connection.authenticate({ action: "email", email });
      await core.connection.authenticate({ action: "code", code: "123456" });
      expect(core.connection.auth().signedIn).toBe(true);
    };
    core.connection.set({ mode: "selfhost", url: origin, signedIn: false });
    await signIn("owner@example.test");
    const catalogue = await core.remoteSessions.models();
    expect(catalogue.epoch).toBe(remote.bind(origin).epoch);
    expect(catalogue.models).toEqual([expect.objectContaining({ slug: "fixture-vision", reasoning: true, vision: true })]);
    const session = RemoteSessionView.parse(core.remoteSessions.create({ epoch: catalogue.epoch, modelSlug: "fixture-vision", effort: "high" }));
    expect(session).toMatchObject({ source: "remote", epoch: catalogue.epoch, modelSlug: "fixture-vision", effort: "high", state: "ready" });
    const file = await core.remoteSessions.upload(session.id, { body: new Blob([png], { type: "image/png" }), filename: "pixel.png" });
    expect(file).toMatchObject({ id: fileID, byteSize: png.length, contentType: "image/png" });
    const upload = requests.find((r) => r.path === "/v1/library")!;
    expect(upload).toMatchObject({ method: "POST", contentType: "application/octet-stream" });
    expect(upload.bytes.equals(png)).toBe(true); expect([...upload.query]).toEqual([["filename", "pixel.png"]]);
    const admitted = await core.remoteSessions.prompt(session.id, { message: "Describe this pixel", attachmentIDs: [file.id] });
    expect(admitted.messageID).not.toBe(assistantID);
    const initial = core.remoteSessions.messages(session.id).map((message) => RemoteMessageView.parse(message));
    expect(initial.find((m) => m.role === "user")?.id).toBe(admitted.messageID);
    expect(initial.find((m) => m.role === "assistant")?.remoteID).toBe(assistantID);
    expect(core.remoteSessions.get(session.id)).toMatchObject({ conversationID: cnv, state: "streaming" });
    const turn = requests.filter((r) => r.path.endsWith("/turns")); expect(turn).toHaveLength(1);
    expect(JSON.parse(turn[0].bytes.toString())).toEqual({ message: "Describe this pixel", model_slug: "fixture-vision", reasoning_effort: "high", attachment_ids: [fileID] });
    const events = [
      { type: "disclosure", reason: "conversation_start", text: "Cortex is an AI assistant.", blocking: false },
      { type: "reasoning_delta", message_id: assistantID, delta: reasoning },
      { type: "reasoning_done", message_id: assistantID, duration_ms: 7 },
      { type: "tool_start", invocation_id: invocation, tool_name: "contract_probe", label: privatePayload },
      { type: "tool_result", invocation_id: invocation, payload: { output: privatePayload, command: privatePayload, metadata: { token: privatePayload } } },
      { type: "tool_end", invocation_id: invocation, outcome: "ok", duration_ms: 3 },
      { type: "text_delta", message_id: assistantID, delta: text },
      { type: "usage", message_id: assistantID, input_tokens: 7, output_tokens: 4, cached_tokens: 2, reasoning_tokens: null },
    ];
    reply!.write(events.map((e, i) => frame(i + 1, e)).join(""));
    await vi.waitFor(() => expect(core.remoteSessions.messages(session.id).find((m) => m.role === "assistant")?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "text", text }), expect.objectContaining({ type: "reasoning", text: reasoning, durationMs: 7 }),
    ])));
    expect(core.remoteSessions.get(session.id).state).toBe("streaming");
    reply!.end(frame(9, { type: "done", message_id: assistantID, finish_reason: "stop" }));
    const outcome = await admitted.done;
    expect(outcome).toMatchObject({ state: "settled", finishReason: "stop", partial: true, complete: false });
    const messages = core.remoteSessions.messages(session.id).map((message) => RemoteMessageView.parse(message));
    expect(messages.find((m) => m.role === "assistant")?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "disclosure", blocking: false }), expect.objectContaining({ type: "tool", invocationID: invocation, status: "ok" }),
      expect.objectContaining({ type: "unsupported", kind: "tool_result" }),
    ]));
    expect(messages.find((m) => m.role === "assistant")?.usage).toEqual({ input: 7, output: 4, cached: 2 });
    expect(counts()).toEqual([0, 0, 0, 0]); expect(core.sessions.list()).toEqual([]);
    expect(seen.length).toBeGreaterThan(0);
    for (const { raw, source } of seen) {
      expect(source).toBe("remote"); expect(raw).toEqual(Event.parse(raw));
      expect(raw).toEqual({ type: "remote.session.changed", properties: { sessionID: session.id, epoch: catalogue.epoch } });
    }
    const publicJSON = JSON.stringify({ session: core.remoteSessions.get(session.id), messages: core.remoteSessions.messages(session.id), seen, outcome });
    for (const marker of [privatePayload, "fixture-token-", "fixture-cookie-", "owner@example.test"]) expect(publicJSON.includes(marker)).toBe(false);
    const beforeReplacement = seen.length;
    await signIn("replacement@example.test");
    expect(core.remoteSessions.list()).toEqual([]); expect(() => core.remoteSessions.get(session.id)).toThrow();
    expect(seen.slice(beforeReplacement)).toEqual([{ source: "remote", raw: { type: "remote.session.removed", properties: { sessionID: session.id, epoch: catalogue.epoch } } }]);
    expect(Event.parse(seen.at(-1)!.raw).type).toBe("remote.session.removed");
    expect((await core.remoteSessions.models()).epoch).not.toBe(catalogue.epoch);
    const settledCount = seen.length; await new Promise<void>((resolve) => setImmediate(resolve)); expect(seen).toHaveLength(settledCount);
    expect(counts()).toEqual([0, 0, 0, 0]);
    for (const spy of [localFetch, keys, hooks, pluginEvent, localTool, localPrompt, provider, ...tools]) expect(spy).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
    try { await close(); } finally { await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }); vi.restoreAllMocks(); }
  }
}, 15000);

it.each([
  { type: "text_delta", message_id: "msg_01h45ytscbeewvwm6xr90nbxp4" },
  { type: "future_structured_output", payload: "fixture-omitted-content" },
])("keeps SDK-discarded $type output explicitly limited", async (discarded) => {
  const origin = "https://fixture.example.test", id = "01h45ytscbeewvwm6xr90nbxp4", msg = `msg_${id}`;
  const remote = new RemoteSession({ fetch: async (input) => {
    const request = input as Request, url = new URL(request.url);
    expect(url.origin).toBe(origin);
    if (url.pathname === "/v1/auth/magic-auth") return new Response(null, { status: 204 });
    if (url.pathname === "/v1/auth/magic-auth/verify") return Response.json({ status: "session", access_token: "fixture-token" });
    if (url.pathname === "/v1/instance") return Response.json({ mode: "cloud", auth: { mode: "cortex", required: true } });
    if (url.pathname === "/v1/models") return Response.json({ items: [{ slug: "fixture", display_name: "Fixture", description: "", context_tokens: 8192,
      max_output_tokens: 1024, supports_reasoning: true, supports_tools: false, supports_vision: false, kind: "chat" }], has_more: false });
    expect(url.pathname).toBe("/v1/conversations/turns");
    const events = [{ type: "text_delta", message_id: msg, delta: "Before" }, discarded,
      { type: "usage", message_id: msg, input_tokens: 7, output_tokens: 4, cached_tokens: 2, reasoning_tokens: null },
      { type: "done", message_id: msg, finish_reason: "stop" }];
    return new Response(events.map((event, n) => `id: ${n + 1}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
      headers: { "content-type": "text/event-stream", "x-conversation-id": `cnv_${id}`, "x-message-id": msg },
    });
  } });
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: remote, remoteChat: remote });
  try {
    core.connection.set({ mode: "selfhost", url: origin, signedIn: false });
    await core.connection.authenticate({ action: "email", email: "owner@example.test" });
    await core.connection.authenticate({ action: "code", code: "123456" });
    const { epoch } = await core.remoteSessions.models();
    const session = core.remoteSessions.create({ epoch, modelSlug: "fixture", effort: "high" });
    const admitted = await core.remoteSessions.prompt(session.id, { message: "Explain", attachmentIDs: [] });
    expect(await admitted.done).toEqual({ state: "settled", complete: false, partial: true, finishReason: "stop" });
    const assistant = core.remoteSessions.messages(session.id).find((m) => m.role === "assistant")!;
    expect(assistant.parts).toEqual([expect.objectContaining({ type: "text", text: "Before" }), expect.objectContaining({ type: "unsupported", kind: "transport", blocking: false })]);
    expect(assistant.usage).toEqual({ input: 7, output: 4, cached: 2 });
    expect(assistant.time.completed).toBeUndefined();
    expect(JSON.stringify(assistant)).not.toContain("fixture-omitted-content");
  } finally { await core.close(); }
});
