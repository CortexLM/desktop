import http from "node:http";
import { expect, it } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/dist/index.js";
import { createCore, memoryCredentials } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/core/src/index.ts";
import { RemoteSession } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/desktop/src/remote-session.ts";

const suffix = "01h45ytscbeewvwm6xr90nbxp4", cnv = `cnv_${suffix}`, assistantID = `msg_${suffix}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; };
async function setup() {
  const paths: string[] = [], heldUploads: http.ServerResponse[] = [];
  let origin = "", uploads = 0, holdUpload = false;
  const json = (res: http.ServerResponse, value: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
  const uploaded = (res: http.ServerResponse) => json(res, { id: `lbf_${String(++uploads).padStart(26, "0")}`, filename: "pixel.png", content_type: "image/png", byte_size: png.length, access: "owner", kind: "image", source: "upload" });
  const server = http.createServer(async (req, res) => {
    for await (const _chunk of req) { /* Drain native request body. */ }
    const path = new URL(req.url!, origin).pathname; paths.push(path);
    if (path === "/v1/auth/magic-auth") { res.writeHead(204); res.end(); return; }
    if (path === "/v1/auth/magic-auth/verify") { json(res, { status: "session", access_token: "review-token" }); return; }
    if (path === "/v1/instance") { json(res, { mode: "cloud", auth: { mode: "cortex", required: true } }); return; }
    if (path === "/v1/models") { json(res, { items: [{ slug: "fixture", display_name: "Fixture", description: "", context_tokens: 8192, max_output_tokens: 1024, supports_reasoning: false, supports_tools: false, supports_vision: true, kind: "chat" }], has_more: false }); return; }
    if (path === "/v1/library") { if (holdUpload) heldUploads.push(res); else uploaded(res); return; }
    if (path === "/v1/conversations/turns") { res.writeHead(200, { "content-type": "text/event-stream", "x-conversation-id": cnv, "x-message-id": assistantID }); res.flushHeaders(); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const remote = new RemoteSession();
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: remote, remoteChat: remote,
    fetch: async () => { throw new Error("Unexpected local provider call"); } });
  core.connection.set({ mode: "selfhost", url: origin, signedIn: false });
  await core.connection.authenticate({ action: "email", email: "review@example.test" });
  await core.connection.authenticate({ action: "code", code: "123456" });
  const catalog = await core.remoteSessions.models();
  const session = core.remoteSessions.create({ epoch: catalog.epoch, modelSlug: "fixture" });
  return { core, remote, session, origin, paths, heldUploads,
    holdUploads() { holdUpload = true; }, releaseUploads() { holdUpload = false; for (const res of heldUploads.splice(0)) uploaded(res); },
    async close() { await core.close(); await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }); },
  };
}

it("does not return an old account projection when a detached notification synchronously logs out", async () => {
  const f = await setup();
  let off = () => {};
  try {
    const accepted = await f.core.remoteSessions.prompt(f.session.id, { message: "private original account title", attachmentIDs: [] });
    let cleared = false;
    off = f.core.bus.subscribe((event) => {
      if (event.type === "remote.session.changed" && !cleared && f.core.remoteSessions.get(f.session.id).state === "detached") {
        cleared = true; f.remote.clear();
      }
    });
    let returned: unknown, code: string | undefined;
    try { returned = f.core.remoteSessions.detach(f.session.id); } catch (error) { code = (error as { code?: string }).code; }
    console.log(JSON.stringify({ case: "detach-subscriber-logout", cleared, signedIn: f.remote.state(f.origin).signedIn, returned, code }));
    expect(cleared).toBe(true); expect(f.remote.state(f.origin).signedIn).toBe(false);
    expect(() => f.core.remoteSessions.get(f.session.id)).toThrow();
    expect(await accepted.done).toMatchObject({ complete: false, errorCode: "aborted" });
    expect.soft(returned).toBeUndefined(); expect.soft(code).toBe("aborted");
  } finally { off(); await f.close(); }
});

it("keeps the same unresolved upload from creating duplicate remote files", async () => {
  const f = await setup();
  try {
    f.holdUploads();
    const input = { body: new Blob([png], { type: "image/png" }), filename: "pixel.png" };
    const first = f.core.remoteSessions.upload(f.session.id, input);
    const second = f.core.remoteSessions.upload(f.session.id, input).then((file) => ({ file }), (e: { code?: string }) => ({ code: e.code }));
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    const requests = f.paths.filter((p) => p === "/v1/library").length;
    f.releaseUploads(); await first; const result = await second;
    console.log(JSON.stringify({ case: "duplicate-upload", requests, result }));
    expect.soft(requests).toBe(1); expect.soft(result).toMatchObject({ code: "session_busy" });
  } finally { f.releaseUploads(); await f.close(); }
});

it("guards admission and fresh sends against synchronous account loss at the admitting notification", async () => {
  const f = await setup(); let off = () => {};
  try {
    const entered = deferred(); let cleared = false;
    off = f.core.bus.subscribe((event) => {
      if (event.type === "remote.session.changed" && !cleared && f.core.remoteSessions.get(f.session.id).state === "admitting") {
        cleared = true; f.remote.clear(); entered.resolve();
      }
    });
    const prompt = f.core.remoteSessions.prompt(f.session.id, { message: "never admitted", attachmentIDs: [] });
    await entered.promise;
    await expect(prompt).rejects.toMatchObject({ code: "aborted" });
    expect(f.paths.filter((p) => p.endsWith("/turns"))).toEqual([]);
    expect(() => f.core.remoteSessions.get(f.session.id)).toThrow();
  } finally { off(); await f.close(); }
});
