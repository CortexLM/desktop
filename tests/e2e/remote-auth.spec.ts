import { _electron as electron, test, expect, type ElectronApplication, type Page } from "@playwright/test";
import http from "node:http";
import { EventEmitter, once } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ConnectionMode, RemoteAuthInput, RemoteAuthState } from "@cortex/schema";
import { launch, root } from "./fixtures";

const env = { CORTEX_CATALOG_URL: "data:application/json,{}", CORTEX_TEST_PROVIDER_BASEURL: "" };
const EMAIL_PATH = "/v1/auth/magic-auth", CODE_PATH = "/v1/auth/magic-auth/verify";
const VERIFY_PATH = "/v1/auth/verify-email", MFA_PATH = "/v1/auth/mfa/verify";
const LOGOUT_PATH = "/v1/auth/logout";
const CODE = "123456", WRONG_CODE = "000000", EMAIL_CODE = "test-email-code";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_ERROR = "test-only-private-auth-detail";
const SESSION_COPY = "Sign-in lasts until Cortex closes. Chats still use your local provider settings.";
const CONTINUATION_COPY = "This sign-in step isn’t available in Cortex yet. Use another address or cancel.";
type Seen = { method: string; path: string; body: Record<string, unknown>; cookie?: string; authorization?: string };

// Controlled HTTP backend fixture, not a real Cortex Cloud account. The app's actual SDK/engine handles every response.
async function authBackend(tag: string) {
  const privateValues = [`test-only-${tag}-access`, `test-only-${tag}-refresh`, `test-only-${tag}-pending`, `test-only-${tag}-challenge`, `test-only-${tag}-factor`, `test-only-${tag}-qr`, `test-only-${tag}-totp`, PRIVATE_ERROR];
  const seen: Seen[] = [], pending: (() => void)[] = [], errors: string[] = [];
  const events = new EventEmitter();
  const state = { failSend: false, holdCode: false, finishedCodes: 0, holdContinuation: false, emailCode: EMAIL_CODE };
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
    if (req.method === "GET" && route === "/v1/mascots") return json(res, { items: [], has_more: false });
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
    if (req.method === "POST" && (route === VERIFY_PATH || route === MFA_PATH)) {
      if (state.holdContinuation) {
        const released = new Promise<void>((resolve) => pending.push(resolve));
        events.emit(`held:${route}`);
        await released;
      }
      try {
        if (res.destroyed) return;
        if (body.pending_authentication_token !== privateValues[2]) return problem(res, 401, "invalid_credential");
        if (route === VERIFY_PATH) {
          if (body.code !== state.emailCode) return problem(res, 401, "invalid_credential");
          return json(res, { status: "mfa_challenge", pending_authentication_token: privateValues[2], authentication_challenge_id: privateValues[3], authentication_factor_id: privateValues[4] });
        }
        if (body.code !== CODE || body.authentication_challenge_id !== privateValues[3]) return problem(res, 401, "invalid_credential");
        return session(res);
      } finally { events.emit(`finished:${route}`); }
    }
    if (req.method === "POST" && route === "/v1/auth/refresh") { problem(res, 401, "invalid_credential"); return; }
    if (req.method === "POST" && route === LOGOUT_PATH) {
      res.setHeader("set-cookie", "cortex_rt=; HttpOnly; Path=/v1/auth; Max-Age=0"); res.writeHead(204); res.end(); return;
    }
    errors.push(`Unexpected fixture request: ${req.method} ${route}`); problem(res, 404, "not_found");
  })().catch((error: unknown) => { errors.push(String(error)); if (!res.destroyed) { res.statusCode = 500; res.end(); } }); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const release = () => { state.holdCode = false; state.holdContinuation = false; pending.splice(0).forEach((resolve) => resolve()); };
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, seen, state, errors, privateValues,
    signal: (event: string) => once(events, event, { signal: AbortSignal.timeout(10_000) }),
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
  expect(Object.keys(state).sort()).toEqual(["owner", "signedIn", "status", ...(state.email === undefined ? [] : ["email"]), ...(state.candidate === undefined ? [] : ["candidate"])].sort());
  if (state.owner !== null) {
    expect(state.owner).toEqual({ origin: expect.any(String), revision: expect.stringMatching(UUID) });
    expect(new URL(state.owner.origin).origin).toBe(state.owner.origin);
  }
  if (state.candidate !== undefined) {
    expect(state.owner).not.toBeNull(); expect(state.candidate).toMatch(UUID);
  }
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
  try {
    await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toBeVisible();
  } catch (error) {
    await test.info().attach("failed-email-auth-state", { body: JSON.stringify(await authState(page)), contentType: "application/json" });
    throw error;
  }
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
      expect(await authState(page)).toEqual({ status: "code_sent", signedIn: false, email: "person@example.test", owner: { origin: backend.origin, revision: expect.stringMatching(UUID) }, candidate: expect.stringMatching(UUID) });
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
      expect(await authState(page)).toEqual({ status: "signed_in", signedIn: true, email: "person@example.test", owner: { origin: backend.origin, revision: expect.stringMatching(UUID) } });
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

  test(`Enrollment stays unavailable; verification restarts and cancelled codes stay private — 960 ${theme}`, async () => {
    const backend = await authBackend(`continuation-${theme}`);
    const first = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env });
    let app: ElectronApplication | undefined = first.app, page = first.page;
    const errors: string[] = [], rendererHttp: string[] = [];
    watch(page, errors, rendererHttp);
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await select(page, backend.origin); await show(page, "login", theme);
      try { await sendEmail(page, "mfa@example.test"); }
      catch (error) {
        await test.info().attach("failed-initial-email-backend", { body: JSON.stringify({ seen: backend.seen, errors: backend.errors }), contentType: "application/json" });
        throw error;
      }
      await enterCode(page);
      await expect(page.getByText(CONTINUATION_COPY, { exact: true })).toBeVisible();
      expect(await authState(page)).toMatchObject({ status: "mfa_enrollment", signedIn: false });
      expect((await call<ConnectionMode>(page, "/api/connection")).signedIn).toBe(false);
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      await capture(page, `remote-mfa-unavailable-${theme}`);
      await page.getByRole("button", { name: "Use another address", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
      expect((await authState(page)).status).toBe("signed_out");
      await sendEmail(page, "verify@example.test"); await enterCode(page);
      await expect(page.getByRole("textbox", { name: "Email verification code", exact: true })).toBeEditable();
      expect(await authState(page)).toEqual({ status: "verify_email", signedIn: false, email: "verify@example.test", owner: { origin: backend.origin, revision: expect.stringMatching(UUID) }, candidate: expect.stringMatching(UUID) });
      expect((await call<ConnectionMode>(page, "/api/connection")).signedIn).toBe(false);
      await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toHaveCount(0);
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      await capture(page, `remote-verification-form-${theme}`);
      await page.getByRole("button", { name: "Restart sign-in", exact: true }).click();
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
      expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false, owner: { origin: backend.origin, revision: expect.stringMatching(UUID) } });
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

  test(`Verification text boundaries, refusal and MFA promotion — 960 and 1440 ${theme}`, async () => {
    const backend = await authBackend(`verify-mfa-${theme}`);
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env });
    const errors: string[] = [], rendererHttp: string[] = [];
    watch(page, errors, rendererHttp);
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await select(page, backend.origin); await show(page, "login", theme);
      await sendEmail(page, "verify@example.test"); await enterCode(page);
      const code = page.getByRole("textbox", { name: "Email verification code", exact: true });
      const verify = page.getByRole("button", { name: "Verify and continue", exact: true });
      await expect(code).toBeEditable(); await expect(code).toHaveJSProperty("type", "text");
      const initial = await authState(page);
      for (const value of ["", "   "]) {
        await code.fill(value); await expect(verify).toBeDisabled();
        await code.press("Enter");
        expect(backend.count(VERIFY_PATH)).toBe(0);
      }
      // A real one-character request proves the inclusive lower bound and same-owner refusal retention.
      await code.fill("x"); await expect(verify).toBeEnabled(); await verify.click();
      await expect(page.getByRole("alert")).toHaveText("Couldn’t sign in. Check your details and try again.");
      await expect(code).toHaveValue("x"); await expect(code).toBeEditable();
      expect(await authState(page)).toEqual(initial);
      expect(backend.seen.filter((entry) => entry.path === VERIFY_PATH).map((entry) => entry.body)).toEqual([
        { code: "x", pending_authentication_token: backend.privateValues[2] },
      ]);
      // Exercise the 129-character boundary even when native maxlength prevents its entry.
      await code.fill("x".repeat(129));
      const entered = await code.inputValue();
      expect([128, 129]).toContain(entered.length);
      if (entered.length === 129) { await expect(verify).toBeDisabled(); await code.press("Enter"); }
      else await expect(code).toHaveAttribute("maxlength", "128");
      expect(backend.count(VERIFY_PATH)).toBe(1);
      const tooLong = await request(page, "/api/connection/auth", "POST", { action: "verify_email", code: "x".repeat(129), owner: initial.owner });
      expect(tooLong.status).toBe(400); expect(backend.count(VERIFY_PATH)).toBe(1);
      expect(await authState(page)).toEqual(initial);
      await code.fill("x".repeat(128)); await expect(verify).toBeEnabled(); await verify.click();
      await expect(page.getByRole("alert")).toHaveText("Couldn’t sign in. Check your details and try again.");
      await expect(code).toHaveValue("x".repeat(128)); await expect(code).toBeEditable();
      expect(backend.seen.filter((entry) => entry.path === VERIFY_PATH).at(-1)!.body.code).toBe("x".repeat(128));
      expect(await authState(page)).toEqual(initial);
      await capture(page, `remote-verification-boundary-refused-960-${theme}`);
      await code.fill(`  ${EMAIL_CODE}  `);
      backend.state.holdContinuation = true;
      const arrived = backend.signal(`held:${VERIFY_PATH}`);
      await verify.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await arrived;
      expect(backend.count(VERIFY_PATH)).toBe(3);
      await expect(code).toBeDisabled(); await expect(code).toHaveValue(`  ${EMAIL_CODE}  `);
      expect(backend.seen.filter((entry) => entry.path === VERIFY_PATH).at(-1)!.body).toEqual({ code: EMAIL_CODE, pending_authentication_token: backend.privateValues[2] });
      const finished = backend.signal(`finished:${VERIFY_PATH}`); backend.release(); await finished;
      const mfa = page.getByRole("textbox", { name: "6-digit code", exact: true });
      await expect(mfa).toBeEditable(); await expect(mfa).toHaveValue("");
      expect(await authState(page)).toMatchObject({ status: "mfa_challenge", signedIn: false, candidate: initial.candidate });
      await expect(code).toHaveCount(0); await expect(verify).toBeDisabled();
      await mfa.fill("12345"); await expect(verify).toBeDisabled(); await mfa.press("Enter");
      expect(backend.count(MFA_PATH)).toBe(0);
      await mfa.fill(WRONG_CODE); await verify.click();
      await expect(page.getByRole("alert")).toHaveText("Couldn’t sign in. Check your details and try again.");
      await expect(mfa).toHaveValue(WRONG_CODE); await expect(mfa).toBeEditable();
      await expect(page.locator(".systeme-cell")).toHaveText([...WRONG_CODE]);
      await capture(page, `remote-mfa-refused-960-${theme}`);
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900));
      await capture(page, `remote-mfa-refused-1440-${theme}`);
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      await mfa.fill(CODE); await verify.click();
      await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
      expect(await authState(page)).toMatchObject({ status: "signed_in", signedIn: true, email: "verify@example.test" });
      expect(backend.seen.filter((entry) => entry.path === MFA_PATH).map((entry) => entry.body)).toEqual([
        { code: WRONG_CODE, pending_authentication_token: backend.privateValues[2], authentication_challenge_id: backend.privateValues[3] },
        { code: CODE, pending_authentication_token: backend.privateValues[2], authentication_challenge_id: backend.privateValues[3] },
      ]);
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      // Capture the text form at the wider width too, using a fresh real candidate.
      await submit(page, { action: "logout" }); await page.reload();
      await sendEmail(page, "verify@example.test"); await enterCode(page);
      await expect(code).toBeEditable(); await capture(page, `remote-verification-form-1440-${theme}`);
      await page.getByRole("button", { name: "Restart sign-in", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeEditable();
      expect((await authState(page)).status).toBe("signed_out");
      await test.info().attach("continuation-backend", { body: JSON.stringify(backend.seen, null, 2), contentType: "application/json" });
      expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
    } finally { backend.release(); await app.close(); await backend.close(); }
  });
}

