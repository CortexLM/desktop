// The models.list() call goes through the real Cortex SDK. Without CORTEX_TEST_BACKEND_URL a local stub backend answers;
// with it set (e.g. http://127.0.0.1:8080 from the backend's scripts/sdk-local-backend.sh) the call hits a real backend.
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { probeRemote } from "../src/remote";

let stub: http.Server; let url = "";
const seen: string[] = [];
beforeAll(async () => {
  stub = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    if (req.url === "/readyz") return res.end("ok");
    if (req.url === "/v1/instance") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ mode: "self_host", auth: { mode: "none", required: false, providers: [] }, version: "test" })); }
    if (req.url?.startsWith("/v1/models")) { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ items: [{ slug: "fast", name: "Fast" }] })); }
    res.statusCode = 404; res.end();
  });
  await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(stub.address() as { port: number }).port}`;
});
afterAll(() => stub.close());

describe("remote backend through the Cortex SDK", () => {
  it("probes readiness, reads the instance auth mode and lists models", async () => {
    const r = await probeRemote(url);
    expect(r).toEqual({ status: "reachable", authRequired: false, models: [{ id: "fast", name: "Fast" }] });
    expect(seen).toEqual(["GET /readyz", "GET /v1/instance", "GET /v1/models"]);
  });
  it("reports an unreachable backend", async () => {
    expect(await probeRemote("http://127.0.0.1:1")).toEqual({ status: "unreachable" });
  });
  it.skipIf(!process.env.CORTEX_TEST_BACKEND_URL)("lists models from a real backend", async () => {
    const r = await probeRemote(process.env.CORTEX_TEST_BACKEND_URL!);
    console.log("real backend:", JSON.stringify(r).slice(0, 300));
    expect(r.status).toBe("reachable");
  });
});
