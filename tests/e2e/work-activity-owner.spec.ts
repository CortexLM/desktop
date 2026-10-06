import { test, expect, type ElectronApplication } from "@playwright/test";
import { launch } from "./fixtures";
const bot = "00000000-0000-4000-8000-000000000001", message = "00000000-0000-4000-8000-000000000002";
async function install(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }, { bot, message }) => {
    type Wire = { url: string; method: string; body?: string };
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (event: unknown, request: Wire) => Promise<unknown>> })._invokeHandlers.get("cortex:fetch")!;
    const state = { requests: [] as string[] };
    Object.assign(globalThis, { activityFixture: state });
    const ok = (body: unknown) => ({ status: 200, headers: [["content-type", "application/json"]], body: JSON.stringify(body) });
    ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname; state.requests.push(`${request.method} ${path}`);
      if (path === "/api/connection") return ok({ mode: "cloud", signedIn: true });
      if (path === "/api/work-bot") return ok({ epoch: "owner", bots: [{ id: bot, name: "Visible Bot", description: "", label: "", look: "meadow", shape: "dots", lead_id: null, notifications: true, status: "idle", computer_kind: "none", updated_at: "now" }] });
      if (path === `/api/work-bot/${bot}/activity`) return ok([
        { opaque: true, id: "00000000-0000-4000-8000-000000000011", kind: "future_kind", resource: "mascot", resource_id: bot, at: "2026-10-06T10:02:00.000Z" },
        { opaque: false, id: "00000000-0000-4000-8000-000000000012", kind: "ask_user", resource: "mascot", resource_id: bot, at: "2026-10-06T10:01:00.000Z", message_id: message, widget: "confirm" },
      ]);
      if (path === `/api/work-bot/${bot}/activity/subscribe`) return ok({ subscription: "00000000-0000-4000-8000-000000000099" });
      return original(event, request);
    });
  }, { bot, message });
}
test("signed-in activity renders projected and opaque rows without any action", async () => {
  const { app, page } = await launch();
  try {
    await install(app); await page.evaluate(() => { location.hash = "#/activity?epoch=owner"; });
    const rows = page.getByTestId("work-activity-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute("data-opaque", "true"); await expect(rows.nth(0)).toContainText("Other activity (details not shown)"); await expect(rows.nth(0)).toContainText("future_kind");
    await expect(rows.nth(1)).toContainText("Asked for your input: confirmation");
    await expect(page.getByTestId("remote-work-activity").locator("button, a, [role=button]")).toHaveCount(0);
    await rows.nth(0).click(); await rows.nth(1).click();
    const requests = await app.evaluate(() => (globalThis as unknown as { activityFixture: { requests: string[] } }).activityFixture.requests);
    expect(requests.some(r => /respond|messages|decide|tasks/.test(r))).toBe(false);
    await expect(page).toHaveURL(/#\/activity/);
  } finally { await app.close(); }
});
