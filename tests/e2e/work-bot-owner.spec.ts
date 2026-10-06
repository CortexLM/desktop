import { test, expect, type ElectronApplication } from "@playwright/test";
import fs from "node:fs";
import { launch } from "./fixtures";

const id = "00000000-0000-4000-8000-000000000001";
type Wire = { url: string; method: string; body?: string };
type Gate = { epoch: string; defer: boolean; parentHeld: boolean; calls: number; arrival: Promise<void>; held: Promise<void>; arrived(): void; release(): void };
async function install(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }, id) => {
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<unknown>> })._invokeHandlers.get("cortex:fetch")!;
    let arrived!: () => void, release!: () => void;
    const gate: Gate = { epoch: "old", defer: false, parentHeld: false, calls: 0, arrival: new Promise<void>(r => { arrived = r; }), held: new Promise<void>(r => { release = r; }), arrived: () => arrived(), release: () => release() };
    (globalThis as unknown as { workBotGate: Gate }).workBotGate = gate;
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname;
      const bot = { id, name: "Owner", description: "", label: "", look: "meadow", shape: "dots", notifications: true, status: "idle", computer_kind: "cloud", updated_at: "now" };
      let body: unknown;
      if (path === "/api/connection") body = { mode: "cloud", signedIn: true };
      else if (path === "/api/work-bot") {
        const epoch = gate.epoch;
        if (gate.defer) { gate.arrived(); await gate.held; }
        body = { epoch, bots: [{ ...bot, label: epoch === "old" ? "Old specialty" : "New specialty" }] };
      }
      else if (path.endsWith("/cancel")) return { status: 503, headers: [["Content-Type", "application/json"]], body: JSON.stringify({ error: { code: "provider_error", message: "unconfirmed" } }) };
      else if (path.endsWith("/messages") && path.startsWith("/api/work-bot/")) {
        gate.calls++; gate.arrived(); if (gate.parentHeld) await gate.held;
        body = { message: { id, sender: "user", kind: "text", text: "old submission", at: "now", responded: false, dismissed: false }, replies: [] };
      }
      else if (path.endsWith("/snapshot") && path.startsWith("/api/work-bot/")) {
        const epoch = gate.epoch;
        if (gate.defer) { gate.arrived(); await gate.held; }
        body = { epoch, bot, computerAvailable: false, messages: [{ id, sender: "mascot", kind: "notice", text: epoch === "old" ? "OLD_OWNER_NOTICE" : "NEW_OWNER_NOTICE", at: "now", dismissed: false, responded: false }], jobs: [{ id, kind: "explore", goal: "Running owner job", status: "running", created_at: "now" }] };
      } else return original(event, request);
      return { status: 200, headers: [["Content-Type", "application/json"]], body: JSON.stringify(body) };
    });
  }, id);
}

test("Work Bot replacement rejects late original-owner snapshot", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await install(app);
    await page.evaluate(id => { location.hash = `#/bot?id=${id}&epoch=old`; }, id);
    await expect(page.getByTestId("work-bot-parent")).toContainText("OLD_OWNER_NOTICE");
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.defer = true; });
    const entered = app.evaluate(() => (globalThis as unknown as { workBotGate: Gate }).workBotGate.arrival);
    await page.getByTestId("work-bot-reconnect").click(); await entered;
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.epoch = "new"; });
    await page.evaluate(id => { location.hash = `#/bot?id=${id}&epoch=new`; }, id);
    await expect(page.getByTestId("work-bot-parent")).toHaveCount(0);
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.release(); });
    await expect(page.getByTestId("work-bot-parent")).toContainText("NEW_OWNER_NOTICE");
    await expect(page.getByTestId("work-bot-parent")).not.toContainText("OLD_OWNER_NOTICE");
  } finally { await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate?.release(); }).catch(() => {}); await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("Work Bot failed Stop remains unconfirmed with running backend status", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await install(app);
    await page.evaluate(id => { location.hash = `#/bot?id=${id}&epoch=old`; }, id);
    await page.getByTestId("work-bot-cancel").click();
    await expect(page.getByTestId("work-bot-cancel-unconfirmed")).toBeVisible();
    await expect(page.getByTestId("work-bot-job")).toHaveAttribute("data-status", "running");
    await expect(page.getByTestId("work-bot-cancel")).toBeEnabled();
  } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("Work Bot old parent POST completion cannot clear replacement-owner draft", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await install(app);
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.parentHeld = true; });
    await page.evaluate(id => { location.hash = `#/bot?id=${id}&epoch=old`; }, id);
    await page.getByTestId("work-bot-parent-input").fill("old submission");
    const entered = app.evaluate(() => (globalThis as unknown as { workBotGate: Gate }).workBotGate.arrival);
    await page.getByTestId("work-bot-parent-send").click(); await entered;
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.epoch = "new"; });
    await page.evaluate(id => { location.hash = `#/bot?id=${id}&epoch=new`; }, id);
    await expect(page.getByTestId("work-bot-parent")).toContainText("NEW_OWNER_NOTICE");
    await page.getByTestId("work-bot-parent-input").fill("new owner draft");
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.release(); });
    await expect(page.getByTestId("work-bot-parent-input")).toHaveValue("new owner draft");
    expect(await app.evaluate(() => (globalThis as unknown as { workBotGate: Gate }).workBotGate.calls)).toBe(1);
  } finally { await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate?.release(); }).catch(() => {}); await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("Owned specialist roster rejects held previous-owner list before configuration", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await install(app);
    await page.evaluate(() => { location.hash = "#/bot-roster"; });
    await expect(page.getByTestId("work-bot-specialty")).toHaveText("Old specialty");
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.defer = true; });
    const entered = app.evaluate(() => (globalThis as unknown as { workBotGate: Gate }).workBotGate.arrival);
    await page.getByTestId("work-bot-reconnect").click(); await entered;
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.epoch = "new"; });
    await page.evaluate(() => { location.hash = "#/bot-roster?epoch=new"; });
    await expect(page.getByTestId("work-bot-specialty")).toHaveCount(0);
    await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate.release(); });
    await expect(page.getByTestId("work-bot-specialty")).toHaveText("New specialty");
    await page.getByTestId("work-bot-specialty-configure").click();
    expect(await page.evaluate(() => new URLSearchParams(location.hash.split("?")[1]).get("epoch"))).toBe("new");
  } finally { await app.evaluate(() => { (globalThis as unknown as { workBotGate: Gate }).workBotGate?.release(); }).catch(() => {}); await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});