for (const step of ["verify_email", "mfa"] as const) {
  test(`Active A keeps pending B ${step} form; stale ownership refuses and held Cancel cannot promote`, async () => {
    const backend = await authBackend(`continuation-owner-${step}`);
    const { app, page } = await launch({ hash: "#/home?theme=light", locale: "en", env });
    const errors: string[] = [], rendererHttp: string[] = [];
    watch(page, errors, rendererHttp);
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await select(page, backend.origin); await show(page, "login");
      await sendEmail(page, "active@example.test"); await enterCode(page);
      await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
      const active = await authState(page);
      const begin = await submit(page, { action: "email", email: "verify@example.test", owner: active.owner! });
      let pending = await submit(page, { action: "code", code: CODE, owner: begin.owner! });
      if (step === "mfa") pending = await submit(page, { action: "verify_email", code: EMAIL_CODE, owner: pending.owner! });
      await page.reload();
      const code = page.getByRole("textbox", { name: step === "mfa" ? "6-digit code" : "Email verification code", exact: true });
      const verify = page.getByRole("button", { name: "Verify and continue", exact: true });
      const route = step === "mfa" ? MFA_PATH : VERIFY_PATH;
      const value = step === "mfa" ? CODE : EMAIL_CODE;
      await expect(code).toBeEditable(); await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toHaveCount(0);
      expect(pending).toMatchObject({ status: step === "mfa" ? "mfa_challenge" : "verify_email", signedIn: true, email: "verify@example.test" });
      // A replacement reaches the same step in main while the mounted form still owns B.
      await code.fill(value);
      const replacementStart = await submit(page, { action: "email", email: "verify@example.test", owner: pending.owner! });
      let replacement = await submit(page, { action: "code", code: CODE, owner: replacementStart.owner! });
      if (step === "mfa") replacement = await submit(page, { action: "verify_email", code: EMAIL_CODE, owner: replacement.owner! });
      expect(replacement.candidate).not.toBe(pending.candidate); expect(replacement.owner).not.toEqual(pending.owner);
      const before = backend.count(route);
      await verify.click();
      await expect(page.getByRole("alert")).toHaveText("Couldn’t sign in. Check your details and try again.");
      await expect(code).toHaveValue(""); await expect(code).toBeEditable();
      expect(backend.count(route)).toBe(before); expect(await authState(page)).toEqual(replacement);
      await capture(page, `remote-${step}-stale-candidate-refused`);
      await code.fill(value); backend.state.holdContinuation = true;
      const arrived = backend.signal(`held:${route}`);
      await verify.click(); await arrived;
      await expect(code).toBeDisabled(); expect(backend.count(route)).toBe(before + 1);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page).toHaveURL(/#\/home(?:\?|$)/);
      const cancelled = await authState(page);
      expect(cancelled).toMatchObject({ status: "signed_in", signedIn: true, email: "active@example.test" });
      expect(cancelled.candidate).toBeUndefined();
      const finished = backend.signal(`finished:${route}`); backend.release(); await finished;
      expect(await authState(page)).toEqual(cancelled);
      await show(page, "login"); await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
      await expect(code).toHaveCount(0);
      await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
      await test.info().attach("continuation-ownership", { body: JSON.stringify({ active, pending, replacement, cancelled, seen: backend.seen }, null, 2), contentType: "application/json" });
      expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
    } finally { backend.release(); await app.close(); await backend.close(); }
  });
}

