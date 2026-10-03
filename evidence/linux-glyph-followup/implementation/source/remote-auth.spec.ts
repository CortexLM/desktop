import { _electron as electron, test, expect, type ElectronApplication, type Page } from "@playwright/test";
import http from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ConnectionMode, RemoteAuthInput, RemoteAuthState } from "@cortex/schema";
import { launch, root } from "./fixtures";

const env = { CORTEX_CATALOG_URL: "data:application/json,{}", CORTEX_TEST_PROVIDER_BASEURL: "" };
const EMAIL_PATH = "/v1/auth/magic-auth", CODE_PATH = "/v1/auth/magic-auth/verify";
const LOGOUT_PATH = "/v1/auth/logout";
const CODE = "123456", WRONG_CODE = "000000";
const PRIVATE_ERROR = "test-only-private-auth-detail";
const SESSION_COPY = "Sign-in lasts until Cortex closes. Chats still use your local provider settings.";
const CONTINUATION_COPY = "This sign-in step isn’t available in Cortex yet. Use another address or cancel.";
type Seen = { method: string; path: string; body: Record<string, unknown>; cookie?: string; authorization?: string };

// Controlled HTTP backend fixture, not a real Cortex Cloud account. The app's actual SDK/engine handles every response.
async function authBackend(tag: string) {
  const privateValues = [`test-only-${tag}-access`, `test-only-${tag}-refresh`, `test-only-${tag}-pending`, `test-only-${tag}-challenge`, `test-only-${tag}-factor`, `test-only-${tag}-qr`, `test-only-${tag}-totp`, PRIVATE_ERROR];
  const seen: Seen[] = [], pending: (() => void)[] = [], errors: string[] = [];
  const state = { failSend: false, holdCode: false, finishedCodes: 0 };
  const json = (res: http.ServerResponse, body: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const session = (res: http.ServerResponse) => {
    res.setHeader("set-cookie", `cortex_rt=${privateValues[1]}; HttpOnly; SameSite=Lax; Path=/v1/auth; Max-Age=3600`);
    json(res, { status: "session", access_token: privateValues[0] });
  };
  const problem = (res: http.ServerResponse, status: number, code: string) => {
    res.writeHead(status, { "content-type": "application/problem+json" });
    res.end(JSON.stringify({ type: "about:blank", title: "Authentication refused", status, code, request_id: "req_test_auth", detail: PRIVATE_ERROR }));
  };
  const server = http.createServer((req, res) => { void (async () => {
    let text = ""; for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) as Record<string, unknown> : {};
    const route = new URL(req.url!, "http://127.0.0.1").pathname;
    seen.push({ method: req.method!, path: route, body, cookie: req.headers.cookie, authorization: req.headers.authorization });
    if (route === "/readyz") { res.end("ok"); return; }
    if (route === "/v1/instance") return json(res, { mode: "self_host", version: "test", auth: { mode: "cortex", required: true, providers: ["cortex"] }, registry: { enabled: true } });
    if (route === "/v1/registry/models") return json(res, { items: [], has_more: false, source: "cache" });
    if (req.method === "POST" && route === EMAIL_PATH) {
      if (state.failSend) return problem(res, 429, "rate_limited");
      res.writeHead(204); res.end(); return;
    }
    if (req.method === "POST" && route === CODE_PATH) {
      if (state.holdCode) await new Promise<void>((resolve) => pending.push(resolve));
      state.finishedCodes++;
      if (res.destroyed) return;
      if (body.code !== CODE) return problem(res, 401, "invalid_credential");
      if (body.email === "mfa@example.test") return json(res, {
        status: "mfa_enrollment", pending_authentication_token: privateValues[2], authentication_challenge_id: privateValues[3],
        authentication_factor_id: privateValues[4], qr_code: privateValues[5], totp_secret: privateValues[6],
      });
      if (body.email === "verify@example.test") return json(res, { status: "verify_email", email: body.email, pending_authentication_token: privateValues[2] });
      return session(res);
    }
    if (req.method === "POST" && route === LOGOUT_PATH) {
      res.setHeader("set-cookie", "cortex_rt=; HttpOnly; Path=/v1/auth; Max-Age=0"); res.writeHead(204); res.end(); return;
    }
    errors.push(`Unexpected fixture request: ${req.method} ${route}`); problem(res, 404, "not_found");
  })().catch((error: unknown) => { errors.push(String(error)); if (!res.destroyed) { res.statusCode = 500; res.end(); } }); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const release = () => { state.holdCode = false; pending.splice(0).forEach((resolve) => resolve()); };
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, seen, state, errors, privateValues,
    count: (route: string) => seen.filter((r) => r.path === route).length, held: () => pending.length, release,
    close: async () => { release(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); } };
}

async function request(page: Page, route: string, method = "GET", body?: unknown) {
  return page.evaluate(async ({ route, method, body }) => {
    const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, headers: [...response.headers], body: await response.json() };
  }, { route, method, body });
}
async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<T> {
  const response = await request(page, route, method, body);
  expect(response.status).toBeGreaterThanOrEqual(200); expect(response.status).toBeLessThan(300);
  return response.body;
}
const submit = (page: Page, body: RemoteAuthInput) => call<RemoteAuthState>(page, "/api/connection/auth", "POST", body);
async function authState(page: Page) {
  const state = await call<RemoteAuthState>(page, "/api/connection/auth");
  expect(Object.keys(state).sort()).toEqual((state.email === undefined ? ["signedIn", "status"] : ["email", "signedIn", "status"]).sort());
  return state;
}
async function select(page: Page, origin: string) {
  const connection = await call<ConnectionMode>(page, "/api/connection", "PUT", { mode: "selfhost", url: origin, signedIn: true });
  expect(connection).toEqual({ mode: "selfhost", url: origin, signedIn: false });
}
async function show(page: Page, route: string, theme = "light") {
  await page.evaluate(({ route, theme }) => history.pushState(null, "", `#/${route}${route.includes("?") ? "&" : "?"}theme=${theme}`), { route, theme });
}
async function sendEmail(page: Page, email: string) {
  await page.getByRole("textbox", { name: "Email address", exact: true }).fill(email);
  await page.getByRole("button", { name: "Get a code", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toBeVisible();
}
async function enterCode(page: Page, code = CODE) {
  await page.getByRole("textbox", { name: "6-digit code", exact: true }).fill(code);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
async function capture(page: Page, name: string) {
  const file = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path: file, animations: "disabled" });
  await test.info().attach(name, { path: file, contentType: "image/png" });
}
function watch(page: Page, errors: string[], rendererHttp: string[]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => { if (/^https?:/.test(req.url())) rendererHttp.push(req.url()); });
}
async function privateStateStaysInMain(app: ElectronApplication, page: Page, privateValues: string[], rendererHttp: string[]) {
  const wire = await request(page, "/api/connection/auth");
  expect(wire.status).toBe(200);
  await authState(page);
  const browser = await page.evaluate(async () => ({
    html: document.documentElement.outerHTML, local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie,
    indexedDB: await indexedDB.databases(), caches: typeof caches === "undefined" ? [] : await caches.keys(),
  }));
  const cookies = await app.context().cookies();
  const publicSnapshot = JSON.stringify({ wire, browser, cookies });
  for (const value of privateValues) expect(publicSnapshot).not.toContain(value);
  expect(wire.headers.map(([name]) => name)).not.toContain("set-cookie");
  expect(browser.indexedDB).toEqual([]); expect(browser.caches).toEqual([]); expect(cookies).toEqual([]);
  expect(rendererHttp).toEqual([]);
}
async function reopen(dataDir: string, theme: string) {
  const app = await electron.launch({ args: [path.join(root, "packages/desktop/dist/main.cjs"), `--user-data-dir=${path.join(dataDir, "renderer")}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env: { ...process.env, ...env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: `#/login?theme=${theme}`, CORTEX_LOCALE: "en" } as Record<string, string> });
  const page = await app.firstWindow();
  await page.waitForFunction(() => "__bridgeFetch" in window);
  return { app, page };
}

for (const theme of ["light", "dark"]) {
  test(`Email code sign-in retains refusal, submits once, reloads and signs out — 960 ${theme}`, async () => {
    const backend = await authBackend(theme);
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env });
    const errors: string[] = [], rendererHttp: string[] = [];
    watch(page, errors, rendererHttp);
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await select(page, backend.origin); await show(page, "login", theme);
      backend.state.failSend = true;
      await page.getByRole("textbox", { name: "Email address", exact: true }).fill("person@example.test");
      await page.getByRole("button", { name: "Get a code", exact: true }).click();
      await expect(page.getByText("Couldn’t send a code. Try again.", { exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(PRIVATE_ERROR);
      await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toHaveValue("person@example.test");
      expect((await authState(page)).signedIn).toBe(false);
      backend.state.failSend = false;
      await sendEmail(page, "person@example.test");
      expect(await authState(page)).toEqual({ status: "code_sent", signedIn: false, email: "person@example.test" });
      await page.getByRole("button", { name: "Resend the code", exact: true }).click();
      await expect.poll(() => backend.count(EMAIL_PATH)).toBe(3);
      const code = page.getByRole("textbox", { name: "6-digit code", exact: true });
      await code.fill(WRONG_CODE);
      expect(backend.count(CODE_PATH)).toBe(0);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByText("Couldn’t sign in. Check your details and try again.", { exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(PRIVATE_ERROR);
      await expect(code).toHaveValue(WRONG_CODE); await expect(code).toBeEditable();
      await capture(page, `remote-code-refused-${theme}`);
      backend.state.holdCode = true;
      await code.fill(CODE);
      await page.getByRole("button", { name: "Continue", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect.poll(() => backend.held()).toBe(1);
      expect(backend.count(CODE_PATH)).toBe(2);
      await expect(code).toBeDisabled(); await expect(code).toHaveValue(CODE);
      expect((await call<ConnectionMode>(page, "/api/connection")).signedIn).toBe(false);
      backend.release();
      await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
      await expect(page.getByText(SESSION_COPY, { exact: true })).toBeVisible();
      expect(await authState(page)).toEqual({ status: "signed_in", signedIn: true, email: "person@example.test" });
      expect((await call<ConnectionMode>(page, "/api/connection")).signedIn).toBe(true);
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      await capture(page, `remote-signed-in-${theme}`);
      await page.reload();
      await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Open connection settings", exact: true }).click();
      await expect(page.getByTestId("connection-mode-selfhost")).toHaveAttribute("aria-checked", "true");
      await expect(page.getByTestId("selfhost-url")).toHaveValue(backend.origin);
      await show(page, "settings?section=account", theme);
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect.poll(async () => (await authState(page)).status).toBe("signed_out");
      expect((await call<ConnectionMode>(page, "/api/connection")).signedIn).toBe(false);
      // This bounded Cloud-style session signs out on the device; server revocation is not yet admitted.
      expect(backend.count(LOGOUT_PATH)).toBe(0);
      await show(page, "login", theme); await sendEmail(page, "person@example.test");
      const fresh = backend.seen.filter((r) => r.path === EMAIL_PATH).at(-1)!;
      expect(fresh.cookie).toBeUndefined(); expect(fresh.authorization).toBeUndefined();
      await page.getByRole("button", { name: "Use another address", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
      expect((await authState(page)).status).toBe("signed_out");
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
    } finally { backend.release(); await app.close(); await backend.close(); }
  });

  test(`Unavailable continuations and cancelled codes stay private; restart clears login — 960 ${theme}`, async () => {
    const backend = await authBackend(`continuation-${theme}`);
    const first = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env });
    let app: ElectronApplication | undefined = first.app, page = first.page;
    const errors: string[] = [], rendererHttp: string[] = [];
    watch(page, errors, rendererHttp);
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await select(page, backend.origin); await show(page, "login", theme);
      await sendEmail(page, "mfa@example.test"); await enterCode(page);
      await expect(page.getByText(CONTINUATION_COPY, { exact: true })).toBeVisible();
      expect(await authState(page)).toMatchObject({ status: "mfa_enrollment", signedIn: false });
      expect((await call<ConnectionMode>(page, "/api/connection")).signedIn).toBe(false);
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      await capture(page, `remote-mfa-unavailable-${theme}`);
      await page.getByRole("button", { name: "Use another address", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
      expect((await authState(page)).status).toBe("signed_out");
      await sendEmail(page, "verify@example.test"); await enterCode(page);
      await expect(page.getByText(CONTINUATION_COPY, { exact: true })).toBeVisible();
      expect(await authState(page)).toEqual({ status: "verify_email", signedIn: false, email: "verify@example.test" });
      expect((await call<ConnectionMode>(page, "/api/connection")).signedIn).toBe(false);
      await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toHaveCount(0);
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      await capture(page, `remote-verification-unavailable-${theme}`);
      await page.getByRole("button", { name: "Use another address", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
      expect((await authState(page)).status).toBe("signed_out");

      await sendEmail(page, "person@example.test");
      backend.state.holdCode = true;
      await enterCode(page);
      await expect.poll(() => backend.held()).toBe(1);
      const cancel = page.getByRole("button", { name: "Cancel", exact: true });
      await expect(cancel).toBeEnabled();
      await cancel.click();
      await expect(page).toHaveURL(/#\/home(?:\?|$)/);
      await expect.poll(async () => (await authState(page)).status).toBe("signed_out");
      const finishedBeforeRelease = backend.state.finishedCodes;
      backend.release();
      await expect.poll(() => backend.state.finishedCodes).toBe(finishedBeforeRelease + 1);
      expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false });
      await show(page, "login", theme);
      await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
      expect((await call<ConnectionMode>(page, "/api/connection")).signedIn).toBe(false);
      await sendEmail(page, "person@example.test");
      const retry = backend.seen.filter((r) => r.path === EMAIL_PATH).at(-1)!;
      expect(retry.cookie).toBeUndefined(); expect(retry.authorization).toBeUndefined();
      await enterCode(page);
      await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      if (theme === "light") { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900)); await capture(page, "remote-signed-in-1440-light"); }
      await page.evaluate(() => localStorage.setItem("cortex-test-restart-marker", "retained-profile"));
      await app.close(); app = undefined;
      for (const entry of readdirSync(first.dataDir, { withFileTypes: true })) if (entry.isFile()) {
        const bytes = readFileSync(path.join(first.dataDir, entry.name));
        for (const value of backend.privateValues) expect(bytes.includes(Buffer.from(value)), `${entry.name} must not persist remote authentication material`).toBe(false);
      }
      const restarted = await reopen(first.dataDir, theme); app = restarted.app; page = restarted.page;
      watch(page, errors, rendererHttp);
      expect(await page.evaluate(() => localStorage.getItem("cortex-test-restart-marker"))).toBe("retained-profile");
      expect(await call<ConnectionMode>(page, "/api/connection")).toEqual({ mode: "selfhost", url: backend.origin, signedIn: false });
      expect((await authState(page)).status).toBe("signed_out");
      await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
      await sendEmail(page, "person@example.test");
      const fresh = backend.seen.filter((r) => r.path === EMAIL_PATH).at(-1)!;
      expect(fresh.cookie).toBeUndefined(); expect(fresh.authorization).toBeUndefined();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect.poll(async () => (await authState(page)).status).toBe("signed_out");
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
    } finally { backend.release(); await app?.close(); await backend.close(); }
  });
}

test("Mode and origin changes reject late auth replies and never reuse another origin’s credentials", async () => {
  const a = await authBackend("origin-a"), b = await authBackend("origin-b");
  const { app, page } = await launch({ hash: "#/home", locale: "en", env });
  const errors: string[] = [], rendererHttp: string[] = [];
  watch(page, errors, rendererHttp);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await select(page, a.origin); await show(page, "login");
    await sendEmail(page, "person@example.test"); await enterCode(page);
    await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
    await select(page, b.origin); await page.reload();
    await sendEmail(page, "person@example.test");
    b.state.holdCode = true;
    const pendingMode = request(page, "/api/connection/auth", "POST", { action: "code", code: CODE });
    await expect.poll(() => b.held()).toBe(1);
    await call(page, "/api/connection", "PUT", { mode: "local", signedIn: true });
    b.release();
    expect((await pendingMode).status).toBeGreaterThanOrEqual(400);
    await show(page, "settings?section=connection");
    await expect(page.getByTestId("connection-mode-local")).toHaveAttribute("aria-checked", "true");
    expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false });
    expect(await call<ConnectionMode>(page, "/api/connection")).toEqual({ mode: "local", signedIn: false });
    await select(page, a.origin); await show(page, "login");
    await sendEmail(page, "person@example.test");
    a.state.holdCode = true;
    const pendingOrigin = request(page, "/api/connection/auth", "POST", { action: "code", code: CODE });
    await expect.poll(() => a.held()).toBe(1);
    await select(page, b.origin); a.release();
    expect((await pendingOrigin).status).toBeGreaterThanOrEqual(400);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
    expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false });
    await sendEmail(page, "person@example.test");
    expect(b.seen.length).toBeGreaterThan(0);
    for (const entry of b.seen) { expect(entry.cookie).toBeUndefined(); expect(entry.authorization).toBeUndefined(); }
    const lastAEmail = a.seen.filter((r) => r.path === EMAIL_PATH).at(-1)!;
    expect(lastAEmail.cookie).toBeUndefined(); expect(lastAEmail.authorization).toBeUndefined();
    await submit(page, { action: "cancel" });
    await privateStateStaysInMain(app, page, [...a.privateValues, ...b.privateValues], rendererHttp);
    expect(errors).toEqual([]); expect(a.errors).toEqual([]); expect(b.errors).toEqual([]);
  } finally { a.release(); b.release(); await app.close(); await Promise.all([a.close(), b.close()]); }
});

test("Initial connection and auth reads protect selection, canonical sign-in and cancellation", async () => {
  const backend = await authBackend("read-races");
  const { app, page } = await launch({ hash: "#/home?theme=light", locale: "en", env });
  const errors: string[] = [], rendererHttp: string[] = [];
  watch(page, errors, rendererHttp);
  type WireRequest = { url: string; method: string; headers: [string, string][]; body?: string };
  type WireResponse = { status: number; headers: [string, string][]; body: string };
  type ReadBarrier = {
    next?: string; held?: { path: string; response: WireResponse }; release?: () => void;
    requests: { method: string; path: string; action?: string }[];
  };
  const releaseRead = () => app.evaluate(() => {
    const barrier = (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier;
    barrier.next = undefined; barrier.release?.(); barrier.release = undefined; barrier.held = undefined;
  });
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const canonical = "https://api.cortex.foundation", equivalent = "https://API.CORTEX.FOUNDATION:443/";
    expect(await call<ConnectionMode>(page, "/api/connection", "PUT", { mode: "selfhost", url: equivalent, signedIn: false }))
      .toEqual({ mode: "selfhost", url: canonical, signedIn: false });
    await show(page, "settings?section=connection");
    await expect(page.getByTestId("selfhost-url")).toHaveValue(canonical);
    await app.evaluate(({ ipcMain }) => {
      const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (event: unknown, request: WireRequest) => Promise<WireResponse>> })._invokeHandlers.get("cortex:fetch")!;
      const barrier: ReadBarrier = { next: "/api/connection", requests: [] };
      (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier = barrier;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
        const path = new URL(request.url).pathname;
        barrier.requests.push({ method: request.method, path, ...(path === "/api/connection/auth" && request.method === "POST" ? { action: JSON.parse(request.body!).action } : {}) });
        const response = await original(event, request);
        if (request.method === "GET" && barrier.next === path) {
          barrier.next = undefined;
          barrier.held = { path, response };
          // Delay only the completed real response; direct follow-up IPC requests still reach the engine.
          await new Promise<void>((resolve) => { barrier.release = resolve; });
        }
        return response;
      });
    });
    await page.reload();
    await expect.poll(() => app.evaluate(() => (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.held?.path)).toBe("/api/connection");
    for (const mode of ["local", "cloud", "selfhost"]) await expect(page.getByTestId(`connection-mode-${mode}`)).toHaveAttribute("aria-disabled", "true");
    await page.getByTestId("connection-mode-selfhost").evaluate((row: HTMLElement) => {
      row.click(); row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await expect(page.getByTestId("connection-mode-local")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("connection-mode-selfhost")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("selfhost-url")).toHaveCount(0);
    expect(await app.evaluate(() => (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.requests.filter((r) => r.method !== "GET"))).toEqual([]);
    await capture(page, "remote-settings-initial-read-held");
    await releaseRead();
    const url = page.getByTestId("selfhost-url");
    await expect(url).toHaveValue(canonical); await expect(url).toBeEditable();
    await url.fill(equivalent);
    const signIn = page.getByRole("button", { name: "Sign in to Cortex", exact: true });
    await expect(signIn).toBeEnabled();
    expect(await call<ConnectionMode>(page, "/api/connection")).toEqual({ mode: "selfhost", url: canonical, signedIn: false });
    await capture(page, "remote-canonical-origin-sign-in");
    await signIn.click();
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeEditable();
    expect(await app.evaluate(() => (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.requests.filter((r) => r.path === "/api/connection/probe" || r.method === "PUT"))).toEqual([]);
    expect(backend.seen).toEqual([]);

    await select(page, backend.origin);
    expect(await submit(page, { action: "email", email: "person@example.test" })).toEqual({ status: "code_sent", signedIn: false, email: "person@example.test" });
    await app.evaluate(() => { (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.next = "/api/connection/auth"; });
    await page.reload();
    await expect.poll(() => app.evaluate(() => (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.held?.path)).toBe("/api/connection/auth");
    const held = await app.evaluate(() => (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.held!.response);
    expect(held.status).toBe(200); expect(JSON.parse(held.body)).toEqual({ status: "code_sent", signedIn: false, email: "person@example.test" });
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeDisabled();
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancel).toBeEnabled(); await cancel.click();
    await expect(page).toHaveURL(/#\/home(?:\?|$)/);
    expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false });
    expect(await app.evaluate(() => (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.requests.filter((r) => r.action === "cancel").length)).toBe(1);
    await releaseRead();
    await show(page, "login");
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeEditable();
    await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toHaveCount(0);
    expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false });
    expect(backend.count(EMAIL_PATH)).toBe(1); expect(backend.count(CODE_PATH)).toBe(0);
    await capture(page, "remote-initial-auth-read-cancelled");
    await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
    expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
  } finally { await releaseRead().catch(() => {}); backend.release(); await app.close(); await backend.close(); }
});

test("Live sign-in copy stays readable across eight locales", async () => {
  test.setTimeout(180_000);
  const backend = await authBackend("locale-layout");
  const { app, page } = await launch({ hash: "#/login?theme=light", locale: "en", env })
    .catch(async (error) => { await backend.close(); throw error; });
  const errors: string[] = [], rendererHttp: string[] = [], measurements: unknown[] = [], fontRecords: unknown[] = [];
  watch(page, errors, rendererHttp);
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const geometry = (selector: string) => page.locator(selector).evaluateAll((elements) => elements.map((el) => {
    const r = el.getBoundingClientRect(), boxes: DOMRect[] = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent?.trim() && !node.parentElement?.closest("svg")) {
      const range = document.createRange(); range.selectNodeContents(node);
      boxes.push(...Array.from(range.getClientRects()).filter((box) => box.width && box.height));
    }
    let left = 0, top = 0, right = innerWidth, bottom = innerHeight, opacity = 1;
    for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
      opacity *= style.visibility === "visible" && style.display !== "none" ? Number(style.opacity) : 0;
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) { left = Math.max(left, bounds.left + ancestor.clientLeft); right = Math.min(right, bounds.left + ancestor.clientLeft + ancestor.clientWidth); }
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) { top = Math.max(top, bounds.top + ancestor.clientTop); bottom = Math.min(bottom, bounds.top + ancestor.clientTop + ancestor.clientHeight); }
    }
    const inside = (box: DOMRect) => box.left >= left - 0.5 && box.top >= top - 0.5 && box.right <= right + 0.5 && box.bottom <= bottom + 0.5;
    return { text: el.textContent, opacity, bounds: [r.left, r.top, r.right, r.bottom], ink: boxes.map((b) => [b.left, b.top, b.right, b.bottom]),
      readable: boxes.length > 0 && boxes.every((b) => inside(b) && b.left >= r.left - 0.5 && b.right <= r.right + 0.5),
      reachable: inside(r) && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
  }));
  const readable = async (selector: string, opacity = 1) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).every((a) => a.playState === "finished"));
    const rows = await geometry(selector);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) { expect(row.readable, row.text ?? selector).toBe(true); expect(row.opacity).toBeCloseTo(opacity); }
    return rows;
  };
  const readableGlyphs = async (locale: string, theme: string) => {
    // ponytail: these pairs catch missing-script tofu; extend samples for other glyph regressions.
    const pair = ({ ja: ["あ", "ア"], ko: ["한", "글"], "zh-Hans": ["汉", "字"] } as Record<string, string[]>)[locale];
    if (!pair) return;
    const { failures, ...probe } = await page.locator(".systeme-login h1").evaluate((heading, pair) => {
      const style = getComputedStyle(heading), family = style.fontFamily;
      const weights = [400, 500].map((weight) => {
        const glyphs = [...pair, "\u{10ffff}"].map((text) => {
          const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 64;
          const ctx = canvas.getContext("2d")!;
          ctx.font = `${weight} 32px ${family}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(text, 64, 32);
          const pixels = ctx.getImageData(0, 0, 128, 64).data;
          return { text, canvas, pixels, ink: pixels.some((value, i) => i % 4 === 3 && value > 0) };
        });
        const equal = (a: number, b: number) => glyphs[a].pixels.every((value, i) => value === glyphs[b].pixels[i]);
        const ink = glyphs.slice(0, 2).map((glyph) => glyph.ink), distinct = !equal(0, 1), notMissing = [!equal(0, 2), !equal(1, 2)];
        const passed = ink.every(Boolean) && distinct && notMissing.every(Boolean);
        return { weight, ink, distinct, notMissing, passed,
          failures: passed ? [] : glyphs.map((glyph, i) => ({ weight, i, text: glyph.text, png: glyph.canvas.toDataURL("image/png") })) };
      });
      return { pair, missing: "U+10FFFF", style: { family, weight: style.fontWeight, size: style.fontSize },
        weights: weights.map(({ failures: _failures, ...row }) => row), failures: weights.flatMap((row) => row.failures) };
    }, pair);
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
      const { root: document } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: document.nodeId, selector: ".systeme-login h1" });
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      fontRecords.push({ locale, theme, ...probe, platformFonts: fonts });
    } finally { await cdp.detach(); }
    for (const failure of failures) await test.info().attach(`auth-glyph-${locale}-${theme}-${failure.weight}-${failure.i}`, {
      body: Buffer.from(failure.png.split(",")[1], "base64"), contentType: "image/png",
    });
    expect(probe.weights.every((row) => row.passed), `${locale} ${theme} glyph coverage at weights 400/500`).toBe(true);
  };
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" }); await select(page, backend.origin);
    for (const locale of ["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"]) for (const theme of ["light", "dark"]) await test.step(`${locale} ${theme}`, async () => {
      const catalog = (namespace: string) => JSON.parse(readFileSync(path.join(root, `packages/i18n/locales/${locale}/${namespace}.json`), "utf8")) as Record<string, string>;
      const t = catalog("system"), common = catalog("common");
      await submit(page, { action: "logout" });
      await page.evaluate((locale) => localStorage.setItem("cortex.locale", locale), locale);
      await show(page, "login", theme); await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", locale); await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
      const email = page.getByRole("textbox", { name: t["login.email"], exact: true });
      await expect(email).toBeEditable();
      await page.locator(".systeme-providers button").first().click();
      await expect(page.locator(".toast .t-desc")).toHaveText(t["auth.optionUnavailable"]);
      measurements.push({ locale, theme, state: "option-unavailable", copy: await readable(".toast .t-desc", 0.7) });
      await page.reload(); await email.fill("person@example.test"); backend.state.failSend = true;
      const getCode = page.getByRole("button", { name: t["login.getCode"], exact: true });
      await getCode.click(); await expect(page.locator(".systeme-login [role=alert]")).toHaveText(t["auth.sendFailed"]);
      await page.locator(".systeme-login [role=alert]").scrollIntoViewIfNeeded();
      measurements.push({ locale, theme, state: "send-failed", copy: await readable(".systeme-login [role=alert]") });
      backend.state.failSend = false; await getCode.click();
      const code = page.getByRole("textbox", { name: t["login.codeLabel"], exact: true });
      const enter = async (value: string) => { await code.fill(value); await page.getByRole("button", { name: t["onb.continue"], exact: true }).click(); };
      const view = async (status: "code_sent" | "signed_in" | "mfa_enrollment") => {
        const wrong = status === "code_sent", signed = status === "signed_in";
        await expect(page.locator(".systeme-login h1")).toHaveText(t[wrong ? "login.checkTitle" : signed ? "auth.signedIn" : "unavailable"]);
        await expect(page.locator(".systeme-login .systeme-lead")).toHaveText(wrong ? `${t["login.checkLead"]} person@example.test.` : t[signed ? "auth.sessionOnly" : "auth.continuationUnavailable"]);
        await expect(page.locator(".systeme-login button")).toHaveText(wrong ? [t["login.resend"], t["onb.continue"], t["login.otherEmail"], common.cancel] : signed ? [t["onb.continue"], t["auth.settings"]] : [t["login.otherEmail"], common.cancel]);
        const copy = await readable(".systeme-login h1, .systeme-login .systeme-lead, .systeme-login [role=alert], .systeme-otp-meta, .systeme-login button, .systeme-cell");
        const keyboard = [];
        await page.locator(".content-top button").focus();
        const controls = page.locator(".systeme-login input, .systeme-login button");
        for (let i = 0; i < await controls.count(); i++) {
          await page.keyboard.press("Tab"); await expect(controls.nth(i)).toBeFocused(); await expect(controls.nth(i)).toBeEnabled();
          const control = (await geometry(".systeme-login input, .systeme-login button"))[i];
          expect(control.reachable, control.text ?? status).toBe(true); keyboard.push(control);
        }
        expect(await authState(page)).toEqual({ status, signedIn: signed, email: status === "mfa_enrollment" ? "mfa@example.test" : "person@example.test" });
        await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
        measurements.push({ locale, theme, state: status, copy, keyboard });
      };
      await enter(WRONG_CODE); await expect(page.locator(".systeme-login [role=alert]")).toHaveText(t["auth.failed"]);
      await expect(code).toHaveValue(WRONG_CODE); await expect(code).toBeEditable(); await expect(page.locator(".systeme-cell")).toHaveText([...WRONG_CODE]);
      await view("code_sent"); if (theme === "dark") await capture(page, `remote-locale-${locale}`);
      await readableGlyphs(locale, theme);
      await enter(CODE); await expect(page.locator(".systeme-login h1")).toHaveText(t["auth.signedIn"]);
      await page.reload(); await view("signed_in");
      await submit(page, { action: "logout" }); await submit(page, { action: "email", email: "mfa@example.test" }); await page.reload();
      await enter(CODE); await expect(page.locator(".systeme-login .systeme-lead")).toHaveText(t["auth.continuationUnavailable"]);
      await page.reload(); await view("mfa_enrollment");
    });
    expect(measurements).toHaveLength(80); expect(backend.count(CODE_PATH)).toBe(48);
    expect(fontRecords).toHaveLength(6);
    expect(errors).toEqual([]); expect(backend.errors).toEqual([]); expect(rendererHttp).toEqual([]);
  } catch (error) { await capture(page, "remote-locale-failure"); throw error; }
  finally {
    try {
      await test.info().attach("auth-locale-geometry", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
      await test.info().attach("auth-locale-fonts", { body: JSON.stringify(fontRecords, null, 2), contentType: "application/json" });
    }
    finally { try { await app.close(); } finally { await backend.close(); } }
  }
});
