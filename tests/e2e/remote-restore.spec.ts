import { _electron as electron, test, expect, type ElectronApplication, type Page } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RemoteAuthState } from "@cortex/schema";
import { root } from "./fixtures";

const account = "usr_00000000000000000000000001";

// Controlled HTTP backend fixture, not a real Cortex Cloud account.
async function backend() {
  const state = { version: 0, access: "", revoked: false };
  const seen: { path: string; authorization?: string }[] = [];
  const json = (res: http.ServerResponse, body: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const pair = (res: http.ServerResponse) => {
    state.version++;
    state.access = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, version: state.version })).toString("base64url")}.fixture`;
    json(res, { access_token: state.access, refresh_token: `fixture-refresh-${state.version}`, token_type: "Bearer" });
  };
  const server = http.createServer((req, res) => { void (async () => {
    let text = ""; for await (const chunk of req) text += chunk;
    const route = new URL(req.url!, "http://127.0.0.1").pathname;
    seen.push({ path: route, authorization: req.headers.authorization });
    const bearer = !state.revoked && req.headers.authorization === `Bearer ${state.access}`;
    if (route === "/readyz") return void res.end("ok");
    if (route === "/v1/instance") return json(res, { mode: "self_host", version: "test", auth: { mode: "cortex", required: true, providers: ["cortex"] }, registry: { enabled: true } });
    if (route === "/v1/registry/models") return json(res, { items: [], has_more: false, source: "cache" });
    if (route === "/v1/auth/device") return json(res, { device_code: "fixture-private-device", user_code: "TEST-CODE", verification_uri: "https://verify.example.test", verification_uri_complete: "https://verify.example.test/approve", expires_in: 600, interval: 1 });
    if (route === "/v1/auth/device/token") return pair(res);
    if (route === "/v1/auth/refresh") return !state.revoked && JSON.parse(text).refresh_token === `fixture-refresh-${state.version}` ? pair(res) : json(res, {}, 401);
    if (route === "/v1/me") return bearer ? json(res, { id: account, email: "restore@example.test" }) : json(res, {}, 401);
    if (route === "/v1/code/capabilities") return bearer ? json(res, { runtimes: { available: false, unavailable_reason: "code_compute_not_configured" } }) : json(res, {}, 401);
    json(res, { error: "not_found" }, 404);
  })().catch(() => { if (!res.destroyed) { res.statusCode = 500; res.end(); } }); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, state, seen,
    count: (route: string) => seen.filter((r) => r.path === route).length,
    close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }) };
}

async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<{ status: number; body: T }> {
  return page.evaluate(async ({ route, method, body }) => {
    const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }, { route, method, body });
}
const auth = async (page: Page) => (await call<RemoteAuthState>(page, "/api/connection/auth")).body;

test("restores saved remote credentials after restart and erases revoked ones", async () => {
  const fixture = await backend();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-e2e-restore-"));
  // Playwright's Electron loader forces mock/basic credential storage; this entry restores the OS secret store,
  // which is the only store main accepts for refresh tokens.
  const entry = path.join(dataDir, "entry.cjs");
  fs.writeFileSync(entry, `const { app } = require("electron");\napp.commandLine.removeSwitch("password-store");\napp.commandLine.removeSwitch("use-mock-keychain");\nif (process.platform === "linux") app.commandLine.appendSwitch("password-store", "gnome-libsecret");\nrequire(${JSON.stringify(path.join(root, "packages/desktop/dist/main.cjs"))});\n`);
  const start = async (): Promise<{ app: ElectronApplication; page: Page }> => {
    const app = await electron.launch({
      args: [entry, `--user-data-dir=${path.join(dataDir, "renderer")}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
      env: { ...process.env, CORTEX_DATA_DIR: path.join(dataDir, "engine"), CORTEX_LOCALE: "en", CORTEX_CATALOG_URL: "data:application/json,{}", CORTEX_TEST_PROVIDER_BASEURL: "" } as Record<string, string>,
    });
    const page = await app.firstWindow();
    await page.waitForFunction(() => "__bridgeFetch" in window, null, { timeout: 30_000 });
    return { app, page };
  };
  const store = path.join(dataDir, "engine", "remote-credentials.json");
  const saved = () => fs.existsSync(store) ? fs.readFileSync(store, "utf8") : "";
  let { app, page } = await start();
  try {
    const encrypted = await app.evaluate(({ safeStorage }) => safeStorage.isEncryptionAvailable() && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text"));
    expect((await call(page, "/api/connection", "PUT", { mode: "selfhost", url: fixture.origin, signedIn: false })).status).toBe(200);
    const pending = (await call<RemoteAuthState>(page, "/api/connection/auth", "POST", { action: "device", owner: (await auth(page)).owner })).body;
    // The grant's poll interval is one second: advance main's clock for one poll instead of sleeping.
    await app.evaluate(() => { const real = Date.now; Object.assign(globalThis, { realNow: real }); Date.now = () => real() + 1001; });
    const polled = await call<RemoteAuthState>(page, "/api/connection/auth", "POST", { action: "device_poll", owner: pending.owner });
    await app.evaluate(() => { Date.now = (globalThis as unknown as { realNow: () => number }).realNow; });
    expect(fixture.count("/v1/auth/device/token")).toBe(1);

    if (!encrypted) {
      // Linux basic_text: a refresh token is never written, so a restart has nothing to restore.
      expect(polled.body.signedIn ?? false).toBe(false);
      expect(saved()).not.toContain("fixture-refresh");
      await app.close(); ({ app, page } = await start());
      expect((await auth(page)).signedIn).toBe(false);
      expect(fixture.count("/v1/auth/refresh")).toBe(0);
      test.info().annotations.push({ type: "credential-store", description: "unencrypted backend: refusal path only" });
      return;
    }

    expect(polled.body).toMatchObject({ status: "signed_in", signedIn: true, email: "restore@example.test" });
    expect(saved()).toMatch(/"remote-session":"[ed]:/);
    expect(saved()).not.toContain("fixture-refresh");
    expect(saved()).not.toContain(account);

    await app.close(); ({ app, page } = await start());
    expect(await auth(page)).toMatchObject({ status: "signed_in", signedIn: true, email: "restore@example.test" });
    expect(fixture.count("/v1/auth/refresh")).toBe(1);
    expect(fixture.count("/v1/auth/device")).toBe(1);
    const capabilities = await call<{ cloud: unknown }>(page, "/api/code/capabilities");
    expect(capabilities).toMatchObject({ status: 200, body: { cloud: { available: false, reason: "code_compute_not_configured" } } });
    expect(fixture.state.version).toBe(2);
    expect(fixture.seen.filter((r) => r.path === "/v1/code/capabilities").at(-1)?.authorization).toBe(`Bearer ${fixture.state.access}`);

    fixture.state.revoked = true;
    await app.close(); ({ app, page } = await start());
    expect((await auth(page)).signedIn).toBe(false);
    expect(fixture.count("/v1/auth/refresh")).toBe(2);
    expect(saved()).not.toContain("remote-session");
    expect(fixture.count("/v1/auth/device")).toBe(1);
    expect((await call(page, "/api/code/capabilities")).status).toBeGreaterThanOrEqual(400);
  } finally {
    await app.close().catch(() => undefined);
    await fixture.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
