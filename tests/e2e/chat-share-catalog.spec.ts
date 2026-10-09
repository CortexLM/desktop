import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { launch } from "./fixtures";

const conversation = "cnv_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const shareID = "11111111-1111-4111-8111-111111111111";

for (const theme of ["light", "dark"]) test(`authenticated text-model Share survives catalog loading — ${theme}`, async () => {
  const requests: string[] = [];
  let shares: unknown[] = [];
  const row = { id: shareID, slug: "test", url_path: "/s/test", conversation_id: conversation, created_at: "2026-10-09T00:00:00Z" };
  const server = createServer((req, res) => void (async () => {
    for await (const chunk of req) void chunk;
    const route = new URL(req.url!, "http://localhost").pathname;
    requests.push(`${req.method} ${route}`);
    const json = (body: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    if (route === "/readyz") { res.end("ok"); return; }
    if (route === "/v1/instance") return json({ mode: "self_host", version: "test", auth: { mode: "cortex", required: true, providers: ["cortex"] }, registry: { enabled: true } });
    if (route === "/v1/auth/magic-auth") return json({}, 204);
    if (route === "/v1/auth/magic-auth/verify") return json({ status: "session", access_token: "test-only-share" });
    if (route === "/v1/registry/models") return json({ items: [{ id: "fixture", name: "Cortex Fixture", configured: true, capabilities: { reasoning: false, image: false, tools: false, context_tokens: 8192, output_tokens: 1024 } }], source: "cache", has_more: false });
    if (route === "/v1/conversations") return json({ items: [{ id: conversation, title: "Saved conversation", model_slug: "fixture", last_message_at: "2026-10-09T00:00:00Z", message_count: 2 }], has_more: false });
    if (route === "/v1/conversation-shares" && req.method === "GET") return json({ items: shares });
    if (route === `/v1/conversations/${conversation}/shares`) { shares = [row]; return json(row); }
    if (route === `/v1/conversation-shares/${shareID}` && req.method === "DELETE") { shares = []; return json({}, 204); }
    if (route === "/v1/mascots" || route === "/v1/notifications") return json({ items: [], has_more: false });
    if (route === "/v1/bot/inbox") return json({ items: [], working_mascot_ids: [] });
    return json({}, 404);
  })().catch(() => { res.statusCode = 500; res.end(); }));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { app, page } = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByTestId("composer-input").waitFor();
    await page.evaluate(async url => {
      const call = async (route: string, method = "GET", body?: unknown) => {
        const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        if (!response.ok) throw new Error(`${route}: ${response.status}`);
        return response.json();
      };
      await call("/api/connection", "PUT", { mode: "selfhost", url, signedIn: false });
      const { owner } = await call("/api/connection/auth");
      const pending = await call("/api/connection/auth", "POST", { action: "email", owner, email: "share@example.test" });
      await call("/api/connection/auth", "POST", { action: "code", owner: pending.owner, code: "123456" });
    }, `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    await page.reload();
    await expect(page.getByTestId("remote-model-trigger")).toBeEnabled();
    await page.getByTestId("composer-input").fill("Retained draft");
    await expect(page.getByTestId("composer-send")).toBeEnabled();
    await expect(page.locator(".chat-err")).toHaveCount(0);
    await page.evaluate(() => history.pushState(null, "", `#/share?theme=${document.documentElement.dataset.theme}`));
    await expect(page.getByTestId("screen-share")).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("chat-share-create")).toBeEnabled();
    await page.getByTestId("chat-share-create").click();
    await expect(page.getByTestId("chat-share-row")).toContainText("/s/test");
    for (const width of [1440, 960]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0]!.setSize(width, width === 960 ? 640 : 900), width);
      const screenshot = test.info().outputPath(`share-${theme}-${width}.png`);
      await page.screenshot({ path: screenshot });
      await test.info().attach(`share-${width}`, { path: screenshot, contentType: "image/png" });
    }
    await page.getByTestId("chat-share-row").getByRole("button").click();
    await expect(page.getByTestId("chat-share-row")).toHaveCount(0);
    expect(requests).toContain(`POST /v1/conversations/${conversation}/shares`);
    expect(requests).toContain(`DELETE /v1/conversation-shares/${shareID}`);
    await test.info().attach("requests", { body: JSON.stringify(requests, null, 2), contentType: "application/json" });
  } finally {
    await app.close(); server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
