// Discovery and model calls use the real Cortex SDK against HTTP, including refusal and timeout paths.
import http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { probeRemote } from "../src/remote";

let stub: http.Server; let redirectTarget: http.Server; let url = ""; let redirectUrl = "";
const seen: string[] = [];
let redirectHits = 0;
const routes = new Map<string, (res: http.ServerResponse, target: URL) => void>();
const cloud = { mode: "cloud", auth: { mode: "cortex", required: true, providers: ["cortex", "guest"] }, version: "test", registry: { enabled: false } };
const selfhost = { mode: "self_host", auth: { mode: "none", required: false, providers: [] }, version: "test", registry: { enabled: true } };
const cloudModels = { items: [{ slug: "fast", display_name: "Cortex Fast", name: "Wrong name" }], has_more: false };
const registryModels = { items: [{ id: "local/fast", name: "Local Fast", configured: true }], has_more: false, source: "cache" };
const json = (body: unknown, status = 200) => (res: http.ServerResponse) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const listen = async (server: http.Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
};
beforeAll(async () => {
  stub = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    const target = new URL(req.url!, url);
    const reply = routes.get(target.pathname);
    if (reply) return reply(res, target);
    res.statusCode = 404; res.end();
  });
  redirectTarget = http.createServer((_req, res) => { redirectHits++; res.end("unexpected request"); });
  [url, redirectUrl] = await Promise.all([listen(stub), listen(redirectTarget)]);
});
beforeEach(() => {
  seen.length = 0;
  redirectHits = 0;
  routes.clear();
  routes.set("/readyz", (res) => { res.end("ok"); });
  routes.set("/v1/instance", json(cloud));
  routes.set("/v1/models", json(cloudModels));
  routes.set("/v1/registry/models", json(registryModels));
});
afterAll(async () => {
  await Promise.all([stub, redirectTarget].map((server) => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close((err) => err ? reject(err) : resolve());
  })));
});

