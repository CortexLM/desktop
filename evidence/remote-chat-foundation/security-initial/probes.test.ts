import { expect, it } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/dist/index.js";
import { RemoteSession } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/desktop/src/remote-session.ts";

const origin = "https://review.example.test";
const suffix = "01h45ytscbeewvwm6xr90nbxp4";
const cnv = `cnv_${suffix}`, msg = `msg_${suffix}`, file = `lbf_${suffix}`;
const model = { slug: "review", display_name: "Review", description: "", context_tokens: 8192, max_output_tokens: 1024,
  supports_reasoning: false, supports_tools: false, supports_vision: true, kind: "chat" };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const deferred = <T = void>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
const bounded = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Probe did not settle within 1s")), 1000); })]); }
  finally { clearTimeout(timer!); }
};
const base = (request: Request, expiry = Date.now() + 60000) => {
  const path = new URL(request.url).pathname;
  if (path === "/v1/auth/local") return json({ status: "session", access_token: "review-token", token_type: "Bearer", expires_at: new Date(expiry).toISOString() });
  if (path === "/v1/instance") return json({ mode: "cloud", auth: { mode: "cortex", required: true } });
  if (path === "/v1/models") return json({ items: [model], has_more: false });
  throw new Error(`Unexpected review route ${path}`);
};
const login = (session: RemoteSession) => session.authenticate(origin, { action: "local", email: "review@example.test", password: "fixture" });
const stalledStream = (cancel: () => Promise<void>) => new Response(new ReadableStream<Uint8Array>({
  start(ctrl) { ctrl.enqueue(new TextEncoder().encode(`id: 1\ndata: ${JSON.stringify({ type: "text_delta", message_id: msg, delta: "review" })}\n\n`)); },
  cancel,
}), { headers: { "content-type": "text/event-stream", "x-conversation-id": cnv, "x-message-id": msg } });
const turn = (binding: ReturnType<RemoteSession["bind"]>) => {
  const admitted = deferred(), events: unknown[] = [];
  const handle = binding.turn({ message: "Review", modelSlug: "review", attachmentIDs: [] }, { admitted() { admitted.resolve(); }, event(e) { events.push(e); } });
  const result = handle.completion.then(() => "resolved", (e: { code?: string }) => e.code);
  return { admitted, result, events };
};

it("rejects GIF/WebP signatures with the high bit changed in every magic byte", async () => {
  const seen: { contentType: string; bytes: number[] }[] = [];
  let activeType = "";
  const session = new RemoteSession({ fetch: async (value, init) => {
    const request = value instanceof Request ? value : new Request(value, init);
    if (new URL(request.url).pathname === "/v1/library") {
      const bytes = [...new Uint8Array(await request.arrayBuffer())]; seen.push({ contentType: activeType, bytes });
      return json({ id: file, filename: "review-image", content_type: activeType, byte_size: bytes.length, access: "owner", kind: "image", source: "upload" });
    }
    return base(request);
  } });
  try {
    await login(session); const binding = session.bind(origin);
    for (const [type, magic] of [["image/gif", "GIF89a"], ["image/webp", "RIFF0000WEBP"]]) {
      activeType = type;
      const bytes = Uint8Array.from(Buffer.from(magic), (b) => b | 128);
      const outcome = await binding.upload({ body: new Blob([bytes], { type }), filename: "review-image" }).then(() => "accepted", (e: { code?: string }) => e.code);
      console.log(JSON.stringify({ case: "high-bit-magic", type, hex: Buffer.from(bytes).toString("hex"), outcome }));
      expect.soft(outcome).toBe("invalid_request");
    }
    expect.soft(seen).toEqual([]);
  } finally { session.clear(); }
});

it("expiry timer aborts an idle reader without state/operation polling even when raw cancellation never settles", async () => {
  const expiry = Date.now() + 200;
  let cancelled = 0;
  const session = new RemoteSession({ fetch: async (value, init) => {
    const request = value instanceof Request ? value : new Request(value, init);
    return request.url.endsWith("/turns") ? stalledStream(() => { cancelled++; return new Promise(() => {}); }) : base(request, expiry);
  } });
  try {
    await login(session); const binding = session.bind(origin), delivery = turn(binding);
    await bounded(delivery.admitted.promise);
    expect(binding.signal.aborted).toBe(false);
    expect(await bounded(delivery.result)).toBe("provider_auth_failed");
    expect(binding.signal.aborted).toBe(true); expect(cancelled).toBe(1);
  } finally { session.clear(); }
});

it("local logout immediately aborts an open reader and a Fetch ignoring cancellation before revocation returns", async () => {
  const logoutReached = deferred(), requestReached = deferred(), releaseLogout = deferred<Response>(), releaseModels = deferred<Response>();
  let hold = false, cancelled = 0;
  const session = new RemoteSession({ fetch: async (value, init) => {
    const request = value instanceof Request ? value : new Request(value, init);
    if (request.url.endsWith("/auth/local/logout")) { logoutReached.resolve(); return releaseLogout.promise; }
    if (hold && request.url.endsWith("/models")) { requestReached.resolve(); return releaseModels.promise; }
    if (request.url.endsWith("/turns")) return stalledStream(() => { cancelled++; return new Promise(() => {}); });
    return base(request);
  } });
  try {
    await login(session); const binding = session.bind(origin), delivery = turn(binding);
    await bounded(delivery.admitted.promise);
    hold = true;
    const held = binding.models().then(() => "resolved", (e: { code?: string }) => e.code);
    await bounded(requestReached.promise);
    const logout = session.authenticate(origin, { action: "logout" });
    await bounded(logoutReached.promise);
    expect(binding.signal.aborted).toBe(true);
    expect(await bounded(delivery.result)).toBe("aborted");
    expect(await bounded(held)).toBe("aborted"); expect(cancelled).toBe(1);
    releaseModels.resolve(json({ items: [model], has_more: false }));
    releaseLogout.resolve(new Response(null, { status: 204 })); await bounded(logout);
  } finally { session.clear(); }
});
