// Real inference through the built Electron IPC bridge; no fixture catalog or response.
// Replay: export CORTEX_REAL_BASE_URL CORTEX_REAL_API_KEY, then run:
//   xvfb-run -a node scripts/verify-real-provider.mjs
// Requires an existing build. Only cx/gpt-6-astra is requested. At most two requests,
// 120 seconds per attempt. Credentials enter Electron main only; temporary data is deleted.
/* global window */
import { _electron as electron } from "@playwright/test";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const model = "cx/gpt-6-astra";
const prompt = 'Identify the background color and the center shape color in this image. Reply only with a JSON object with keys "background" and "center", using lowercase color names. Do not use tools.';
const baseURL = process.env.CORTEX_REAL_BASE_URL;
const apiKey = process.env.CORTEX_REAL_API_KEY;
delete process.env.CORTEX_REAL_API_KEY;
const report = {
  timestamp: new Date().toISOString(), model, platform: process.platform,
  scope: "Built Electron renderer IPC bridge and local engine; real remote inference; not packaged-app or visual acceptance.",
  transport: "Configured gateway; private base URL omitted; response bytes forwarded unchanged.",
  alias: "Test-only loopback proxy replaces only the catalog request model ID with cx/gpt-6-astra. Catalog capabilities are unchanged.",
  image: { width: 128, height: 128, background: "blue", center: "red", shape: "square", prompt },
  criteria: {
    catalog: "Live models.dev entry declares reasoning and image input.",
    image: 'Public answer parses as JSON with background="blue" and center="red".',
    streaming: "At least one nonempty text delta and one nonempty reasoning delta arrive through Electron IPC; matching persisted parts exist.",
    transport: "Exactly one real upstream streamed request per attempt, requested model cx/gpt-6-astra; no generated response or altered capabilities.",
    completion: "Engine returns idle without error within 120 seconds; no tools offered or invoked.",
    credentials: "Key installed in main, never supplied to renderer; temporary credentials and history removed.",
  },
  attempts: [], passed: false,
};