for (const step of ["verify_email", "mfa"] as const) for (const departure of ["committed", "deferred"] as const) {
  test(`Ordinary ${departure} away/back invalidates the old ${step} form without cancelling main authority`, async () => {
    const backend = await authBackend(`continuation-navigation-${step}-${departure}`);
    const { app, page } = await launch({ hash: "#/home?theme=light", locale: "en", env });
    const errors: string[] = [], rendererHttp: string[] = [];
    watch(page, errors, rendererHttp);
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await select(page, backend.origin); await show(page, "login");
      await sendEmail(page, "active@example.test"); await enterCode(page);
      await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
      const active = await authState(page);
      const start = await submit(page, { action: "email", email: "verify@example.test", owner: active.owner! });
      let pending = await submit(page, { action: "code", code: CODE, owner: start.owner! });
      if (step === "mfa") pending = await submit(page, { action: "verify_email", code: EMAIL_CODE, owner: pending.owner! });
      await page.reload();
      const field = page.getByRole("textbox", {
        name: step === "mfa" ? "6-digit code" : "Email verification code", exact: true,
      });
      const verify = page.getByRole("button", { name: "Verify and continue", exact: true });
      const route = step === "mfa" ? MFA_PATH : VERIFY_PATH;
      const value = step === "mfa" ? CODE : EMAIL_CODE;
      const acceptedStatus = step === "mfa" ? "signed_in" : "mfa_challenge";
      await expect(field).toBeEditable();
      expect(pending).toMatchObject({
        status: step === "mfa" ? "mfa_challenge" : "verify_email",
        signedIn: true, email: "verify@example.test",
      });
      await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toHaveCount(0);
      await field.fill(value);
      const outgoing = await field.elementHandle();
      if (!outgoing) throw new Error("Missing outgoing continuation field");
      const loginURL = page.url();
      const loginEntry = await page.evaluate(() => (window as unknown as {
        navigation: { currentEntry: { key: string } };
      }).navigation.currentEntry.key);

      // Observe the actual checked response consumed by the old renderer call.
      // Backend finish alone does not prove SDK validation or renderer delivery.
      const delivered = await page.evaluateHandle(({ status, revision }) => {
        const original = Response.prototype.json;
        let resolve!: (value: unknown) => void;
        const consumed = new Promise<unknown>((done) => { resolve = done; });
        Response.prototype.json = async function () {
          const value: unknown = await original.call(this);
          if (value && typeof value === "object" && "status" in value && value.status === status
            && "owner" in value && value.owner && typeof value.owner === "object"
            && "revision" in value.owner && value.owner.revision !== revision) {
            // Let the observed response continuation and React commit finish.
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(value)));
          }
          return value;
        };
        return {
          async wait() {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              return await Promise.race([
                consumed,
                new Promise<never>((_, reject) => {
                  timer = setTimeout(() => reject(new Error("Old continuation response was not consumed")), 10_000);
                }),
              ]);
            } finally { clearTimeout(timer); }
          },
          restore() { Response.prototype.json = original; },
        };
      }, { status: acceptedStatus, revision: pending.owner!.revision });
      const transition = await page.evaluateHandle((deferred) => {
        const start = document.startViewTransition;
        let release: (() => void) | undefined, done: Promise<void> | undefined;
        let observed!: () => void;
        const held = new Promise<void>((resolve) => { observed = resolve; });
        if (deferred) document.startViewTransition = (update) => {
          document.startViewTransition = start;
          done = new Promise<void>((resolve) => { release = resolve; })
            .then(() => typeof update === "function" ? update() : update?.update?.());
          observed();
          return { finished: done, ready: done, updateCallbackDone: done, types: new Set<string>(), skipTransition() {} };
        };
        return {
          async wait() {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              await Promise.race([
                held,
                new Promise<never>((_, reject) => {
                  timer = setTimeout(() => reject(new Error("Login departure update was not held")), 10_000);
                }),
              ]);
            } finally { clearTimeout(timer); }
          },
          async finish() {
            if (!release || !done) throw new Error("Missing held Login departure");
            release();
            await done;
          },
          restore() { document.startViewTransition = start; release?.(); },
        };
      }, departure === "deferred");
      try {
        backend.state.holdContinuation = true;
        const arrived = backend.signal(`held:${route}`);
        await verify.click(); await arrived;
        await expect(field).toBeDisabled();
        const before = backend.count(route);

        // No Cancel, Restart, logout or account-owner mutation.
        if (departure === "deferred") {
          await page.emulateMedia({ reducedMotion: "no-preference" });
          await Promise.all([
            transition.evaluate((probe) => probe.wait()),
            show(page, "settings?section=connection"),
          ]);
          await expect(page).toHaveURL(/#\/settings\?section=connection&theme=light$/);
          expect(await outgoing.evaluate((element) => element.isConnected)).toBe(true);
          await expect(page.getByTestId("connection-mode-selfhost")).toHaveCount(0);
          await expect(field).toHaveValue(value);
          // Back must commit without starting another held transition.
          await page.emulateMedia({ reducedMotion: "reduce" });
        } else {
          await show(page, "settings?section=connection");
          await expect(page.getByTestId("connection-mode-selfhost")).toBeVisible();
          expect(await outgoing.evaluate((element) => element.isConnected)).toBe(false);
        }
        expect(await authState(page)).toEqual(pending);
        await page.evaluate((entryKey) => new Promise<void>((resolve, reject) => {
          const navigation = (window as unknown as {
            navigation: EventTarget & { currentEntry: { key: string } };
          }).navigation;
          const changed = () => {
            if (navigation.currentEntry.key !== entryKey) return;
            clearTimeout(timer);
            navigation.removeEventListener("currententrychange", changed);
            resolve();
          };
          const timer = setTimeout(() => {
            navigation.removeEventListener("currententrychange", changed);
            reject(new Error("Back navigation did not change the history entry"));
          }, 10_000);
          navigation.addEventListener("currententrychange", changed);
          history.back();
        }), loginEntry);
        await expect(page).toHaveURL(loginURL);
        await expect(field).toBeEditable();
        const nextDraft = departure === "deferred" ? value : step === "mfa" ? WRONG_CODE : "next-renderer-draft";
        if (departure === "deferred") {
          expect(await outgoing.evaluate((element) => element.isConnected)).toBe(true);
          expect(await field.evaluate((element, original) => element === original, outgoing)).toBe(true);
          await expect(field).toHaveValue(value);
        } else {
          await expect(field).toHaveValue("");
          await field.fill(nextDraft);
        }
        await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toHaveCount(0);

        const finished = backend.signal(`finished:${route}`);
        const consumed = delivered.evaluate((probe) => probe.wait());
        backend.release();
        await finished;
        const accepted = await consumed;
        expect(accepted).toMatchObject({
          status: acceptedStatus, signedIn: true, email: "verify@example.test",
        });
        const checked = await authState(page);
        expect(checked).toEqual(accepted);
        expect(checked.owner).not.toEqual(pending.owner);
        if (step === "mfa") expect(checked.candidate).toBeUndefined();
        else expect(checked.candidate).toBe(pending.candidate);

        // Main accepted the still-authorized request; its obsolete UI callback
        // must not overwrite the current form, clear its draft or present B as signed in.
        await expect(page).toHaveURL(loginURL);
        await expect(field).toBeEditable(); await expect(field).toHaveValue(nextDraft);
        await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toHaveCount(0);
        await expect(page.locator(".systeme-login [role=alert]")).toHaveCount(0);
        expect(await outgoing.evaluate((element) => element.isConnected)).toBe(departure === "deferred");
        expect(backend.count(route)).toBe(before);
        if (departure === "deferred") {
          // Releasing the obsolete route callback must not unmount the returned owner.
          await transition.evaluate((probe) => probe.finish());
          await expect(page).toHaveURL(loginURL);
          expect(await outgoing.evaluate((element) => element.isConnected)).toBe(true);
          expect(await field.evaluate((element, original) => element === original, outgoing)).toBe(true);
          await expect(field).toBeEditable(); await expect(field).toHaveValue(value);
          await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toHaveCount(0);
        }

        // The current form still captures the earlier revision. Main refuses
        // it before HTTP; the existing error recovery reads the checked new state.
        await verify.click();
        await expect(page.locator(".systeme-login [role=alert]")).toBeVisible();
        if (step === "mfa") {
          await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
          await expect(field).toHaveCount(0);
        } else {
          await expect(field).toHaveCount(0);
          const mfa = page.getByRole("textbox", { name: "6-digit code", exact: true });
          await expect(mfa).toBeEditable(); await expect(mfa).toHaveValue("");
          await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toHaveCount(0);
        }
        expect(backend.count(route)).toBe(before);
        expect(await authState(page)).toEqual(checked);
        await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
        await test.info().attach("continuation-navigation-ownership", {
          body: JSON.stringify({ step, departure, active, pending, checked, requests: backend.seen.map(({ method, path }) => ({ method, path })) }, null, 2),
          contentType: "application/json",
        });
        expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
      } finally {
        await transition.evaluate((probe) => probe.restore());
        await transition.dispose();
        await delivered.evaluate((probe) => probe.restore());
        await delivered.dispose(); await outgoing.dispose();
      }
    } finally { backend.release(); await app.close(); await backend.close(); }
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
    const modeOwner = (await authState(page)).owner!;
    const pendingMode = request(page, "/api/connection/auth", "POST", { action: "code", code: CODE, owner: modeOwner });
    await expect.poll(() => b.held()).toBe(1);
    await call(page, "/api/connection", "PUT", { mode: "local", signedIn: true });
    b.release();
    expect((await pendingMode).status).toBeGreaterThanOrEqual(400);
    await show(page, "settings?section=connection");
    await expect(page.getByTestId("connection-mode-local")).toHaveAttribute("aria-checked", "true");
    expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false, owner: null });
    expect(await call<ConnectionMode>(page, "/api/connection")).toEqual({ mode: "local", signedIn: false });
    await select(page, a.origin); await show(page, "login");
    await sendEmail(page, "person@example.test");
    a.state.holdCode = true;
    const originOwner = (await authState(page)).owner!;
    const pendingOrigin = request(page, "/api/connection/auth", "POST", { action: "code", code: CODE, owner: originOwner });
    await expect.poll(() => a.held()).toBe(1);
    await select(page, b.origin); a.release();
    expect((await pendingOrigin).status).toBeGreaterThanOrEqual(400);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeVisible();
    expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false, owner: { origin: b.origin, revision: expect.stringMatching(UUID) } });
    await sendEmail(page, "person@example.test");
    expect(b.seen.length).toBeGreaterThan(0);
    for (const entry of b.seen) { expect(entry.cookie).toBeUndefined(); expect(entry.authorization).toBeUndefined(); }
    const lastAEmail = a.seen.filter((r) => r.path === EMAIL_PATH).at(-1)!;
    expect(lastAEmail.cookie).toBeUndefined(); expect(lastAEmail.authorization).toBeUndefined();
    const pending = await authState(page);
    await submit(page, { action: "cancel", origin: pending.owner!.origin, candidate: pending.candidate! });
    await privateStateStaysInMain(app, page, [...a.privateValues, ...b.privateValues], rendererHttp);
    expect(errors).toEqual([]); expect(a.errors).toEqual([]); expect(b.errors).toEqual([]);
  } finally { a.release(); b.release(); await app.close(); await Promise.all([a.close(), b.close()]); }
});

