import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { launch } from "./fixtures";

test("late old-owner hierarchy PATCH cannot alter replacement lead selection", async () => {
  const { app, page, dataDir } = await launch();
  const id = "00000000-0000-4000-8000-000000000001", lead = "00000000-0000-4000-8000-000000000002";
  try {
    await app.evaluate(({ ipcMain }, { id, lead }) => {
      let arrive!: () => void, release!: () => void;
      const arrival = new Promise<void>(resolve => { arrive = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
      const gate = { epoch: "old", calls: 0, arrived: { promise: arrival, resolve: () => arrive() }, release: { promise: held, resolve: () => release() } };
      Object.assign(globalThis, { hierarchyGate: gate });
      const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: { url: string }) => Promise<unknown>> })._invokeHandlers.get("cortex:fetch")!;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, request: { url: string; method: string; body?: string }) => {
        const path = new URL(request.url).pathname;
        const bot = { id, lead_id: null, name: "Specialist", description: "", label: "Review", look: "meadow", shape: "dots", notifications: true, status: "idle", computer_kind: "cloud", updated_at: "now" };
        let body: unknown;
        if (path === "/api/connection") body = { mode: "cloud", signedIn: true };
        else if (path === "/api/work-bot") body = { epoch: gate.epoch, bots: [bot, { ...bot, id: lead, name: gate.epoch === "old" ? "Old lead" : "New lead" }] };
        else if (path === `/api/work-bot/${id}/snapshot`) body = { epoch: gate.epoch, bot, jobs: [], messages: [], computerAvailable: false };
        else if (path === `/api/work-bot/${id}` && request.method === "PATCH") { gate.calls++; gate.arrived.resolve(); await gate.release.promise; body = { epoch: "old", bot: { ...bot, lead_id: lead } }; }
        else if (path.endsWith("/copy/status")) body = { active: false, invites: [] };
        else return original(event, request);
        return { status: 200, headers: [["Content-Type", "application/json"]], body: JSON.stringify(body) };
      });
    }, { id, lead });
    await page.evaluate(id => { location.hash = `#/bot-settings?id=${id}&epoch=old`; }, id);
    await page.getByTestId("work-bot-lead").locator(`[role=radio][data-value="${lead}"]`).click();
    const entered = app.evaluate(() => (globalThis as unknown as { hierarchyGate: { arrived: { promise: Promise<void> } } }).hierarchyGate.arrived.promise);
    await page.getByTestId("work-bot-lead-save").click(); await entered;
    await app.evaluate(() => { (globalThis as unknown as { hierarchyGate: { epoch: string } }).hierarchyGate.epoch = "new"; });
    await page.evaluate(id => { location.hash = `#/bot-settings?id=${id}&epoch=new`; }, id);
    await expect(page.getByTestId("work-bot-lead").getByRole("radio").last()).toHaveText("New lead");
    await page.getByTestId("work-bot-lead").locator('[role=radio][data-value=""]').click();
    await app.evaluate(() => { (globalThis as unknown as { hierarchyGate: { release: { resolve(): void } } }).hierarchyGate.release.resolve(); });
    await expect(page.getByTestId("work-bot-lead").locator('[role=radio][data-value=""]')).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("work-bot-current-lead")).toHaveText("No lead");
    expect(await app.evaluate(() => (globalThis as unknown as { hierarchyGate: { calls: number } }).hierarchyGate.calls)).toBe(1);
  } finally {
    await app.evaluate(() => { (globalThis as unknown as { hierarchyGate?: { release: { resolve(): void } } }).hierarchyGate?.release.resolve(); }).catch(() => {});
    await app.close(); fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
