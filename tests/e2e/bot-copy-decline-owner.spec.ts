import { test, expect, type ElectronApplication } from "@playwright/test";
import fs from "node:fs";
import { launch } from "./fixtures";
const id = "00000000-0000-4000-8000-000000000001";
type Gate = { epoch: string; calls: number; fail: boolean; entered: Promise<void>; held: Promise<void>; arrived(): void; release(): void };
async function install(app: ElectronApplication, fail = false) {
  await app.evaluate(({ ipcMain }, { id, fail }) => {
    type Wire = { url: string; method: string; body?: string };
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<unknown>> })._invokeHandlers.get("cortex:fetch")!;
    let arrived!: () => void, release!: () => void;
    const gate: Gate = { epoch: "old", calls: 0, fail, entered: new Promise<void>(r => { arrived = r; }), held: new Promise<void>(r => { release = r; }), arrived: () => arrived(), release: () => release() };
    (globalThis as unknown as { declineGate: Gate }).declineGate = gate;
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname;
      let body: unknown;
      if (path === "/api/connection") body = { mode: "cloud", signedIn: true };
      else if (path === "/api/work-bot") body = { epoch: gate.epoch, bots: [] };
      else if (path === "/api/bot-copy/invites") body = [{ id, kind: "template", name: gate.epoch === "old" ? "Old invite" : "New invite", look: "meadow", description: "", created_at: "2026-10-05T00:00:00Z" }];
      else if (path.endsWith("/preview")) body = { kind: "template", name: gate.epoch === "old" ? "Old invite" : "New invite", look: "meadow", shape: "dots", description: "", label: "", plugins: [], skills: [], routines: [], copies_independent: true, reconnect_required: true };
      else if (path.endsWith("/decline")) {
        gate.calls++; gate.arrived(); await gate.held;
        if (gate.fail) return { status: 503, headers: [["Content-Type", "application/json"]], body: JSON.stringify({ error: { code: "provider_error", message: "fixture refusal" } }) };
        body = { id, state: "declined", declined_at: "2026-10-05T00:00:00+00:00" };
      } else return original(event, request);
      return { status: 200, headers: [["Content-Type", "application/json"]], body: JSON.stringify(body) };
    });
  }, { id, fail });
}

test("decline refuses duplicate dispatch; late old-owner decision cannot clear a new preview", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await install(app); await page.evaluate(() => { location.hash = "#/bot-roster?epoch=old"; });
    await page.getByTestId("bot-copy-preview").click(); await expect(page.getByTestId("bot-copy-preview-data")).toContainText("Old invite");
    const entered = app.evaluate(() => (globalThis as unknown as { declineGate: Gate }).declineGate.entered);
    await page.getByTestId("bot-copy-decline").click(); await entered;
    await expect(page.getByTestId("bot-copy-decline")).toBeDisabled(); await expect(page.getByTestId("bot-copy-accept")).toBeDisabled();
    await app.evaluate(() => { (globalThis as unknown as { declineGate: Gate }).declineGate.epoch = "new"; });
    await page.evaluate(() => { location.hash = "#/bot-roster?epoch=new"; });
    await page.getByTestId("bot-copy-preview").click(); await expect(page.getByTestId("bot-copy-preview-data")).toContainText("New invite");
    await app.evaluate(() => { (globalThis as unknown as { declineGate: Gate }).declineGate.release(); });
    await page.getByTestId("bot-copy").getByRole("button", { name: "Reconnect", exact: true }).click();
    await expect(page.getByTestId("bot-copy-preview-data")).toContainText("New invite"); await expect(page.getByTestId("bot-copy-declined")).toHaveCount(0);
    await expect(page.getByTestId("bot-copy-decline")).toBeEnabled();
    expect(await app.evaluate(() => (globalThis as unknown as { declineGate: Gate }).declineGate.calls)).toBe(1);
  } finally { await app.evaluate(() => { (globalThis as unknown as { declineGate: Gate }).declineGate?.release(); }).catch(() => {}); await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("refused decline retains the invitation preview without a terminal success", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await install(app, true); await page.evaluate(() => { location.hash = "#/bot-roster?epoch=old"; }); await page.getByTestId("bot-copy-preview").click();
    const entered = app.evaluate(() => (globalThis as unknown as { declineGate: Gate }).declineGate.entered);
    await page.getByTestId("bot-copy-decline").click(); await entered; await app.evaluate(() => { (globalThis as unknown as { declineGate: Gate }).declineGate.release(); });
    await expect(page.getByTestId("bot-copy").getByRole("alert")).toBeVisible(); await expect(page.getByTestId("bot-copy-preview-data")).toContainText("Old invite");
    await expect(page.getByTestId("bot-copy-declined")).toHaveCount(0); await expect(page.getByTestId("bot-copy-decline")).toBeEnabled();
    expect(await app.evaluate(() => (globalThis as unknown as { declineGate: Gate }).declineGate.calls)).toBe(1);
  } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});