test("A stale rendered code cannot submit into a same-step replacement candidate", async () => {
  const backend = await authBackend("stale-rendered-code");
  const { app, page } = await launch({ hash: "#/home?theme=light", locale: "en", env });
  const errors: string[] = [], rendererHttp: string[] = [];
  watch(page, errors, rendererHttp);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await select(page, backend.origin); await show(page, "login");
    await sendEmail(page, "old@example.test");
    const old = await authState(page);
    const code = page.getByRole("textbox", { name: "6-digit code", exact: true });
    await code.fill(CODE);
    // Replace in real main without remounting or refreshing the old form's captured owner.
    const replacement = await submit(page, { action: "email", email: "new@example.test", owner: old.owner! });
    expect(replacement).toEqual({ status: "code_sent", signedIn: false, email: "new@example.test", owner: { origin: backend.origin, revision: expect.stringMatching(UUID) }, candidate: old.owner!.revision });
    expect(replacement.owner).not.toEqual(old.owner);
    expect(replacement.candidate).not.toBe(old.candidate);
    await expect(page.locator(".systeme-login .systeme-lead")).toContainText("old@example.test");
    await expect(code).toHaveValue(CODE);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Couldn’t sign in. Check your details and try again.", { exact: true })).toBeVisible();
    expect(backend.count(CODE_PATH)).toBe(0);
    expect(backend.count(EMAIL_PATH)).toBe(2);
    expect(await authState(page)).toEqual(replacement);
    await expect(page.locator(".systeme-login .systeme-lead")).toContainText("new@example.test");
    await expect(code).toHaveValue("");
    await capture(page, "remote-stale-rendered-code-refused");
    await enterCode(page);
    await expect(page.getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
    expect(backend.seen.filter((entry) => entry.path === CODE_PATH).map((entry) => entry.body)).toEqual([{ email: "new@example.test", code: CODE }]);
    expect(await authState(page)).toEqual({ status: "signed_in", signedIn: true, email: "new@example.test", owner: { origin: backend.origin, revision: expect.stringMatching(UUID) } });
    await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
    expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
  } finally { await app.close(); await backend.close(); }
});