describe("remote backend through the Cortex SDK", () => {
  it("reads Cloud display names without claiming authentication from a supplied token", async () => {
    routes.set("/v1/instance", (res) => {
      res.setHeader("set-cookie", "cortex_gt=test-probe-cookie; HttpOnly; Path=/");
      json(cloud)(res);
    });
    const transport: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      expect(new URL(request.url).origin).toBe(url);
      expect(request.redirect).toBe("error");
      expect(request.credentials).toBe("omit");
      expect(request.headers.has("cookie")).toBe(false);
      expect(request.headers.has("authorization")).toBe(new URL(request.url).pathname !== "/readyz");
      expect(request.signal).toBeDefined();
      return fetch(request);
    };
    expect(await probeRemote(`${url}/`, { token: "test-probe-token", fetch: transport })).toEqual({
      status: "reachable", authRequired: true, models: [{ id: "fast", name: "Cortex Fast" }],
    });
    expect(seen).toEqual(["GET /readyz", "GET /v1/instance", "GET /v1/models"]);
  });

  it.each([true, false])("reads configured self-host models across pages when registry.enabled=%s", async (enabled) => {
    routes.set("/v1/instance", json({ ...selfhost, registry: { enabled } }));
    routes.set("/v1/registry/models", (res, target) => {
      expect(target.searchParams.get("configured")).toBe("true");
      expect(target.searchParams.get("limit")).toBe("500");
      json(target.searchParams.has("cursor")
        ? { ...registryModels, source: "unavailable", items: [{ id: "local/other", name: "Other model", configured: true }] }
        : { ...registryModels, has_more: true, next_cursor: "page-two" })(res);
    });
    expect(await probeRemote(url)).toEqual({
      status: "reachable", authRequired: false,
      models: [{ id: "local/fast", name: "Local Fast" }, { id: "local/other", name: "Other model" }],
    });
    expect(seen).toEqual([
      "GET /readyz", "GET /v1/instance", "GET /v1/registry/models?configured=true&limit=500",
      "GET /v1/registry/models?configured=true&limit=500&cursor=page-two",
    ]);
  });

  it("uses legacy Cloud discovery only when instance is missing", async () => {
    routes.delete("/v1/instance");
    expect(await probeRemote(url)).toEqual({ status: "reachable", authRequired: true, models: [{ id: "fast", name: "Cortex Fast" }] });
    expect(seen).toContain("GET /v1/models");
  });

  it.each([401, 403])("reports protected discovery as reachable with authentication required (%s)", async (status) => {
    for (const path of ["/v1/instance", "/v1/models", "/v1/registry/models"]) {
      seen.length = 0;
      routes.set("/v1/instance", json(path === "/v1/registry/models"
        ? { ...selfhost, auth: { mode: "local", required: true, providers: ["local"] } } : cloud));
      routes.set("/v1/models", json(cloudModels));
      routes.set(path, json({ error: "not exposed" }, status));
      expect(await probeRemote(url)).toEqual({ status: "reachable", authRequired: true, models: [] });
      expect(seen.at(-1)?.split("?")[0]).toBe(`GET ${path}`);
    }
  });

  it.each([null, {}, { auth: { required: false } }, { ...cloud, mode: "unknown" },
    { ...cloud, auth: { ...cloud.auth, mode: "unknown" } }, { ...selfhost, registry: undefined },
    { ...selfhost, auth: { ...selfhost.auth, required: true } }, { ...cloud, auth: selfhost.auth },
  ])("rejects malformed or inconsistent instance replies %#", async (body) => {
    routes.set("/v1/instance", json(body));
    expect(await probeRemote(url)).toEqual({ status: "incompatible" });
    expect(seen).toEqual(["GET /readyz", "GET /v1/instance"]);
  });

  it.each([204, 500])("does not fall back after an instance response with status %s", async (status) => {
    routes.set("/v1/instance", json({}, status));
    expect(await probeRemote(url)).toEqual({ status: "incompatible" });
    expect(seen).toEqual(["GET /readyz", "GET /v1/instance"]);
  });

  it.each([401, 404])("ignores a problem body claiming status %s on HTTP 500", async (status) => {
    routes.set("/v1/instance", json({ type: "about:blank", title: "Failure", request_id: "req_test", status, code: "not_found" }, 500));
    expect(await probeRemote(url)).toEqual({ status: "incompatible" });
    expect(seen).toEqual(["GET /readyz", "GET /v1/instance"]);
  });

  it.each([null, {}, { items: [] }, { items: [null], has_more: false },
    { items: [{ slug: 1, display_name: "Fast" }], has_more: false },
    { items: [{ slug: "fast", name: "Fast" }], has_more: false },
  ])("rejects malformed Cloud model replies %#", async (body) => {
    routes.set("/v1/models", json(body));
    expect(await probeRemote(url)).toEqual({ status: "incompatible" });
  });

  it.each([{}, { ...registryModels, items: [{ id: "local/fast", name: "Fast", configured: false }] },
    { ...registryModels, has_more: true }, { ...registryModels, has_more: true, next_cursor: "repeated" },
  ])("rejects malformed or cycling registry pages without Cloud fallback %#", async (body) => {
    routes.set("/v1/instance", json(selfhost));
    routes.set("/v1/registry/models", json(body));
    expect(await probeRemote(url)).toEqual({ status: "incompatible" });
    expect(seen).not.toContain("GET /v1/models");
    expect(seen.length).toBeLessThanOrEqual(4);
  });

  it("does not replace a missing self-host registry with seeded Cloud models", async () => {
    routes.set("/v1/instance", json(selfhost));
    routes.delete("/v1/registry/models");
    expect(await probeRemote(url)).toEqual({ status: "incompatible" });
    expect(seen).not.toContain("GET /v1/models");
  });

  it.each(["file:///", "ftp://example.test", "not a URL", "https://user:password@example.test", "https://example.test/prefix", "https://example.test/?q=1", "https://example.test/#fragment", "https://example.test/?", "https://example.test/#"])("rejects an invalid backend URL before transport %#", async (input) => {
    const transport = vi.fn<typeof fetch>();
    expect(await probeRemote(input, { fetch: transport })).toEqual({ status: "incompatible" });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each(["/readyz", "/v1/instance", "/v1/models", "/v1/registry/models"])("refuses redirects at %s without contacting another server", async (path) => {
    if (path === "/v1/registry/models") routes.set("/v1/instance", json(selfhost));
    routes.set(path, (res) => { res.writeHead(307, { location: `${redirectUrl}/target` }); res.end(); });
    expect((await probeRemote(url, { token: "test-probe-token" })).status).not.toBe("reachable");
    expect(redirectHits).toBe(0);
  });

  it("times out a model listing whose JSON body never completes", async () => {
    routes.set("/v1/models", (res) => { res.writeHead(200, { "content-type": "application/json" }); res.write('{"items":'); });
    expect(await probeRemote(url)).toEqual({ status: "unreachable" });
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
