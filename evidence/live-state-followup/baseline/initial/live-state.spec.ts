import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import type { Event, MessageWithParts, Session } from "@cortex/schema";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const MODEL = { providerID: "fake", modelID: "reasoner" }, KEY = "sk-test-live-state";
const OLDER = "Earlier saved message must remain.", NEWER = "Newest streamed message must remain.";
const ANSWER = "Hello from the streaming test provider. Everything works.";
type WireRequest = { url: string; method: string; headers: [string, string][]; body?: string };
type WireResponse = { status: number; headers: [string, string][]; body: string };
type Gate = { armed: boolean; held?: WireResponse; returned: boolean; release?: () => void };

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
  const gate = (globalThis as unknown as { messageGate?: Gate }).messageGate;
  if (gate) { gate.armed = false; gate.release?.(); gate.release = undefined; }
});
async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const theme of ["light", "dark"]) for (const action of ["stream", "delete"]) {
  test(`Late initial Chat history cannot ${action === "stream" ? "erase a completed stream" : "revive a deleted session"} — ${theme}`, async () => {
    const fake = await startFakeProvider();
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, locale: "en", env: {
      CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`,
      CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`,
    } }).catch(async (error) => { await fake.close(); throw error; });
    const errors: string[] = [], rendererHttp: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", (request) => { if (/^https?:/.test(request.url())) rendererHttp.push(request.url()); });
    let stopProbe: (() => Promise<void>) | undefined;
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await call(page, "/api/providers/fake/key", "PUT", { key: KEY });
      const session = await call<Session>(page, "/api/sessions", "POST", { kind: "chat", title: "History race", model: MODEL });
      expect(session.model).toEqual(MODEL);
      const route = `/api/sessions/${session.id}`, historyPath = `${route}/messages`;
      const probe = await page.evaluateHandle((id) => {
        const probe = { connected: false, phase: "setup", events: [] as Event[], snapshots: [] as { phase: string; users: string[]; answers: string[] }[], sample: () => {}, stop: () => {} };
        probe.sample = () => {
          const row = { phase: probe.phase, users: [...document.querySelectorAll(".thread .msg-user")].map((e) => e.textContent ?? ""), answers: [...document.querySelectorAll('[data-testid="assistant-text"]')].map((e) => e.textContent ?? "") };
          if (JSON.stringify(row) !== JSON.stringify(probe.snapshots.at(-1))) probe.snapshots.push(row);
        };
        const observer = new MutationObserver(probe.sample);
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
        let buffer = "";
        const off = (window as unknown as { cortex: { events: (fn: (chunk: string) => void) => () => void } }).cortex.events((chunk) => {
          buffer += chunk;
          let end: number;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (frame === ": connected") probe.connected = true;
            const data = frame.split("\n").find((line) => line.startsWith("data:"))?.slice(5);
            if (!data) continue;
            const event = JSON.parse(data) as Event, p = event.properties;
            const owner = "sessionID" in p ? p.sessionID : "message" in p ? p.message.sessionID : "part" in p ? p.part.sessionID : "session" in p ? p.session.id : undefined;
            if (owner === id) probe.events.push(event);
          }
        });
        probe.stop = () => { observer.disconnect(); off(); };
        return probe;
      }, session.id);
      stopProbe = async () => {
        try { await test.info().attach("live-state-evidence", { body: JSON.stringify(await probe.evaluate((p) => ({ events: p.events, snapshots: p.snapshots })), null, 2), contentType: "application/json" }); }
        finally { try { await probe.evaluate((p) => p.stop()); } finally { await probe.dispose(); } }
      };
      await expect.poll(() => probe.evaluate((p) => p.connected)).toBe(true);
      const prompt = (text: string) => call(page, `${route}/prompt`, "POST", { parts: [{ type: "text", text }], reasoning: true });
      const completed = async (count: number) => {
        await expect.poll(async () => {
          const messages = await call<MessageWithParts[]>(page, historyPath), last = messages.at(-1);
          return messages.length === count && last?.info.time.completed && !last.info.error
            ? last.parts.filter((p) => p.type === "text").map((p) => p.text).join("") : "";
        }).toBe(ANSWER);
      };
      await prompt(OLDER); await completed(2);
      await expect.poll(() => probe.evaluate((p) => p.events.filter((e) => e.type === "session.status" && e.properties.status.type === "idle").length)).toBe(1);
      await app.evaluate(({ ipcMain }, historyPath) => {
        const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: WireRequest) => Promise<WireResponse>> })._invokeHandlers.get("cortex:fetch")!;
        const gate: Gate = { armed: true, returned: false };
        (globalThis as unknown as { messageGate: Gate }).messageGate = gate;
        ipcMain.removeHandler("cortex:fetch");
        ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
          const hold = gate.armed && request.method === "GET" && new URL(request.url).pathname === historyPath;
          if (hold) gate.armed = false;
          const response = await original(event, request);
          if (hold) {
            // Delay one completed real snapshot only; all other IPC and SSE remain live.
            gate.held = response;
            await new Promise<void>((resolve) => { gate.release = resolve; });
            gate.returned = true;
          }
          return response;
        });
      }, historyPath);
      await page.evaluate(({ id, theme }) => history.pushState(null, "", `#/chat?id=${id}&theme=${theme}`), { id: session.id, theme });
      await expect(page.locator(".content-top .title")).toHaveText("History race");
      await expect.poll(() => app.evaluate(() => !!(globalThis as unknown as { messageGate: Gate }).messageGate.release)).toBe(true);
      const held = await app.evaluate(() => (globalThis as unknown as { messageGate: Gate }).messageGate.held!);
      expect(held.status).toBe(200);
      const oldMessages = JSON.parse(held.body) as MessageWithParts[];
      expect(oldMessages).toHaveLength(2);
      expect(oldMessages[0].parts).toContainEqual(expect.objectContaining({ type: "text", text: OLDER }));
      await test.info().attach("held-real-history", { body: held.body, contentType: "application/json" });
      await expect(page.locator(".thread .msg-user")).toHaveCount(0);
      if (action === "stream") {
        await prompt(NEWER); await completed(4);
        await expect.poll(() => probe.evaluate((p) => p.events.filter((e) => e.type === "session.status" && e.properties.status.type === "idle").length)).toBe(2);
        await expect(page.locator(".thread .msg-user")).toHaveText([NEWER]);
        await expect(page.getByTestId("assistant-text")).toHaveText([ANSWER]);
      } else {
        await call(page, route, "DELETE");
        await expect.poll(() => probe.evaluate((p) => p.events.some((e) => e.type === "session.deleted"))).toBe(true);
        expect((await call<Session[]>(page, "/api/sessions")).some((s) => s.id === session.id)).toBe(false);
        await expect(page.locator(".thread .msg-user, [data-testid=assistant-text]")).toHaveCount(0);
      }
      await probe.evaluate((p) => { p.phase = "before-release"; p.sample(); });
      await capture(page, "before-history-release");
      expect(await app.evaluate(() => (globalThis as unknown as { messageGate: Gate }).messageGate.returned)).toBe(false);
      expect(fake.requests).toHaveLength(action === "stream" ? 2 : 1);
      for (const request of fake.requests) { expect(request.auth).toBe(`Bearer ${KEY}`); expect(request.body.model).toBe(MODEL.modelID); }
      await release(app);
      await expect.poll(() => app.evaluate(() => (globalThis as unknown as { messageGate: Gate }).messageGate.returned)).toBe(true);
      // Fence the released IPC response with another real round trip, then let React paint.
      await call(page, "/api/health");
      await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
      await probe.evaluate((p) => { p.phase = "after-release"; p.sample(); });
      await capture(page, "after-history-release");
      expect(errors).toEqual([]); expect(rendererHttp).toEqual([]);
      if (action === "stream") {
        await expect(page.locator(".thread .msg-user")).toHaveText([OLDER, NEWER]);
        await expect(page.getByTestId("assistant-text")).toHaveText([ANSWER, ANSWER]);
        expect(await probe.evaluate((p) => p.snapshots.filter((s) => s.phase !== "setup").every((s) => s.users.includes("Newest streamed message must remain.")))).toBe(true);
      } else {
        expect(await probe.evaluate((p) => p.snapshots.filter((s) => s.phase !== "setup").every((s) => !s.users.length && !s.answers.length)), "Deleted history must never reappear").toBe(true);
        await expect(page.locator(".thread .msg-user, [data-testid=assistant-text]")).toHaveCount(0);
      }
    } catch (error) {
      try { await capture(page, "failure"); } finally { throw error; }
    } finally {
      try { await test.info().attach("live-state-errors", { body: JSON.stringify({ errors, rendererHttp }), contentType: "application/json" }); }
      finally { try { await stopProbe?.(); } finally { try { await release(app); } finally { try { await app.close(); } finally { await fake.close(); } } } }
    }
  });
}
