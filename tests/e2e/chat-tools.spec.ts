import { test as base, expect, type Page } from "@playwright/test";
import http from "node:http";
import type { RemoteAuthState } from "@cortex/schema";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import chatCopy from "../../packages/i18n/locales/en/chat.json" with { type: "json" };
import extrasCopy from "../../packages/i18n/locales/en/extras.json" with { type: "json" };
import { launch } from "./fixtures";

const conversation = "cnv_01h45ytscbeewvwm6xr90nbxq1";
const user = "msg_01h45ytscbeewvwm6xr90nbxq2", planMessage = "msg_01h45ytscbeewvwm6xr90nbxq3";
const runUser = "msg_01h45ytscbeewvwm6xr90nbxq4", report = "msg_01h45ytscbeewvwm6xr90nbxq5";
const image = "lbf_01h45ytscbeewvwm6xr90nbxq6";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const at = (s: number) => `2026-10-07T00:00:0${s}.000Z`;
const msg = (id: string, role: string, text: string, s: number, extra: Record<string, unknown> = {}) =>
  ({ id, parent_message_id: null, role, text, created_at: at(s), version_index: 0, version_count: 1, is_active_version: true, ...extra });

// Only HTTP responses are fixtures; admission, validation and image transport run in the built Electron main process.
async function trunk() {
  const turns: Record<string, unknown>[] = [], errors: string[] = [];
  let messages: unknown[] = [];
  const json = (res: http.ServerResponse, body: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const server = http.createServer((req, res) => void (async () => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(Buffer.from(c));
    const route = new URL(req.url!, "http://x").pathname;
    if (route === "/v1/instance") return json(res, { mode: "self_host", version: "test", auth: { mode: "cortex", required: true, providers: ["cortex"] }, registry: { enabled: true } });
    if (route === "/v1/registry/models") return json(res, { items: [{ id: "fixture", name: "Cortex Fixture", configured: true, capabilities: { reasoning: false, image: true, tools: true, context_tokens: 8192, output_tokens: 1024 } }], source: "cache", has_more: false });
    if (req.method === "POST" && route === "/v1/auth/magic-auth") { res.writeHead(204); res.end(); return; }
    if (req.method === "POST" && route === "/v1/auth/refresh") { res.writeHead(401); res.end(); return; }
    if (req.method === "POST" && route === "/v1/auth/magic-auth/verify") return json(res, { status: "session", access_token: "test-only-tools-token" });
    if (req.method === "POST" && (route === "/v1/conversations/turns" || route === `/v1/conversations/${conversation}/turns`)) {
      const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
      turns.push({ route, body, idempotency: req.headers["idempotency-key"] });
      res.writeHead(200, { "content-type": "text/event-stream", "x-conversation-id": conversation, "x-message-id": turns.length === 1 ? planMessage : report });
      res.end("data: {}\n\n"); return;
    }
    if (route === `/v1/conversations/${conversation}/messages`) return json(res, { items: messages, has_more: false, has_older: false, has_newer: false });
    if (route === "/v1/library") return json(res, { items: [{ id: image }], has_more: false });
    if (route === `/v1/library/${image}/content`) { res.writeHead(200, { "content-type": "image/png" }); res.end(png); return; }
    errors.push(`${req.method} ${route}`); json(res, { code: "not_found" }, 404);
  })().catch((e: unknown) => { errors.push(String(e)); res.statusCode = 500; res.end(); }));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return {
    origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, turns, errors,
    set(next: unknown[]) { messages = next; },
    async close() { server.closeAllConnections(); await new Promise<void>((r, j) => server.close((e) => e ? j(e) : r())); },
  };
}

async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ route, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(`${method} ${route}: ${r.status}`);
    return r.json();
  }, { route, method, body });
}
const show = (page: Page, route: string) => page.evaluate((r) => history.pushState(null, "", `#/${r}`), route);