test("Local-to-Cloud bootstrap read failures recover on Get a code without remounting", async () => {
  const backend = await authBackend("bootstrap-recovery");
  const { app, page } = await launch({ hash: "#/login?theme=light", locale: "en", env });
  const errors: string[] = [], rendererHttp: string[] = [];
  watch(page, errors, rendererHttp);
  type WireRequest = { url: string; method: string; headers: [string, string][]; body?: string };
  type WireResponse = { status: number; headers: [string, string][]; body: string };
  type Bootstrap = { selected: boolean; failures: number; requests: { method: string; path: string; body?: unknown }[] };
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const email = page.getByRole("textbox", { name: "Email address", exact: true });
    await expect(email).toBeEditable();
    expect(await authState(page)).toEqual({ status: "signed_out", signedIn: false, owner: null });
    await app.evaluate(({ ipcMain }, origin) => {
      const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (event: unknown, request: WireRequest) => Promise<WireResponse>> })._invokeHandlers.get("cortex:fetch")!;
      const state: Bootstrap = { selected: false, failures: 0, requests: [] };
      (globalThis as unknown as { authBootstrap: Bootstrap }).authBootstrap = state;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
        const path = new URL(request.url).pathname;
        const body = request.body ? JSON.parse(request.body) : undefined;
        if (path === "/api/connection" || path === "/api/connection/auth") state.requests.push({ method: request.method, path, ...(body ? { body } : {}) });
        // IPC transport seam: renderer selects Cloud; real main selects the local HTTP fixture.
        // Only connection-mode envelopes are translated. Auth owners, SDK calls and candidates stay real.
        // This exercises renderer bootstrap/retry, not canonical Cloud routing or a real Cloud account.
        const cloud = path === "/api/connection" && request.method === "PUT" && body?.mode === "cloud";
        const response = await original(event, cloud ? { ...request, body: JSON.stringify({ mode: "selfhost", url: origin, signedIn: false }) } : request);
        if (cloud && response.status === 200) state.selected = true;
        if (state.selected && path === "/api/connection" && response.status === 200) {
          return { ...response, body: JSON.stringify({ mode: "cloud", signedIn: JSON.parse(response.body).signedIn }) };
        }
        if (state.selected && path === "/api/connection/auth" && request.method === "GET" && state.failures < 2) {
          state.failures++;
          return { status: 503, headers: response.headers, body: JSON.stringify({ error: { code: "provider_error", message: "Test auth read delivery failure" } }) };
        }
        return response;
      });
    }, backend.origin);
    await email.fill("retry@example.test");
    const getCode = page.getByRole("button", { name: "Get a code", exact: true });
    await getCode.click();
    await expect(page.getByRole("alert")).toHaveText("Couldn’t send a code. Try again.");
    await expect(getCode).toBeEnabled();
    await expect(email).toHaveValue("retry@example.test");
    const failed = await app.evaluate(() => (globalThis as unknown as { authBootstrap: Bootstrap }).authBootstrap);
    expect(failed.selected).toBe(true); expect(failed.failures).toBe(2);
    expect(failed.requests).toEqual([
      { method: "GET", path: "/api/connection" },
      { method: "PUT", path: "/api/connection", body: { mode: "cloud", signedIn: false } },
      { method: "GET", path: "/api/connection/auth" },
      { method: "GET", path: "/api/connection/auth" },
    ]);
    expect(backend.count(EMAIL_PATH)).toBe(0);
    await capture(page, "remote-bootstrap-reads-failed");
    // Same mounted form, same draft: no navigation, reload, or state refresh from test code.
    await getCode.click();
    await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toBeEditable();
    await expect(page.locator(".systeme-login .systeme-lead")).toContainText("retry@example.test");
    const recovered = await app.evaluate(() => (globalThis as unknown as { authBootstrap: Bootstrap }).authBootstrap);
    expect(recovered.requests.slice(failed.requests.length)).toEqual([
      { method: "GET", path: "/api/connection" },
      { method: "GET", path: "/api/connection/auth" },
      { method: "POST", path: "/api/connection/auth", body: { action: "email", email: "retry@example.test", owner: { origin: backend.origin, revision: expect.stringMatching(UUID) } } },
    ]);
    expect(backend.seen.filter((entry) => entry.path === EMAIL_PATH).map((entry) => entry.body)).toEqual([{ email: "retry@example.test" }]);
    expect(await authState(page)).toMatchObject({ status: "code_sent", signedIn: false, email: "retry@example.test", owner: { origin: backend.origin } });
    await capture(page, "remote-bootstrap-retry-recovered");
    await test.info().attach("bootstrap-recovery-ipc", { body: JSON.stringify({ failed, recovered }, null, 2), contentType: "application/json" });
    await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
    expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
  } finally { await app.close(); await backend.close(); }
});

