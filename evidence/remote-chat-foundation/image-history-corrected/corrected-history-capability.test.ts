import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { it } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/dist/index.js";
import { createCore, memoryCredentials } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/core/src/index.ts";
import { RemoteSession } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/desktop/src/remote-session.ts";

it("refuses fresh image-history follow-ups with lost or restored vision, preserving the limited first projection", async () => {
  const suffix = "01h45ytscbeewvwm6xr90nbxp4", cnv = `cnv_${suffix}`, imageID = `lbf_${suffix}`;
  const firstID = `msg_${suffix}`, nextID = `msg_${suffix.slice(0, -1)}5`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  let origin = "", vision = true, uploadedExact = false;
  const posts: { path: string; body: unknown }[] = [];
  const json = (res: http.ServerResponse, body: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks), path = new URL(req.url!, origin).pathname;
      if (path === "/v1/auth/magic-auth") { res.writeHead(204); res.end(); return; }
      if (path === "/v1/auth/magic-auth/verify") { json(res, { status: "session", access_token: "test-only-history-fixture-token" }); return; }
      if (path === "/v1/instance") { json(res, { mode: "cloud", auth: { mode: "cortex", required: true } }); return; }
      if (path === "/v1/models") {
        json(res, { items: [{ slug: "fixture-vision", display_name: "Cortex fixture", description: "", kind: "chat", context_tokens: 8192, max_output_tokens: 1024,
          supports_reasoning: true, supports_tools: false, supports_vision: vision }], has_more: false }); return;
      }
      if (path === "/v1/library") {
        uploadedExact = bytes.equals(png);
        json(res, { id: imageID, filename: "pixel.png", content_type: "image/png", byte_size: png.length, access: "owner", kind: "image", source: "upload" }); return;
      }
      if (req.method === "POST" && (path === "/v1/conversations/turns" || path === `/v1/conversations/${cnv}/turns`)) {
        const body = JSON.parse(bytes.toString()); posts.push({ path, body });
        const message_id = path === "/v1/conversations/turns" ? firstID : nextID;
        res.writeHead(200, { "content-type": "text/event-stream", "x-conversation-id": cnv, "x-message-id": message_id });
        res.end(`id: 1\ndata: ${JSON.stringify({ type: "text_delta", message_id, delta: "Controlled fixture reply" })}\n\nid: 2\ndata: ${JSON.stringify({ type: "done", message_id, finish_reason: "stop" })}\n\n`);
        return;
      }
      res.writeHead(404); res.end();
    } catch { res.destroy(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const remote = new RemoteSession({ fetch: (value, init) => {
    const request = value instanceof Request ? value : new Request(value, init);
    assert.equal(new URL(request.url).origin, origin);
    return fetch(request);
  } });
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: remote, remoteChat: remote,
    fetch: async () => { throw new Error("Unexpected local-provider request"); } });
  try {
    core.connection.set({ mode: "selfhost", url: origin, signedIn: false });
    await core.connection.authenticate({ action: "email", email: "owner@example.test" });
    await core.connection.authenticate({ action: "code", code: "123456" });
    const firstModels = await core.remoteSessions.models(), binding = remote.bind(origin);
    assert.equal(firstModels.models[0].vision, true);
    const session = core.remoteSessions.create({ epoch: firstModels.epoch, modelSlug: "fixture-vision", effort: "high" });
    const file = await core.remoteSessions.upload(session.id, { body: new Blob([png], { type: "image/png" }), filename: "pixel.png" });
    const first = await core.remoteSessions.prompt(session.id, { message: "Describe the image", attachmentIDs: [file.id] });
    // New explicit main projection contract: SDK 0.3.5 hides discarded frames.
    // This assertion does not relax the historical-image refusal or no-POST checks below.
    const firstOutcome = await first.done;
    assert.deepEqual(firstOutcome, { state: "settled", complete: false, partial: true, finishReason: "stop" });
    assert.equal(uploadedExact, true);
    const initial = core.remoteSessions.messages(session.id);
    const firstUser = initial.find((m) => m.id === first.messageID)!;
    const assistant = initial.find((m) => m.remoteID === firstID)!;
    assert.equal(firstUser.parts.filter((p) => p.type === "file").length, 1);
    const marker = assistant.parts.find((p) => p.type === "unsupported" && p.kind === "transport");
    assert.ok(marker && marker.type === "unsupported" && marker.blocking === false);
    assert.equal(assistant.partial, true);
    assert.equal(assistant.time.completed, undefined);

    vision = false;
    const refreshed = await core.remoteSessions.models();
    assert.equal(refreshed.epoch, firstModels.epoch);
    assert.equal(remote.bind(origin), binding);
    assert.equal(refreshed.models[0].vision, false);
    const followupInput = { message: "Describe the same image again", attachmentIDs: [] as string[] };
    const followup = await core.remoteSessions.prompt(session.id, followupInput).then(async (ack) => ({ accepted: true, outcome: await ack.done }),
      (error: { code?: string }) => ({ accepted: false, code: error.code }));
    // Control: the present-input image gate still refuses the very same retained upload ID.
    const explicit = await core.remoteSessions.prompt(session.id, { message: "Explicit image", attachmentIDs: [file.id] }).then(async (ack) => ({ accepted: true, outcome: await ack.done }),
      (error: { code?: string }) => ({ accepted: false, code: error.code }));
    const postsAfterVisionLoss = posts.length, stateAfterVisionLoss = core.remoteSessions.get(session.id).state;

    vision = true;
    const restored = await core.remoteSessions.models();
    assert.equal(restored.epoch, firstModels.epoch);
    assert.equal(remote.bind(origin), binding);
    assert.equal(restored.models[0].vision, true);
    const restoredVisionFollowup = await core.remoteSessions.prompt(session.id, followupInput).then(async (ack) => ({ accepted: true, outcome: await ack.done }),
      (error: { code?: string }) => ({ accepted: false, code: error.code }));
    const stateAfterRestoration = core.remoteSessions.get(session.id).state;
    assert.deepEqual(core.remoteSessions.messages(session.id), initial);
    assert.deepEqual(followupInput, { message: "Describe the same image again", attachmentIDs: [] });
    const counts = ["event", "session", "message", "part"].map((table) => core.storage.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n);
    assert.deepEqual(counts, [0, 0, 0, 0]);
    const receipt = { runtime: process.version, sdk: "0.3.5", originalVision: true, refreshedVision: false, restoredVision: true, sameEpoch: true, sameBinding: true,
      uploadedPngSHA256: createHash("sha256").update(png).digest("hex"), uploadBytesExact: uploadedExact, admittedProjectionPreserved: true,
      firstOutcome, transportMarker: marker, followup, explicitImageControl: explicit, postsAfterVisionLoss, stateAfterVisionLoss,
      restoredVisionFollowup, stateAfterRestoration, posts, sqliteCounts: counts,
      scope: "Actual desktop core + main RemoteSession + SDK/native HTTP against controlled loopback; no real account, backend execution or inference." };
    fs.writeFileSync("/tmp/opencode/remote-history-capability-review/corrected-result.json", JSON.stringify(receipt, null, 2) + "\n");
    assert.deepEqual(explicit, { accepted: false, code: "model_no_image_input" });
    assert.deepEqual(followup, { accepted: false, code: "model_no_image_input" }, "Historical image capability must refuse before another turn is admitted");
    assert.equal(postsAfterVisionLoss, 1, "No follow-up HTTP POST after confirmed vision loss");
    assert.deepEqual(restoredVisionFollowup, { accepted: false, code: "provider_unsupported" }, "Restoring vision does not supply backend image-history hydration");
    assert.equal(posts.length, 1, "No fresh follow-up HTTP POST after an admitted image");
    assert.equal(stateAfterVisionLoss, "ready");
    assert.equal(stateAfterRestoration, "ready");
  } finally {
    await core.close();
    await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
  }
});
