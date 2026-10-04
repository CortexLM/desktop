import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import type { Bot, MessageWithParts, Session } from "@cortex/schema";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const MODEL = { providerID: "fake", modelID: "reasoner" }, KEY = "sk-test-bot-owner";
const ALPHA = "Alpha first request", BETA = "Beta saved request", NEXT = "Intended for Beta after navigation";
const ANSWER = "Hello from the streaming test provider. Everything works.";
type WireRequest = { url: string; method: string; headers: [string, string][]; body?: string };
type WireResponse = { status: number; headers: [string, string][]; body: string };
type Gate = { armed: boolean; held?: WireResponse; returned: boolean; release?: () => void; prompts: string[] };
const users = (messages: MessageWithParts[]) => messages.filter((m) => m.info.role === "user").flatMap((m) => m.parts.filter((p) => p.type === "text").map((p) => p.text));

async function call<T>(page: Page, route: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ route, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${method} ${route}: ${r.status}`);
    return r.json();
  }, { route, method, body });
}
const release = (app: ElectronApplication) => app.evaluate(() => {
  const gate = (globalThis as unknown as { botOwnerGate?: Gate }).botOwnerGate;
  if (gate) { gate.armed = false; gate.release?.(); gate.release = undefined; }
});
async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const theme of ["light", "dark"]) test(`Bot route ownership replaces the selected session before displaying or sending — ${theme}`, async () => {
  const fake = await startFakeProvider();
  const { app, page } = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`,
    CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`,
  } }).catch(async (error) => { await fake.close(); throw error; });
  const errors: string[] = [], rendererHttp: string[] = [], evidence: Record<string, unknown> = { theme };
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (/^https?:/.test(request.url())) rendererHttp.push(request.url()); });
  let stopProbe: (() => Promise<void>) | undefined;
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await call(page, "/api/providers/fake/key", "PUT", { key: KEY });
    const alpha = await call<Bot>(page, "/api/bots", "POST", { name: "Review Alpha", persona: "Alpha", model: MODEL });
    const beta = await call<Bot>(page, "/api/bots", "POST", { name: "Review Beta", persona: "Beta", model: MODEL });
    const betaSession = await call<Session>(page, `/api/bots/${beta.id}/sessions`, "POST", {});
    const history = (id: string) => call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
    const completed = (id: string) => expect.poll(async () => {
      const messages = await history(id), last = messages.at(-1);
      return messages.length === 2 && last?.info.time.completed && !last.info.error ? last.parts.filter((p) => p.type === "text").map((p) => p.text).join("") : "";
    }).toBe(ANSWER);
    await call(page, `/api/sessions/${betaSession.id}/prompt`, "POST", { parts: [{ type: "text", text: BETA }] });
    await completed(betaSession.id);
    expect(await call<Session[]>(page, `/api/bots/${alpha.id}/sessions`)).toEqual([]);
    await page.evaluate(({ id, theme }) => window.history.pushState(null, "", `#/bot?id=${id}&theme=${theme}`), { id: alpha.id, theme });
    await expect(page.locator(".content-top .title")).toHaveText(alpha.name);
    await page.getByTestId("composer-input").fill(ALPHA); await page.getByTestId("composer-send").click();
    await expect(page.locator(".thread-inner .msg-user")).toHaveText([ALPHA]);
    const alphaSessions = await call<Session[]>(page, `/api/bots/${alpha.id}/sessions`);
    expect(alphaSessions).toHaveLength(1);
    const alphaSession = alphaSessions[0];
    expect(alphaSession.botID).toBe(alpha.id); expect(betaSession.botID).toBe(beta.id);
    await completed(alphaSession.id);
    evidence.sessions = { alpha: alphaSession, beta: betaSession };
    const probe = await page.evaluateHandle(() => {
      const p = { snapshots: [] as { title: string; users: string[]; answers: string[] }[], sample: () => {}, stop: () => {} };
      p.sample = () => {
        const row = { title: document.querySelector(".content-top .title")?.textContent ?? "", users: [...document.querySelectorAll(".thread-inner .msg-user")].map((e) => e.textContent ?? ""), answers: [...document.querySelectorAll(".thread-inner .msg-bot")].map((e) => e.textContent ?? "") };
        if (JSON.stringify(row) !== JSON.stringify(p.snapshots.at(-1))) p.snapshots.push(row);
      };
      const observer = new MutationObserver(p.sample);
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      p.stop = () => observer.disconnect(); p.sample(); return p;
    });
    stopProbe = async () => {
      try { evidence.snapshots = await probe.evaluate((p) => p.snapshots); }
      finally { try { await probe.evaluate((p) => p.stop()); } finally { await probe.dispose(); } }
    };
    await app.evaluate(({ ipcMain }, path) => {
      const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: WireRequest) => Promise<WireResponse>> })._invokeHandlers.get("cortex:fetch")!;
      const gate: Gate = { armed: true, returned: false, prompts: [] };
      (globalThis as unknown as { botOwnerGate: Gate }).botOwnerGate = gate;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
        const route = new URL(request.url).pathname, hold = gate.armed && request.method === "GET" && route === path;
        if (hold) gate.armed = false;
        if (request.method === "POST" && /^\/api\/sessions\/[^/]+\/prompt$/.test(route)) gate.prompts.push(route);
        const response = await original(event, request);
        if (hold) { gate.held = response; await new Promise<void>((resolve) => { gate.release = resolve; }); gate.returned = true; }
        return response;
      });
    }, `/api/bots/${beta.id}/sessions`);
    await page.locator("button.roster-item").filter({ hasText: beta.name }).click();
    await expect(page.locator(".content-top .title")).toHaveText(beta.name);
    await expect.poll(() => app.evaluate(() => !!(globalThis as unknown as { botOwnerGate: Gate }).botOwnerGate.release)).toBe(true);
    const held = await app.evaluate(() => (globalThis as unknown as { botOwnerGate: Gate }).botOwnerGate.held!);
    const heldSessions = JSON.parse(held.body) as Session[];
    expect(held.status).toBe(200); expect(heldSessions).toHaveLength(1);
    expect(heldSessions[0]).toMatchObject({ id: betaSession.id, botID: beta.id, model: MODEL });
    await probe.evaluate((p) => p.sample());
    evidence.held = held; evidence.whileHeld = { users: await page.locator(".thread-inner .msg-user").allTextContents(), answers: await page.locator(".thread-inner .msg-bot").allTextContents() };
    await capture(page, "beta-list-held");
    expect(await app.evaluate(() => (globalThis as unknown as { botOwnerGate: Gate }).botOwnerGate.returned)).toBe(false);
    // Keep ownership failures soft so the actual write destination is also exercised.
    expect.soft(evidence.whileHeld, "Alpha must not render under Beta while its session list is loading").toEqual({ users: [], answers: [] });
    await release(app);
    await expect.poll(() => app.evaluate(() => (globalThis as unknown as { botOwnerGate: Gate }).botOwnerGate.returned)).toBe(true);
    await call(page, "/api/health");
    await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
    await expect.soft(page.locator(".thread-inner .msg-user"), "Released Beta history must replace Alpha").toHaveText([BETA]);
    await expect(page.locator(".thread-inner .msg-bot")).toHaveText([ANSWER]);
    evidence.afterRelease = await page.locator(".thread-inner .msg-user").allTextContents();
    await capture(page, "beta-list-released");
    await page.getByTestId("composer-input").fill(NEXT); await page.getByTestId("composer-send").click();
    await expect.poll(() => fake.requests.length).toBe(3);
    await expect.poll(async () => {
      const messages = [...await history(alphaSession.id), ...await history(betaSession.id)];
      return messages.length === 6 && messages.filter((m) => m.info.role === "assistant").every((m) => m.info.time.completed !== undefined && !m.info.error);
    }).toBe(true);
    const alphaMessages = await history(alphaSession.id), betaMessages = await history(betaSession.id);
    const prompts = await app.evaluate(() => (globalThis as unknown as { botOwnerGate: Gate }).botOwnerGate.prompts);
    evidence.alphaMessages = alphaMessages; evidence.betaMessages = betaMessages; evidence.prompts = prompts;
    await probe.evaluate((p) => p.sample());
    expect.soft(await probe.evaluate((p, { name, text }) => p.snapshots.filter((s) => s.title === name).every((s) => !s.users.includes(text)), { name: beta.name, text: ALPHA }), "Beta must never transiently render Alpha history").toBe(true);
    expect.soft(prompts, "Beta composer must address Beta's session").toEqual([`/api/sessions/${betaSession.id}/prompt`]);
    expect.soft(users(betaMessages), "Beta must persist its own follow-up").toEqual([BETA, NEXT]);
    expect.soft(users(alphaMessages), "Alpha must remain unchanged after navigating to Beta").toEqual([ALPHA]);
    for (const request of fake.requests) { expect(request.auth).toBe(`Bearer ${KEY}`); expect(request.body.model).toBe(MODEL.modelID); }
    expect(errors).toEqual([]); expect(rendererHttp).toEqual([]);
    await capture(page, "beta-after-send");
  } catch (error) { await capture(page, "failure"); throw error; }
  finally {
    try { await stopProbe?.(); }
    finally {
      try { await test.info().attach("bot-owner-evidence", { body: JSON.stringify({ ...evidence, errors, rendererHttp }, null, 2), contentType: "application/json" }); }
      finally { try { await release(app); } finally { try { await app.close(); } finally { await fake.close(); } } }
    }
  }
});