test("Cancel retains accepted email authority while failed delivery recovery is held", async () => {
  const backend = await authBackend("accepted-email-cancel");
  const { app, page } = await launch({ hash: "#/home?theme=light", locale: "en", env });
  const errors: string[] = [], rendererHttp: string[] = [];
  watch(page, errors, rendererHttp);
  type WireRequest = { url: string; method: string; headers: [string, string][]; body?: string };
  type WireResponse = { status: number; headers: [string, string][]; body: string };
  type Recovery = {
    accepted?: RemoteAuthState; held?: RemoteAuthState; holdNext: boolean; released: boolean; release?: () => void;
    cancels: { input: RemoteAuthInput; response: WireResponse; beforeRelease: boolean }[];
  };
  const release = () => app.evaluate(() => {
    const state = (globalThis as unknown as { authRecovery?: Recovery }).authRecovery;
    if (state) { state.released = true; state.release?.(); }
  });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await select(page, backend.origin); await show(page, "login");
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeEditable();
    const initial = await authState(page);
    expect(initial.status).toBe("signed_out");
    await app.evaluate(({ ipcMain }) => {
      const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (event: unknown, request: WireRequest) => Promise<WireResponse>> })._invokeHandlers.get("cortex:fetch")!;
      const state: Recovery = { holdNext: false, released: false, cancels: [] };
      (globalThis as unknown as { authRecovery: Recovery }).authRecovery = state;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
        const path = new URL(request.url).pathname;
        const input = path === "/api/connection/auth" && request.method === "POST" ? JSON.parse(request.body!) as RemoteAuthInput : undefined;
        const response = await original(event, request);
        // The actual SDK/backend and main accept the candidate before IPC delivery is failed.
        if (input?.action === "email" && response.status === 200 && !state.accepted) {
          state.accepted = JSON.parse(response.body); state.holdNext = true;
          return { status: 503, headers: response.headers, body: JSON.stringify({ error: { code: "provider_error", message: "Test accepted email delivery failure" } }) };
        }
        if (path === "/api/connection/auth" && request.method === "GET" && state.holdNext) {
          state.holdNext = false; state.held = JSON.parse(response.body);
          const released = new Promise<void>((resolve) => { state.release = resolve; });
          console.info("auth-recovery-read-held");
          await released;
        }
        if (input?.action === "cancel") state.cancels.push({ input, response, beforeRelease: !state.released });
        return response;
      });
    });
    // Subscribe before triggering; main emits only after installing the exact release signal.
    const arrived = app.waitForEvent("console", { predicate: (message) => message.text() === "auth-recovery-read-held", timeout: 10_000 });
    await page.getByRole("textbox", { name: "Email address", exact: true }).fill("cancel@example.test");
    await page.getByRole("button", { name: "Get a code", exact: true }).click();
    await arrived;
    const held = await app.evaluate(() => {
      const { accepted, held, released, cancels } = (globalThis as unknown as { authRecovery: Recovery }).authRecovery;
      return { accepted, held, released, cancels };
    });
    expect(held.accepted).toEqual({ status: "code_sent", signedIn: false, email: "cancel@example.test", owner: { origin: backend.origin, revision: expect.stringMatching(UUID) }, candidate: initial.owner!.revision });
    expect(held.held).toEqual(held.accepted); expect(held.released).toBe(false); expect(held.cancels).toEqual([]);
    expect(backend.count(EMAIL_PATH)).toBe(1);
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(/#\/home(?:\?|$)/);
    const cancelled = await authState(page);
    expect(cancelled).toEqual({ status: "signed_out", signedIn: false, owner: { origin: backend.origin, revision: expect.stringMatching(UUID) } });
    const cancellation = await app.evaluate(() => {
      const { released, cancels } = (globalThis as unknown as { authRecovery: Recovery }).authRecovery;
      return { released, cancels };
    });
    expect(cancellation.released).toBe(false);
    expect(cancellation.cancels).toEqual([{
      input: { action: "cancel", origin: backend.origin, candidate: initial.owner!.revision },
      response: { status: 200, headers: expect.any(Array), body: JSON.stringify(cancelled) }, beforeRelease: true,
    }]);
    await capture(page, "remote-cancel-before-recovery-release");
    await release();
    expect(await authState(page)).toEqual(cancelled);
    await show(page, "login");
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeEditable();
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toHaveCount(0);
    expect(backend.count(EMAIL_PATH)).toBe(1); expect(backend.count(CODE_PATH)).toBe(0);
    await test.info().attach("accepted-email-cancel-ipc", { body: JSON.stringify({ initial, held, cancellation, cancelled }, null, 2), contentType: "application/json" });
    await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
    expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
  } finally { await release().catch(() => {}); await app.close(); await backend.close(); }
});