async function attempt(providerID, catalogModelID, endpoint) {
  const start = Date.now();
  const result = {
    providerID, catalogModelID, protocol: endpoint === "/responses" ? "Responses SSE" : "Chat Completions SSE",
    endpoint: `/v1${endpoint}`, deadlineMs: 120000, upstreamRequests: 0, blockedRetries: 0,
    upstream: { status: null, streamed: false, bytes: 0, textDeltas: 0, reasoningDeltas: 0 },
  };
  report.attempts.push(result);
  const dataDir = await mkdtemp(path.join(tmpdir(), "cortex-real-provider-"));
  let app;
  const proxy = createServer(async (req, res) => {
    try {
      if (req.method !== "POST" || req.url !== endpoint || result.upstreamRequests) {
        result.blockedRetries++;
        res.writeHead(409).end();
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (body.model !== catalogModelID || !body.stream || body.tools?.length || req.headers.authorization !== `Bearer ${apiKey}`) {
        result.failure = "request_contract_failed";
        res.writeHead(400).end();
        return;
      }
      body.model = model;
      result.request = { model: body.model, stream: body.stream, tools: body.tools?.length ?? 0, image: JSON.stringify(body).includes("data:image/png;base64,"), reasoning: body.reasoning ?? null };
      result.upstreamRequests++;
      const response = await fetch(`${baseURL.replace(/\/$/, "")}${endpoint}`, {
        method: "POST", headers: { "content-type": "application/json", authorization: req.headers.authorization },
        body: JSON.stringify(body), signal: globalThis.AbortSignal.timeout(Math.max(1, 120000 - (Date.now() - start))),
      });
      const contentType = response.headers.get("content-type") ?? "";
      result.upstream.status = response.status;
      result.upstream.streamed = contentType.includes("text/event-stream");
      res.writeHead(response.status, { "content-type": contentType });
      let pending = "";
      for await (const chunk of response.body) {
        result.upstream.bytes += chunk.length;
        if (result.upstream.streamed) {
          pending += Buffer.from(chunk).toString();
          const frames = pending.split(/\r?\n\r?\n/);
          pending = frames.pop();
          for (const frame of frames) {
            const data = frame.split(/\r?\n/).find(line => line.startsWith("data:"))?.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const event = JSON.parse(data);
              const delta = event.choices?.[0]?.delta;
              if (event.type === "response.output_text.delta" && event.delta || delta?.content) result.upstream.textDeltas++;
              if (/^response\.reasoning(_summary)?_text\.delta$/.test(event.type ?? "") && event.delta || delta?.reasoning_content || delta?.reasoning) result.upstream.reasoningDeltas++;
            } catch { /* Counts only; never record provider payloads or reasoning. */ }
          }
        }
        res.write(chunk);
      }
      res.end();
    } catch {
      result.failure = Date.now() - start >= 120000 ? "deadline" : "upstream_transport_failed";
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
  });
  try {
    await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
    const env = { ...process.env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: "#/home", CORTEX_LOCALE: "en", CORTEX_REAL_API_KEY: apiKey, CORTEX_TEST_PROVIDER_BASEURL: `${providerID}=http://127.0.0.1:${proxy.address().port}` };
    for (const key of ["CORTEX_CATALOG_URL", "CORTEX_RENDERER_URL", "DEBUG", "PWDEBUG", "NODE_OPTIONS"]) delete env[key];
    app = await electron.launch({ args: [path.join(root, "packages/desktop/dist/main.cjs"), ...(process.platform === "linux" ? ["--no-sandbox"] : [])], env, timeout: 30000 });
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.cortex?.request, null, { timeout: 30000 });
    await app.evaluate(({ safeStorage }, id) => {
      const key = process.env.CORTEX_REAL_API_KEY;
      delete process.env.CORTEX_REAL_API_KEY;
      const value = safeStorage.isEncryptionAvailable() ? "e:" + safeStorage.encryptString(key).toString("base64") : "p:" + Buffer.from(key).toString("base64");
      process.getBuiltinModule("fs").writeFileSync(process.env.CORTEX_DATA_DIR + "/credentials.json", JSON.stringify({ [id]: value }), { mode: 0o600 });
    }, providerID);
    const png = new PNG({ width: 128, height: 128 });
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const center = x >= 32 && x < 96 && y >= 32 && y < 96;
      const i = (y * 128 + x) * 4;
      png.data[i] = center ? 255 : 0; png.data[i + 1] = 0; png.data[i + 2] = center ? 0 : 255; png.data[i + 3] = 255;
    }
    const image = PNG.sync.write(png);
    report.image.sha256 = createHash("sha256").update(image).digest("hex");
    result.bridge = await page.evaluate(async ({ providerID, catalogModelID, image, prompt, remaining }) => {
      const call = async (url, method = "GET", body) => {
        const wire = await window.cortex.request({ url: `cortex://local${url}`, method, headers: [["content-type", "application/json"]], body: body === undefined ? undefined : JSON.stringify(body) });
        const value = wire.status === 204 ? null : JSON.parse(wire.body);
        if (wire.status >= 400) throw new Error("engine_request_failed");
        return value;
      };
      const entry = (await call(`/api/catalog/providers/${providerID}/models`)).find(item => item.id === catalogModelID);
      if (!entry?.capabilities.reasoning || !entry.capabilities.imageInput) return { failure: "catalog_capabilities_missing" };
      const cfg = await call(`/api/providers/${providerID}`);
      const bot = await call("/api/bots", "POST", { name: "Color verification", model: { providerID, modelID: catalogModelID }, tools: { allow: [] } });
      const session = await call(`/api/bots/${bot.id}/sessions`, "POST", {});
      const out = {
        catalog: { id: entry.id, capabilities: entry.capabilities, reasoningOptions: entry.reasoning_options ?? [] },
        keyAvailable: cfg.hasKey, keyFieldAbsent: !("key" in cfg),
        textDeltas: 0, reasoningDeltas: 0, textCharacters: 0, reasoningCharacters: 0, idle: false, toolParts: 0,
      };
      let ready, finish, pending = "";
      const connected = new Promise(resolve => { ready = resolve; });
      const done = new Promise(resolve => { finish = resolve; });
      const stop = window.cortex.events(chunk => {
        pending += chunk;
        const frames = pending.split("\n\n");
        pending = frames.pop();
        for (const frame of frames) {
          if (frame.startsWith(": connected")) ready();
          const data = frame.split("\n").find(line => line.startsWith("data:"))?.slice(5).trim();
          if (!data) continue;
          const event = JSON.parse(data), p = event.properties;
          if (p.sessionID !== session.id) continue;
          if (event.type === "part.delta" && (p.field === "text" || p.field === "reasoning") && p.delta.length) {
            out[`${p.field}Deltas`]++;
            out[`${p.field}Characters`] += p.delta.length;
          }
          if (event.type === "session.status") {
            if (p.status.type === "error") out.errorCode = p.status.error.code;
            if (p.status.type === "idle") { out.idle = true; finish(); }
          }
        }
      });
      let timer;
      try {
        await Promise.race([
          (async () => {
            await connected;
            await call(`/api/sessions/${session.id}/prompt`, "POST", { reasoning: true, parts: [{ type: "text", text: prompt }, { type: "file", mime: "image/png", filename: "colors.png", url: image }] });
            await done;
          })(),
          new Promise(resolve => { timer = globalThis.setTimeout(() => { out.failure = "deadline"; resolve(); }, remaining); }),
        ]);
        if (!out.idle) await call(`/api/sessions/${session.id}/abort`, "POST");
        const messages = await call(`/api/sessions/${session.id}/messages`);
        const parts = messages.filter(message => message.info.role === "assistant").flatMap(message => message.parts);
        out.publicAnswer = parts.filter(part => part.type === "text").map(part => part.text).join("");
        out.persistedTextParts = parts.filter(part => part.type === "text" && part.text.length).length;
        out.persistedReasoningParts = parts.filter(part => part.type === "reasoning" && part.text.length).length;
        out.toolParts = parts.filter(part => part.type === "tool").length;
        out.imagePersisted = messages.some(message => message.info.role === "user" && message.parts.some(part => part.type === "file" && part.mime === "image/png"));
      } finally {
        globalThis.clearTimeout(timer);
        stop();
      }
      return out;
    }, { providerID, catalogModelID, image: `data:image/png;base64,${image.toString("base64")}`, prompt, remaining: Math.max(1, 120000 - (Date.now() - start)) });
    let answer;
    try { answer = JSON.parse(result.bridge.publicAnswer?.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()); } catch { /* A non-JSON answer fails the objective check. */ }
    const b = result.bridge;
    result.checks = {
      catalog: !!b.catalog?.capabilities.reasoning && !!b.catalog?.capabilities.imageInput,
      image: !!b.imagePersisted && !!result.request?.image && answer?.background === "blue" && answer?.center === "red",
      streaming: b.textDeltas > 0 && b.reasoningDeltas > 0 && b.persistedTextParts > 0 && b.persistedReasoningParts > 0 && result.upstream.textDeltas > 0 && result.upstream.reasoningDeltas > 0,
      transport: result.upstreamRequests === 1 && result.upstream.status === 200 && result.upstream.streamed && result.request?.model === model,
      completion: b.idle && !b.errorCode && !b.failure && !result.failure && b.toolParts === 0 && result.request?.tools === 0 && Date.now() - start < 120000,
      credentials: b.keyAvailable && b.keyFieldAbsent,
    };
    result.passed = Object.values(result.checks).every(Boolean);
  } catch {
    result.failure ??= "verification_setup_or_bridge_failed";
    result.passed = false;
  } finally {
    if (app) await app.close().catch(() => app.process().kill("SIGKILL"));
    proxy.closeAllConnections();
    await new Promise(resolve => proxy.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
    result.temporaryDataRemoved = true;
    result.elapsedMs = Date.now() - start;
  }
  return result;
}

