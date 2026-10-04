import { afterEach, expect, it } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/dist/index.js";
import { createCore, memoryCredentials, type Core } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/core/src/index.ts";
import { RemoteFile, RemoteHistoryWindow, RemoteMessageView, RemotePart } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/schema/src/index.ts";
import { RemoteSession } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/desktop/src/remote-session.ts";
import { isId } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/desktop/node_modules/@cortex/api-types/dist/index.js";

const suffix = "01h45ytscbeewvwm6xr90nbxp4", cnv = `cnv_${suffix}`, msg = `msg_${suffix}`, invocation = `tci_${suffix}`;
const done = { type: "done", message_id: msg, finish_reason: "stop" };
const cores: Core[] = [];
afterEach(async () => { for (const core of cores.splice(0)) await core.close(); });

// Actual core/main/SDK, native Request/Response. Controlled Fetch only; no network or credentials.
async function exchange(frames: unknown[]) {
  const origin = "https://projection.example.test";
  const remote = new RemoteSession({ fetch: async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init), url = new URL(req.url);
    expect(url.origin).toBe(origin);
    const json = (body: unknown) => Response.json(body);
    if (url.pathname === "/v1/auth/magic-auth") return new Response(null, { status: 204 });
    if (url.pathname === "/v1/auth/magic-auth/verify") return json({ status: "session", access_token: "fixture-token" });
    if (url.pathname === "/v1/instance") return json({ mode: "cloud", auth: { mode: "cortex", required: true } });
    if (url.pathname === "/v1/models") return json({ items: [{ slug: "fixture", display_name: "Fixture", description: "", context_tokens: 8192, max_output_tokens: 1024,
      supports_reasoning: true, supports_tools: true, supports_vision: false, kind: "chat" }], has_more: false });
    if (url.pathname === `/v1/conversations/${cnv}`) return json({ id: cnv, title: "Recovered", model_slug: "fixture", message_count: 8 });
    if (url.pathname === `/v1/conversations/${cnv}/messages`) return json({ items: [
      { id: `msg_${"2".repeat(26)}`, role: "system", text: "System context", created_at: "2026-10-03T00:00:00+00:00", version_index: 0, version_count: 1, is_active_version: true },
      { id: `msg_${"3".repeat(26)}`, role: "tool", text: "Tool history", created_at: "2026-10-03T00:00:01+00:00", version_index: 0, version_count: 1, is_active_version: true },
      { id: msg, role: "assistant", text: "Recovered answer", created_at: "2026-10-03T00:00:02+00:00", version_index: 3, version_count: 1, is_active_version: true, finish_reason: "stop" },
    ], has_more: false });
    if (url.pathname === "/v1/conversations/turns") return new Response(frames.map((e, i) => `id: ${i + 1}\ndata: ${JSON.stringify(e)}\n\n`).join(""), {
      headers: { "content-type": "text/event-stream", "x-conversation-id": cnv, "x-message-id": msg },
    });
    throw new Error("Unexpected proof route");
  } });
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: remote, remoteChat: remote,
    fetch: async () => { throw new Error("Unexpected local network access"); } });
  cores.push(core);
  core.connection.set({ mode: "selfhost", url: origin, signedIn: false });
  await core.connection.authenticate({ action: "email", email: "owner@example.test" });
  await core.connection.authenticate({ action: "code", code: "123456" });
  const { epoch } = await core.remoteSessions.models();
  const session = core.remoteSessions.create({ epoch, modelSlug: "fixture", effort: "high" });
  const admitted = await core.remoteSessions.prompt(session.id, { message: "Explain", attachmentIDs: [] });
  const outcome = await admitted.done;
  return { core, session, outcome, view: core.remoteSessions.get(session.id), assistant: core.remoteSessions.messages(session.id).find((m) => m.role === "assistant")! };
}

it("accepts the pinned backend null reasoning count as unknown without losing done", async () => {
  // d6c71de1 server/src/api/turns/generate.ts:415–425 serializes absent count as null.
  const result = await exchange([
    { type: "text_delta", message_id: msg, delta: "Answer" },
    { type: "usage", message_id: msg, input_tokens: 7, output_tokens: 4, cached_tokens: 2, reasoning_tokens: null }, done,
  ]);
  // SDK 0.3.5 cannot report discarded frames: even this clean turn has a limited projection.
  expect.soft(result.outcome).toMatchObject({ state: "settled", complete: false, partial: true, finishReason: "stop" });
  expect.soft(result.assistant.usage).toEqual({ input: 7, output: 4, cached: 2 });
  expect(result.assistant.parts).toContainEqual(expect.objectContaining({ type: "unsupported", kind: "transport", blocking: false }));
  expect(result.assistant.time.completed).toBeUndefined();
});