test("Initial connection and auth reads protect selection, canonical sign-in and ownerless cancellation", async () => {
  const backend = await authBackend("read-races");
  const { app, page } = await launch({ hash: "#/home?theme=light", locale: "en", env });
  const errors: string[] = [], rendererHttp: string[] = [];
  watch(page, errors, rendererHttp);
  type WireRequest = { url: string; method: string; headers: [string, string][]; body?: string };
  type WireResponse = { status: number; headers: [string, string][]; body: string };
  type ReadBarrier = {
    next?: string; held?: { path: string; response: WireResponse }; releases?: (() => void)[];
    observed?: Promise<void>; notify?: () => void;
    requests: { method: string; path: string; action?: string }[];
  };
  const releaseRead = () => app.evaluate(() => {
    const barrier = (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier;
    barrier.next = undefined; barrier.releases?.forEach((release) => release()); barrier.releases = []; barrier.held = undefined;
  });
  const waitRead = () => app.evaluate(async () => {
    const barrier = (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([barrier.observed, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Missing held auth read: ${JSON.stringify(barrier.requests)}`)), 10_000);
      })]);
    } finally { clearTimeout(timer); }
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
      barrier.observed = new Promise((resolve) => { barrier.notify = resolve; });
      (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier = barrier;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
        const path = new URL(request.url).pathname;
        barrier.requests.push({ method: request.method, path, ...(path === "/api/connection/auth" && request.method === "POST" ? { action: JSON.parse(request.body!).action } : {}) });
        const response = await original(event, request);
        if (request.method === "GET" && barrier.next === path) {
          barrier.held = { path, response };
          barrier.notify?.();
          // Hold every reader of this path, including the sidebar's connection read.
          await new Promise<void>((resolve) => { (barrier.releases ??= []).push(resolve); });
        }
        return response;
      });
    });
    await page.reload();
    await waitRead();
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
    const initialOwner = (await authState(page)).owner!;
    const unseen = await submit(page, { action: "email", email: "person@example.test", owner: initialOwner });
    expect(unseen).toEqual({ status: "code_sent", signedIn: false, email: "person@example.test", owner: { origin: backend.origin, revision: expect.stringMatching(UUID) }, candidate: initialOwner.revision });
    await app.evaluate(() => {
      const barrier = (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier;
      barrier.next = "/api/connection/auth";
      barrier.observed = new Promise((resolve) => { barrier.notify = resolve; });
    });
    await page.reload();
    await waitRead();
    const held = await app.evaluate(() => (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.held!.response);
    expect(held.status).toBe(200); expect(JSON.parse(held.body)).toEqual(unseen);
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toBeDisabled();
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancel).toBeEnabled(); await cancel.click();
    await expect(page).toHaveURL(/#\/home(?:\?|$)/);
    // No owner has reached this form: Cancel leaves locally, never acquires authority over the unseen candidate.
    // Keep the form response held, but let the independent verification read through.
    await app.evaluate(() => { (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.next = undefined; });
    expect(await authState(page)).toEqual(unseen);
    expect(await app.evaluate(() => (globalThis as unknown as { authReadBarrier: ReadBarrier }).authReadBarrier.requests.filter((r) => r.action === "cancel").length)).toBe(0);
    await releaseRead();
    await show(page, "login");
    await expect(page.getByRole("textbox", { name: "6-digit code", exact: true })).toBeEditable();
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toHaveCount(0);
    await expect(page.locator(".systeme-login .systeme-lead")).toContainText("person@example.test");
    expect(await authState(page)).toEqual(unseen);
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
      if (ancestor !== el && /^(auto|scroll|hidden|clip)$/.test(style.overflowX)) { left = Math.max(left, bounds.left + ancestor.clientLeft); right = Math.min(right, bounds.left + ancestor.clientLeft + ancestor.clientWidth); }
      if (ancestor !== el && /^(auto|scroll|hidden|clip)$/.test(style.overflowY)) { top = Math.max(top, bounds.top + ancestor.clientTop); bottom = Math.min(bottom, bounds.top + ancestor.clientTop + ancestor.clientHeight); }
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
        expect(await authState(page)).toEqual({ status, signedIn: signed, email: status === "mfa_enrollment" ? "mfa@example.test" : "person@example.test",
          owner: { origin: backend.origin, revision: expect.stringMatching(UUID) }, ...(signed ? {} : { candidate: expect.stringMatching(UUID) }) });
        await privateStateStaysInMain(app, page, backend.privateValues, rendererHttp);
        measurements.push({ locale, theme, state: status, copy, keyboard });
      };
      await enter(WRONG_CODE); await expect(page.locator(".systeme-login [role=alert]")).toHaveText(t["auth.failed"]);
      await expect(code).toHaveValue(WRONG_CODE); await expect(code).toBeEditable(); await expect(page.locator(".systeme-cell")).toHaveText([...WRONG_CODE]);
      await view("code_sent"); if (theme === "dark") await capture(page, `remote-locale-${locale}`);
      await readableGlyphs(locale, theme);
      await enter(CODE); await expect(page.locator(".systeme-login h1")).toHaveText(t["auth.signedIn"]);
      await page.reload(); await view("signed_in");
      await submit(page, { action: "logout" });
      const owner = (await authState(page)).owner!;
      await submit(page, { action: "email", email: "mfa@example.test", owner }); await page.reload();
      await enter(CODE); await expect(page.locator(".systeme-login .systeme-lead")).toHaveText(t["auth.continuationUnavailable"]);
      await page.reload(); await view("mfa_enrollment");
      const enrollment = await authState(page);
      const continuation = await submit(page, { action: "email", email: "verify@example.test", owner: enrollment.owner! });
      await submit(page, { action: "code", code: CODE, owner: continuation.owner! });
      await page.reload();
      for (const step of ["verify_email", "mfa"] as const) {
        const field = page.getByRole("textbox", { name: t[step === "verify_email" ? "auth.verifyEmailCodeLabel" : "login.codeLabel"], exact: true });
        await expect(field).toBeEditable();
        await expect(page.locator(".systeme-login h1")).toHaveText(t[step === "verify_email" ? "auth.verifyEmailTitle" : "auth.mfaTitle"]);
        await field.fill(step === "verify_email" ? EMAIL_CODE : CODE);
        const copy = await readable(".systeme-login h1, .systeme-login .systeme-lead, .systeme-login label, .systeme-login button");
        await page.locator(".content-top button").focus();
        const controls = page.locator(".systeme-login input, .systeme-login button");
        const keyboard = [];
        for (let i = 0; i < await controls.count(); i++) {
          await page.keyboard.press("Tab"); await expect(controls.nth(i)).toBeFocused();
          const control = (await geometry(".systeme-login input, .systeme-login button"))[i];
          expect(control.reachable, JSON.stringify({ step, index: i, control, hit: await controls.nth(i).evaluate((el) => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML; }) })).toBe(true); keyboard.push(control);
        }
        measurements.push({ locale, theme, state: step, copy, keyboard });
        await capture(page, `remote-continuation-${step}-${locale}-${theme}`);
        await field.focus(); await field.press("Enter");
      }
      await expect(page.locator(".systeme-login h1")).toHaveText(t["auth.signedIn"]);
    });
    expect(measurements).toHaveLength(112); expect(backend.count(CODE_PATH)).toBe(64);
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
