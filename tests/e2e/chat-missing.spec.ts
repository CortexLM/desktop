import { test, expect, type Page } from "@playwright/test";
import type { MessageWithParts, Session } from "@cortex/schema";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import shell from "../../packages/i18n/locales/en/shell.json" with { type: "json" };
import chat from "../../packages/i18n/locales/en/chat.json" with { type: "json" };
import common from "../../packages/i18n/locales/en/common.json" with { type: "json" };

const PROMPT = "Saved exchange before deleting this Chat.", ANSWER = "Hello from the streaming test provider. Everything works.";
const request = (page: Page, route: string, method: string, body?: unknown) => page.evaluate(async ({ route, method, body }) => {
  const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, {
    method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}, { route, method, body });

test("a failed deferred delete restores the Chat with an error", async () => {
  const { app, page } = await launch({ hash: "#/home?theme=light", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  try {
    const result = await request(page, "/api/sessions", "POST", { kind: "chat", title: "Delete failure", model: { providerID: "fake", modelID: "reasoner" } });
    expect(result.status).toBe(201);
    const session = result.body as Session;
    await page.evaluate(({ id }) => { location.hash = `#/chat?id=${id}&theme=light`; }, session);
    await expect(page.locator(".content-top .title")).toHaveText("Delete failure");
    await app.evaluate(async ({ ipcMain }) => {
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (event: unknown, req: { method: string }) => unknown> })._invokeHandlers;
      const original = handlers.get("cortex:fetch")!;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", (event, req) => req.method === "DELETE"
        ? { status: 500, headers: [["content-type", "application/json"]], body: JSON.stringify({ error: { code: "internal", message: "fixture refusal" } }) }
        : original(event, req));
    });
    await page.getByRole("button", { name: chat.options, exact: true }).click();
    await page.getByRole("menuitem", { name: chat["menu.delete"], exact: true }).click();
    await expect(page).toHaveURL(/#\/home/);
    await expect(page).toHaveURL(new RegExp(session.id), { timeout: 10_000 });
    await expect(page.getByText(chat["err.generic.title"], { exact: true })).toBeVisible();
    expect((await request(page, `/api/sessions/${session.id}`, "GET")).status).toBe(200);
  } finally { await app.close(); }
});

for (const theme of ["light", "dark"]) test(`Deleted Chat shows truthful missing-page recovery — ${theme}`, async () => {
  const fake = await startFakeProvider();
  const { app, page, dataDir } = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`,
  } }).catch(async (error) => { await fake.close(); throw error; });
  const errors: string[] = [], rendererHttp: string[] = [], calls: { route: string; method: string; status: number }[] = [];
  const evidence: Record<string, unknown> = { theme, dataDir, calls, errors, rendererHttp };
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (/^https?:/.test(r.url())) rendererHttp.push(r.url()); });
  const call = async <T,>(route: string, method = "GET", body?: unknown): Promise<T> => {
    const r = await request(page, route, method, body); calls.push({ route, method, status: r.status });
    expect(r.status).toBeGreaterThanOrEqual(200); expect(r.status).toBeLessThan(300); return r.body;
  };
  try {
    await page.emulateMedia({ reducedMotion: "reduce" }); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme); await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
    await call("/api/providers/fake/key", "PUT", { key: "sk-test-chat-missing" });
    const session = await call<Session>("/api/sessions", "POST", { kind: "chat", title: "Deleted Chat regression", model: { providerID: "fake", modelID: "reasoner" } });
    const route = `/api/sessions/${session.id}`; evidence.session = session;
    await page.evaluate(({ id, theme }) => { location.hash = `#/chat?id=${id}&theme=${theme}`; }, { id: session.id, theme });
    await expect(page.locator(".content-top .title")).toHaveText(session.title);
    await call(`${route}/prompt`, "POST", { parts: [{ type: "text", text: PROMPT }], reasoning: true });
    await expect.poll(async () => { const rows = await call<MessageWithParts[]>(`${route}/messages`); return rows.length === 2 && !!rows[1].info.time.completed && !rows[1].info.error; }).toBe(true);
    await expect(page.locator(".thread .msg-user")).toHaveText([PROMPT]); await expect(page.getByTestId("assistant-text")).toHaveText([ANSWER]);
    evidence.historyBeforeDelete = await call<MessageWithParts[]>(`${route}/messages`);
    expect(fake.requests).toHaveLength(1); expect(fake.requests[0].body.model).toBe("reasoner"); expect(fake.requests[0].auth).toBe("Bearer sk-test-chat-missing");
    await call(route, "DELETE"); await page.reload();
    expect(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("id")).toBe(session.id);
    const missing = await request(page, route, "GET"), missingHistory = await request(page, `${route}/messages`, "GET");
    evidence.missing = missing; evidence.missingHistory = missingHistory;
    for (const r of [missing, missingHistory]) { expect(r.status).toBe(404); expect(r.body.error.code).toBe("not_found"); }
    expect(await call<Session[]>("/api/sessions")).toEqual([]);
    await expect(page.locator(".thread .msg-user, [data-testid=assistant-text]")).toHaveCount(0);
    const alert = page.locator(".thread [role=alert]"); await expect(alert).toBeVisible(); await page.evaluate(() => document.fonts.ready);
    evidence.alert = { title: await alert.locator("b").innerText(), body: await alert.locator(".chat-grow > span").innerText() };
    const image = test.info().outputPath(`chat-missing-${theme}.png`); await page.screenshot({ path: image, animations: "disabled" });
    await test.info().attach("deleted-chat-card", { path: image, contentType: "image/png" });
    expect.soft(evidence.alert, "A real not_found must use the existing missing-page copy").toEqual({ title: shell["notFound.title"], body: shell["notFound.body"] });
    expect.soft(await alert.innerText(), "Deleted history must not claim a retained message").not.toContain(chat["err.generic.body"]);
    await expect(alert.getByRole("button", { name: common.retry, exact: true })).toHaveCount(0);
    await page.locator(".content-top").getByRole("button", { name: chat.newChat, exact: true }).click();
    await expect(page).toHaveURL(/#\/home(?:\?|$)/); await expect(page.locator(".home")).toBeVisible();
    await expect(page.getByTestId("composer-input")).toBeEditable(); await expect(page.getByTestId("composer-input")).toHaveValue("");
    await expect(page.locator(".thread, [role=alert]")).toHaveCount(0); expect(await call<Session[]>("/api/sessions")).toEqual([]);
    evidence.newChatRecovery = true; expect(fake.requests).toHaveLength(1); expect(errors).toEqual([]); expect(rendererHttp).toEqual([]);
  } finally {
    try { await test.info().attach("chat-missing-evidence", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" }); }
    finally { try { await app.close(); } finally { await fake.close(); } }
  }
});