it.each([
  { type: "text_delta", message_id: msg }, // Required delta missing: API-types silently discards it.
  { type: "future_structured_output", message_id: msg, payload: "omitted output" },
])("does not certify full projection after SDK discards $type", async (discarded) => {
  const result = await exchange([{ type: "text_delta", message_id: msg, delta: "Before" }, discarded, done]);
  expect(result.assistant.parts).toContainEqual(expect.objectContaining({ type: "text", text: "Before" }));
  expect(result.outcome.complete).toBe(false);
  expect(result.outcome).toMatchObject({ state: "settled", partial: true, finishReason: "stop" });
  expect(result.assistant.parts).toContainEqual(expect.objectContaining({ type: "unsupported", kind: "transport", blocking: false }));
  expect(result.assistant.time.completed).toBeUndefined();
});

it("preserves SDK-supported notice order and failed-tool status while dropping unsupported payloads", async () => {
  const privateText = "fixture-private-payload";
  const result = await exchange([
    { type: "disclosure", reason: "conversation_start", text: "Plain <notice> https://help.test", blocking: true },
    { type: "text_delta", message_id: msg, delta: "Before" },
    { type: "safety_notice", severity: "acute", message: "Get support", referral: { name: "Support", contact: "https://help.test", note: "Plain text" } },
    { type: "text_delta", message_id: msg, delta: "After" },
    { type: "tool_start", invocation_id: invocation, tool_name: "probe", label: privateText },
    { type: "tool_end", invocation_id: invocation, outcome: "refused", duration_ms: 12.5, error_detail: privateText },
    { type: "permission_required", invocation_id: invocation, prompt: { id: `prm_${suffix}`, session_id: cnv, tool_name: "probe", summary: privateText, detail: privateText, created_at: "2026-10-03T00:00:00Z" } },
    { ...done, metadata: { card: "bounty_link", payload: privateText } },
  ]);
  expect(result.assistant.parts.slice(0, 4).map((p) => p.type)).toEqual(["disclosure", "text", "safety", "text"]);
  expect(result.assistant.parts).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "tool", status: "refused", durationMs: 12.5 }),
    expect.objectContaining({ type: "unsupported", kind: "permission", blocking: true }),
    expect.objectContaining({ type: "unsupported", kind: "structured", blocking: true }),
  ]));
  expect(result.outcome).toMatchObject({ complete: false, partial: true, finishReason: "stop" });
  expect(result.assistant.time.completed).toBeUndefined(); expect(result.assistant.usage).toBeUndefined();
  const projected = JSON.stringify({ outcome: result.outcome, view: result.view, assistant: result.assistant });
  expect(projected.includes(privateText)).toBe(false);
  expect(projected).toContain("https://help.test");
});

it("history recovery preserves roles and richer live text without leaving remote tools running", async () => {
  const f = await exchange([
    { type: "reasoning_delta", message_id: msg, delta: "Retained reasoning" },
    { type: "tool_start", invocation_id: invocation, tool_name: "probe", label: "Working" },
  ]);
  expect(f.outcome).toMatchObject({ state: "uncertain", complete: false });
  const history = await f.core.remoteSessions.history(f.session.id);
  expect(history.items.map((m) => m.role)).toEqual(["system", "tool", "assistant"]);
  expect(history).toMatchObject({ limit: 100, limited: true, projection: "text-and-attachments", reasoningAndTools: "omitted" });
  expect(f.core.remoteSessions.get(f.session.id).outcome).toEqual({ state: "settled", complete: false, partial: true, finishReason: "stop" });
  const assistant = f.core.remoteSessions.messages(f.session.id).find((m) => m.role === "assistant")!;
  expect(assistant.parts).toContainEqual(expect.objectContaining({ type: "reasoning", text: "Retained reasoning" }));
  expect(assistant.time.completed).toBeUndefined(); expect(assistant.usage).toBeUndefined();
  expect(assistant.parts).toContainEqual(expect.objectContaining({ type: "tool", invocationID: invocation, status: "interrupted" }));
});

it("uses the same Crockford alphabet and prefix validation as installed API-types", () => {
  const schemas = { cnv: RemoteHistoryWindow.shape.conversationID, msg: RemoteMessageView.shape.remoteID.unwrap(), lbf: RemoteFile.shape.id, tci: RemotePart.options[5].shape.invocationID };
  for (const prefix of ["cnv", "msg", "lbf", "tci"] as const) {
    for (let code = 0; code < 128; code++) {
      const value = `${prefix}_${String.fromCharCode(code)}${suffix.slice(1)}`;
      expect(schemas[prefix].safeParse(value).success).toBe(isId(prefix, value));
    }
    for (const value of [`other_${suffix}`, `${prefix}_${suffix.slice(1)}`, `${prefix}_${suffix}0`, `${prefix}_${suffix.toUpperCase()}`])
      expect(schemas[prefix].safeParse(value).success).toBe(isId(prefix, value));
  }
});
