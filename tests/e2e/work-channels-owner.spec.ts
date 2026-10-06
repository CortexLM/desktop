import { test, expect, type ElectronApplication } from "@playwright/test";
import { launch } from "./fixtures";
const channelID = "00000000-0000-4000-8000-000000000010", visible = "00000000-0000-4000-8000-000000000001", unlisted = "00000000-0000-4000-8000-000000000002";
async function install(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }, { channelID, visible, unlisted }) => {
    type Wire = { url: string; method: string; body?: string };
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (event: unknown, request: Wire) => Promise<unknown>> })._invokeHandlers.get("cortex:fetch")!;
    let enter!: () => void, release!: () => void;
    const state = { epoch: "old", fail: false, hold: false, writes: [] as object[], entered: new Promise<void>(resolve => { enter = resolve; }), held: new Promise<void>(resolve => { release = resolve; }), release: () => release() };
    Object.assign(globalThis, { channelFixture: state });
    const ok = (body: object, status = 200) => ({ status, headers: [["content-type", "application/json"]], body: JSON.stringify(body) });
    const stored = { id: channelID, name: "Stored group", members: [visible, unlisted] };
    ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname;
      if (path === "/api/connection") return ok({ mode: "cloud", signedIn: true });
      if (path === "/api/work-bot") return ok({ epoch: state.epoch, bots: [{ id: visible, name: "Visible Bot", instructions: "", template_id: null, notifications: true, created_at: "now", updated_at: "now" }] });
      if (path === "/api/work-channels") return ok(state.epoch === "old" ? [stored] : []);
      if (path.endsWith("/get")) return ok(stored);
      if (path === `/api/work-channels/${channelID}` && request.method === "PATCH") {
        const body = JSON.parse(request.body!); state.writes.push(body);
        if (state.hold) { enter(); await state.held; return ok({ ...stored, name: body.channel.name }); }
        if (state.fail) return ok({ code: "conflict", message: "Refused" }, 409);
        Object.assign(stored, { name: body.channel.name, ...(body.channel.members ? { members: body.channel.members } : {}) }); return ok(stored);
      }
      return original(event, request);
    });
  }, { channelID, visible, unlisted });
}
test("rename retains unlisted members; explicit replacement includes full selection; failure keeps draft", async () => {
  const { app, page } = await launch();
  try {
    await install(app); await page.evaluate(() => { location.hash = "#/bot-channels?epoch=old"; }); await page.getByTestId("work-channel-row").click();
    await expect(page.getByTestId("work-channel-member")).toHaveCount(2); await expect(page.locator(`[data-bot-id="${unlisted}"]`)).toBeChecked();
    await page.getByTestId("work-channel-name").fill("Rename only"); await page.getByTestId("work-channel-save").click(); await expect(page.getByTestId("work-channel-save")).toBeEnabled();
    expect(await app.evaluate(() => (globalThis as unknown as { channelFixture: { writes: object[] } }).channelFixture.writes)).toEqual([{ epoch: "old", channel: { name: "Rename only" } }]);
    await page.locator(`[data-bot-id="${visible}"]`).uncheck(); await app.evaluate(() => { (globalThis as unknown as { channelFixture: { fail: boolean } }).channelFixture.fail = true; });
    await page.getByTestId("work-channel-name").fill("Retained draft"); await page.getByTestId("work-channel-save").click(); await expect(page.getByTestId("work-channel-error")).toBeVisible();
    await expect(page.getByTestId("work-channel-name")).toHaveValue("Retained draft"); await expect(page.locator(`[data-bot-id="${unlisted}"]`)).toBeChecked();
    expect(await app.evaluate(() => (globalThis as unknown as { channelFixture: { writes: object[] } }).channelFixture.writes.at(-1))).toEqual({ epoch: "old", channel: { name: "Retained draft", members: [unlisted] } });
  } finally { await app.close(); }
});
test("held old channel reply cannot replace new owner draft", async () => {
  const { app, page } = await launch();
  try {
    await install(app); await page.evaluate(() => { location.hash = "#/bot-channels?epoch=old"; }); await page.getByTestId("work-channel-row").click();
    await app.evaluate(() => { (globalThis as unknown as { channelFixture: { hold: boolean } }).channelFixture.hold = true; });
    await page.getByTestId("work-channel-name").fill("Old edit"); await page.getByTestId("work-channel-save").click(); await app.evaluate(() => (globalThis as unknown as { channelFixture: { entered: Promise<void> } }).channelFixture.entered);
    await app.evaluate(() => { (globalThis as unknown as { channelFixture: { epoch: string } }).channelFixture.epoch = "new"; }); await page.evaluate(() => { location.hash = "#/bot-channels?epoch=new"; });
    await page.getByTestId("work-channels-new").click(); await page.getByTestId("work-channel-name").fill("Replacement draft");
    await app.evaluate(() => { (globalThis as unknown as { channelFixture: { release(): void } }).channelFixture.release(); });
    await expect(page.getByTestId("work-channel-name")).toHaveValue("Replacement draft"); await expect(page.getByTestId("work-channel-selected")).toContainText("0");
  } finally { await app.evaluate(() => { (globalThis as unknown as { channelFixture?: { release(): void } }).channelFixture?.release(); }); await app.close(); }
});
test("channel name input stops at the 80-character save cap with a visible counter", async () => {
  const { app, page } = await launch();
  try {
    await install(app); await page.evaluate(() => { location.hash = "#/bot-channels?epoch=old"; }); await page.getByTestId("work-channels-new").click();
    const input = page.getByTestId("work-channel-name");
    await expect(input).toHaveAttribute("maxlength", "80");
    await input.fill("x".repeat(79)); await expect(page.getByTestId("work-channel-name-count")).toHaveText("79/80 characters");
    await input.pressSequentially("yz"); await expect(input).toHaveValue("x".repeat(79) + "y");
    await expect(page.getByTestId("work-channel-name-count")).toHaveText("80/80 characters"); await expect(input).toHaveAttribute("aria-invalid", "false");
    await expect(page.getByTestId("work-channel-save")).toBeEnabled();
  } finally { await app.close(); }
});