try {
  if (!apiKey || !baseURL || !["https:", "http:"].includes(new URL(baseURL).protocol)) throw new Error("credentials_missing_or_invalid");
  report.baseProtocol = new URL(baseURL).protocol.slice(0, -1).toUpperCase();
  report.build = { mainSha256: createHash("sha256").update(await readFile(path.join(root, "packages/desktop/dist/main.cjs"))).digest("hex") };
  // ponytail: bounded two-protocol probe, no automatic retries. Add another model only for a separate explicit verification task.
  for (const args of [["openai", "gpt-6-astra", "/responses"], ["nano-gpt", "openai/gpt-6-astra", "/chat/completions"]]) {
    const result = await attempt(...args);
    if (result.passed) { report.passed = true; break; }
    if ([401, 403, 429].includes(result.upstream.status) || result.failure) break;
  }
} catch {
  report.failure = "credentials_or_build_unavailable";
}
let evidence = JSON.stringify(report, null, 2);
for (const secret of [apiKey, baseURL].filter(Boolean)) evidence = evidence.replaceAll(secret, "[redacted]");
await mkdir(path.join(root, "evidence"), { recursive: true });
await writeFile(path.join(root, "evidence/real-provider.json"), evidence + "\n");
console.log(JSON.stringify({ passed: report.passed, attempts: report.attempts.map(a => ({ protocol: a.protocol, status: a.upstream.status, passed: a.passed, failure: a.failure, checks: a.checks })), evidence: "evidence/real-provider.json" }));
process.exitCode = report.passed ? 0 : 1;