const test = base.extend<{ tools: { page: Page; backend: Awaited<ReturnType<typeof trunk>> } }>({
  tools: async ({}, use) => {
    const backend = await trunk();
    let app: Awaited<ReturnType<typeof launch>>["app"] | undefined;
    const pageErrors: string[] = [];
    try {
      const launched = await launch({ hash: "#/settings?section=connection", locale: "en", env: { CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify({ fake: catalog.fake }))}`, CORTEX_TEST_PROVIDER_BASEURL: "" } });
      app = launched.app;
      const page = launched.page;
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await call(page, "/api/connection", "PUT", { mode: "selfhost", url: backend.origin, signedIn: false });
      const { owner } = await call<RemoteAuthState>(page, "/api/connection/auth");
      const pending = await call<RemoteAuthState>(page, "/api/connection/auth", "POST", { action: "email", owner, email: "tools@example.test" });
      expect((await call<RemoteAuthState>(page, "/api/connection/auth", "POST", { action: "code", owner: pending.owner, code: "123456" })).signedIn).toBe(true);
      await use({ page, backend });
      expect(pageErrors).toEqual([]);
      expect(backend.errors).toEqual([]);
    } finally {
      try { await app?.close(); } finally { await backend.close(); }
    }
  },
});

test("deep research plans, runs the edited plan and shows the cited report", async ({ tools: { page, backend } }) => {
  await show(page, "deep-research");
  const root = page.getByTestId("screen-deep-research");
  await expect(root.getByRole("heading", { name: chatCopy["tools.research.title"] })).toBeVisible();
  await expect(root.locator(".content-top")).toHaveCSS("height", "56px");
  backend.set([msg(user, "user", "Ceramics market", 1), msg(planMessage, "assistant", "", 2, { finish_reason: "stop", research_plan: { title: "Ceramics market", questions: ["Size", "Buyers"], outline: [] } })]);
  await root.getByTestId("chat-tool-input").fill("Ceramics market");
  await root.getByTestId("chat-tool-send").click();
  await expect(root.getByTestId("chat-research-plan")).toContainText("Buyers");
  expect(backend.turns[0]).toMatchObject({ route: "/v1/conversations/turns", body: { message: "Ceramics market", research: { action: "plan" } } });
  await root.getByRole("button", { name: chatCopy["deep.editPlan"] }).click();
  await root.getByLabel(chatCopy["deep.step"].replace("{n}", "2")).fill("Buyers in Lyon");
  await root.getByRole("button", { name: chatCopy["deep.finish"] }).click();
  backend.set([msg(user, "user", "Ceramics market", 1), msg(planMessage, "assistant", "", 2, { finish_reason: "stop", research_plan: { title: "Ceramics market", questions: ["Size", "Buyers in Lyon"] } }),
    msg(runUser, "user", "Ceramics market", 3), msg(report, "assistant", "# Size\nThe market grows.\n# Buyers\nShops lead.", 4, { finish_reason: "stop", citations: [{ url: "https://example.org/a", title: "Market study", domain: "example.org" }] })]);
  await root.getByTestId("chat-research-start").click();
  await expect(root.getByTestId("chat-research-report")).toContainText("The market grows.");
  await expect(root.getByTestId("chat-tool-sources")).toContainText("Market study");
  expect(backend.turns[1]).toMatchObject({ route: `/v1/conversations/${conversation}/turns`, body: { research: { action: "run", plan: { title: "Ceramics market", questions: ["Size", "Buyers in Lyon"] } } } });
  expect(backend.turns[0]!.idempotency).not.toBe(backend.turns[1]!.idempotency);
});

test("images: guided start, owned recent images and a generated result", async ({ tools: { page, backend } }) => {
  await show(page, "image-gen");
  const root = page.getByTestId("screen-image-gen");
  await expect(root.getByRole("heading", { name: chatCopy["tools.image.title"] })).toBeVisible();
  await expect(root.getByTestId("chat-image-recent").getByTestId("chat-image-tile").locator(".chat-gimg")).toHaveAttribute("style", /data:image\/png;base64/);
  await root.getByRole("button", { name: chatCopy["image.fmt.square"].replace("{ratio}", "1:1") }).click();
  backend.set([msg(user, "user", "A stand", 1), msg(report, "assistant", "Here it is.", 2, { finish_reason: "stop", generated_images: [{ generation_id: "g1", file_id: image, retention: "retained", content_type: "image/png", byte_size: png.length }] })]);
  await root.getByTestId("chat-tool-input").fill("A ceramics stand");
  await root.getByTestId("chat-tool-send").click();
  await expect(root.getByTestId("chat-image-result").getByTestId("chat-image-tile")).toHaveCount(1);
  expect(backend.turns[0]).toMatchObject({ body: { message: "Create an image (Square 1:1): A ceramics stand" } });
});

test("web search and temporary chat send real turns; widgets and library carry no server jargon", async ({ tools: { page, backend } }) => {
  await show(page, "search-results");
  const search = page.getByTestId("screen-search-results");
  await expect(search.getByRole("heading", { name: chatCopy["tools.search.title"] })).toBeVisible();
  backend.set([msg(user, "user", "Search the web: salons 2026", 1), msg(report, "assistant", "Eight fairs.", 2, { finish_reason: "stop", citations: [{ url: "https://example.org/fairs", title: "Fair calendar", domain: "example.org" }] })]);
  await search.getByTestId("chat-tool-input").fill("salons 2026");
  await search.getByTestId("chat-tool-send").click();
  await expect(search.getByTestId("chat-tool-answer")).toHaveText("Eight fairs.");
  await expect(search.getByTestId("chat-tool-sources")).toContainText("Fair calendar");
  await expect(search.locator(".content-top .title")).toHaveText("salons 2026");

  await show(page, "temp-chat");
  const temp = page.getByTestId("screen-temp-chat");
  await expect(temp.getByText(chatCopy["temp.notSaved"])).toBeVisible();
  await temp.getByTestId("chat-tool-input").fill("Secret plan");
  await temp.getByTestId("chat-tool-send").click();
  await expect(temp.getByTestId("chat-tool-answer")).toHaveText("Eight fairs.");
  expect(backend.turns.at(-1)).toMatchObject({ route: "/v1/conversations/turns", body: { message: "Secret plan", temporary: true } });

  await show(page, "library");
  await expect(page.getByTestId("library-empty")).toContainText(chatCopy["library.emptyTitle"]);
  await page.getByTestId("library-new-project").click();
  await expect(page).toHaveURL(/#\/projects\?v=create/);
  await show(page, "library-dashboard");
  await expect(page.getByTestId("widgets-new-chat")).toBeVisible();
  await expect(page.getByText(/not available on this server/)).toHaveCount(0);
  expect(Object.keys(extrasCopy)).not.toContain("widgets.notice");
});
