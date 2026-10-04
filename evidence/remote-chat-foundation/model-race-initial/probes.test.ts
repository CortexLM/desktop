import http from "node:http";
import { writeFileSync } from "node:fs";
import { expect, it } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/dist/index.js";
import { RemoteSession } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/desktop/src/remote-session.ts";

const suffix = "01h45ytscbeewvwm6xr90nbxp4";
const fileID = `lbf_${suffix}`, cnv = `cnv_${suffix}`, msg = `msg_${suffix}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const page = (vision: boolean) => ({ items: [{ slug: "fixture", display_name: "Cortex Fixture", description: "", context_tokens: 8192,
  max_output_tokens: 1024, supports_reasoning: true, supports_tools: false, supports_vision: vision, kind: "chat" }], has_more: false });
const json = (res: http.ServerResponse, value: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };
const observations: unknown[] = [];

it.each(["vision-false", "failed"] as const)("an older model body cannot replace the latest %s discovery before an image turn", async (latest) => {
  expect(process.versions.node.split(".")[0]).toBe("22");
  let models = 0, released = false;
  let oldResponse: http.ServerResponse | undefined;
  const oldArrived = deferred();
  const seen: string[] = [], uploads: Buffer[] = [], turns: unknown[] = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const path = new URL(req.url!, "http://127.0.0.1").pathname;
    seen.push(`${req.method} ${path}`);
    if (path === "/v1/auth/magic-auth") { res.writeHead(204); res.end(); }
    else if (path === "/v1/auth/magic-auth/verify") json(res, { status: "session", access_token: "fixture-race-token" });
    else if (path === "/v1/instance") json(res, { mode: "cloud", auth: { mode: "cortex", required: true } });
    else if (path === "/v1/models") {
      models++;
      if (models === 1) json(res, page(true)); // Seed owned upload before racing refreshes.
      else if (models === 2) {
        oldResponse = res;
        res.writeHead(200, { "content-type": "application/json" });
        res.write(JSON.stringify(page(true)).slice(0, -1)); // Incomplete old body; native JSON read stays pending.
        oldArrived.resolve();
      } else if (latest === "vision-false") json(res, page(false));
      else json(res, { code: "service_unavailable", status: 503 }, 503);
    } else if (path === "/v1/library") {
      uploads.push(body);
      json(res, { id: fileID, filename: "fixture.png", content_type: "image/png", byte_size: body.length, access: "owner", kind: "image", source: "upload" });
    } else if (path === "/v1/conversations/turns") {
      turns.push(JSON.parse(body.toString()));
      res.writeHead(200, { "content-type": "text/event-stream", "x-conversation-id": cnv, "x-message-id": msg });
      res.end(`id: 1\ndata: ${JSON.stringify({ type: "done", message_id: msg, finish_reason: "stop" })}\n\n`);
    } else json(res, { code: "not_found" }, 404);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const session = new RemoteSession(); // Default native Fetch and actual installed SDK; no transport override.
  try {
    await session.authenticate(origin, { action: "email", email: "fixture@example.test" });
    await session.authenticate(origin, { action: "code", code: "123456" });
    const binding = session.bind(origin);
    const uploaded = await binding.upload({ body: new Blob([png], { type: "image/png" }), filename: "fixture.png" });
    expect(uploads).toEqual([png]);
    const older = binding.models().then((value) => ({ outcome: "ready", vision: value[0].vision }),
      (error: { code?: string }) => ({ outcome: error.code }));
    await oldArrived.promise;
    const newer = await binding.models().then((value) => ({ outcome: "ready", vision: value[0].vision }),
      (error: { code?: string }) => ({ outcome: error.code }));
    expect(newer).toEqual(latest === "vision-false" ? { outcome: "ready", vision: false } : { outcome: "provider_error" });
    expect(released).toBe(false);
    oldResponse!.end("}"); released = true;
    const oldOutcome = await older;
    const admitted: unknown[] = [];
    const delivery = binding.turn({ message: "Describe the fixture", modelSlug: "fixture", effort: "high", attachmentIDs: [uploaded.id] }, {
      admitted(ids) { admitted.push(ids); }, event() {},
    });
    const outcome = await delivery.completion.then(() => "admitted", (error: { code?: string }) => error.code);
    const observation = { latest, runtime: process.version, nativeFetch: true, newer, older: oldOutcome, outcome,
      disposition: delivery.admissionState, modelRequests: models, turnRequests: turns.length, admitted, turns, requests: seen };
    observations.push(observation);
    writeFileSync("/tmp/opencode/remote-model-race-review/observations.json", JSON.stringify(observations, null, 2) + "\n");
    console.log(JSON.stringify(observation));
    // These assertions intentionally fail while stale main catalogue commits remain possible.
    expect.soft(outcome).toBe(latest === "vision-false" ? "model_no_image_input" : "provider_error");
    expect.soft(delivery.admissionState).toBe("refused");
    expect.soft(turns).toHaveLength(0);
    expect.soft(admitted).toHaveLength(0);
    if (latest === "failed") expect.soft(models).toBe(4); // Fresh preflight must not use the stale successful catalogue.
  } finally {
    session.clear();
    oldResponse?.destroy();
    await new Promise<void>((resolve, reject) => { server.close((e) => e ? reject(e) : resolve()); server.closeAllConnections(); });
  }
});
