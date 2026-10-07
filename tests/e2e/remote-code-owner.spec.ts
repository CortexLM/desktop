import { test, expect, type ElectronApplication } from "@playwright/test";
import fs from "node:fs";
import { launch } from "./fixtures";

const id = "cnv_00000000000000000000000001";
type Wire = { url: string; method: string; body?: string };
type Gate = { calls: { path: string; body: unknown }[]; arrival: Promise<void>; arrived(): void; held: Promise<void>; release(): void; epoch: string; defer: string; restore(): void };
async function install(app: ElectronApplication, defer: string) {
  await app.evaluate(({ ipcMain }, { id, defer }) => {
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<unknown>> })._invokeHandlers;
    const original = handlers.get("cortex:fetch")!;
    let arrived!: () => void, release!: () => void;
    const gate: Gate = { calls: [], epoch: "old", defer, arrival: new Promise<void>(resolve => { arrived = resolve; }), arrived: () => arrived(), held: new Promise<void>(resolve => { release = resolve; }), release: () => release(), restore() { ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", original); } };
    (globalThis as unknown as { codeGate: Gate }).codeGate = gate;
    const session = () => ({ id, epoch: gate.epoch, runtime: "local", modelSlug: "fixture", title: "Owner test", state: "waiting", delivery: "ready" });
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname;
      let body: unknown;
      if (path === "/api/connection") body = { mode: "cloud", signedIn: true };
      else if (path === "/api/code/models") body = { epoch: gate.epoch, models: [{ slug: "fixture", name: "Fixture", tools: true }] };
      else if (path === "/api/code/sessions") body = request.method === "POST" ? session() : [];
      else if (path.startsWith("/api/code/")) {
        gate.calls.push({ path, body: request.body ? JSON.parse(request.body) : undefined });
        const epoch = gate.epoch;
        if (path.endsWith(gate.defer)) { gate.arrived(); await gate.held; }
        body = path.endsWith("/snapshot") ? { session: { ...session(), epoch }, messages: [{ id: "message", role: "assistant", text: epoch === "old" ? "OLD_ACCOUNT_CONTENT" : "NEW_ACCOUNT_CONTENT", tools: [] }], permissions: epoch === "old" ? [{ id: "prm_00000000000000000000000001", tool_name: "bash", detail: "OLD_COMMAND" }] : [] } : session();
      } else return original(event, request);
      return { status: 200, headers: [["Content-Type", "application/json"]], body: JSON.stringify(body) };
    });
  }, { id, defer });
}
const arrival = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { codeGate: Gate }).codeGate.arrival);
const release = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { codeGate: Gate }).codeGate.release());

test("Code Home preserves the next draft edited before prompt admission", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await install(app, "/prompt");
    await page.evaluate(() => { location.hash = "#/code"; });
    await expect(page.getByTestId("code-mode-local")).toBeVisible();
    await page.getByLabel("Model", { exact: true }).selectOption("fixture");
    await page.getByTestId("code-composer-input").fill("submitted");
    const entered = arrival(app);
    await page.getByTestId("code-api-send").click(); await entered;
    await page.getByTestId("code-composer-input").fill("next edited draft");
    await release(app);
    await expect(page.getByTestId("code-reconnect")).toBeVisible();
    await expect(page.getByTestId("code-composer-input")).toHaveValue("next edited draft");
  } finally { await release(app).catch(() => {}); await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("Code replacement epoch clears consent and ignores late old snapshot", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await install(app, "/unused");
    await page.evaluate(id => { location.hash = `#/code-session?source=code-api&id=${id}&epoch=old`; }, id);
    await expect(page.locator(".msg-bot")).toHaveText("OLD_ACCOUNT_CONTENT");
    await expect(page.getByTestId("permission-allow-once")).toBeVisible();
    await app.evaluate(() => { const gate = (globalThis as unknown as { codeGate: Gate }).codeGate; gate.defer = "/snapshot"; });
    const pending = arrival(app);
    await page.getByTestId("code-reconnect").click(); await pending;
    await app.evaluate(() => { (globalThis as unknown as { codeGate: Gate }).codeGate.epoch = "new"; });
    await page.evaluate(id => { location.hash = `#/code-session?source=code-api&id=${id}&epoch=new`; }, id);
    await expect(page.getByTestId("permission-allow-once")).toHaveCount(0);
    await expect(page.locator(".msg-bot")).toHaveCount(0);
    await release(app);
    await expect(page.locator(".msg-bot")).toHaveText("NEW_ACCOUNT_CONTENT");
    await expect(page.getByTestId("permission-allow-once")).toHaveCount(0);
    const calls = await app.evaluate(() => (globalThis as unknown as { codeGate: Gate }).codeGate.calls);
    expect(calls.filter(call => call.path.includes("permissions"))).toEqual([]);
  } finally { await release(app).catch(() => {}); await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});
