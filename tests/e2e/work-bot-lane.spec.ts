import { test, expect, type ElectronApplication } from "@playwright/test";
import { launch } from "./fixtures";

const bot = "00000000-0000-4000-8000-000000000001", msg = "00000000-0000-4000-8000-000000000002", job = "00000000-0000-4000-8000-000000000003";
type State = { bots: number; jobStatus: string; replied: boolean; requests: string[]; release?: () => void };

async function install(app: ElectronApplication, bots: number) {
  await app.evaluate(({ ipcMain }, { bot, msg, job, bots }) => {
    type Wire = { url: string; method: string; body?: string };
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<unknown>> })._invokeHandlers.get("cortex:fetch")!;
    const state = { bots, jobStatus: "done", replied: false, requests: [] as string[] } as State;
    Object.assign(globalThis, { lane: state });
    const ok = (body: unknown) => ({ status: 200, headers: [["content-type", "application/json"]], body: JSON.stringify(body) });
    const view = { id: bot, name: "Nova", description: "", label: "", look: "plum", shape: "dots", lead_id: null, notifications: true, status: "idle", computer_kind: "none", updated_at: "now" };
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname; state.requests.push(`${request.method} ${path}`);
      const now = new Date().toISOString();
      if (path === "/api/connection") return ok({ mode: "cloud", signedIn: true });
      if (path === "/api/work-bot" && request.method === "GET") return ok({ epoch: "owner", bots: state.bots ? [view] : [] });
      if (path === `/api/work-bot/${bot}/snapshot`) return ok({ epoch: "owner", bot: view, computerAvailable: true,
        messages: [{ id: msg, sender: "user", kind: "text", text: "Hi", at: now, dismissed: false, responded: true }, ...(state.replied ? [{ id: job, sender: "mascot", kind: "text", text: "Hello there", at: now, dismissed: false, responded: false }] : [])],
        jobs: state.jobStatus === "none" ? [] : [{ id: job, kind: "general-purpose", goal: "Sort my inbox", status: state.jobStatus, created_at: now }] });
      if (path === `/api/work-bot/${bot}/messages`) { state.jobStatus = "running"; await new Promise<void>(r => { state.release = r; }); state.jobStatus = "done"; state.replied = true; return ok({ message: { id: msg, sender: "user", kind: "text", text: "Hi", at: now, dismissed: false, responded: false }, replies: [] }); }
      if (path === "/api/work-bot/pending" || path === `/api/work-bot/${bot}/pending`) return ok({ items: [] });
      if (path === `/api/work-bot/${bot}/policy-evaluations`) return ok({ items: [] });
      if (path === "/api/work-inbox") return ok({ items: [], working_mascot_ids: [], notifications: { items: [], has_more: false } });
      if (path === "/api/work-inbox/subscribe") return ok({ subscription: "00000000-0000-4000-8000-000000000099" });
      if (path === `/api/work-bot/${bot}/routines`) return ok([]);
      if (path.endsWith("/copy/status")) return ok({ active: false, invites: [] });
      return original(event, request);
    });
  }, { bot, msg, job, bots });
}

for (const theme of ["dark", "light"]) test(`Bot thread shows bubbles and a typing indicator, never an execution card — ${theme}`, async () => {
  const { app, page } = await launch({ hash: `#/work-task?theme=${theme}` });
  try {
    await install(app, 1);
    await page.reload(); // the connection gate reads /api/connection once at mount
    await page.evaluate(id => { location.hash = `#/work-task?id=${id}&epoch=owner`; }, bot);
    const thread = page.getByTestId("bot-thread");
    await expect(thread.getByTestId("bot-thread-message").first()).toBeVisible();
    await expect(page.locator(".travail-panel, [data-testid=work-bot-job]")).toHaveCount(0);
    await expect(page.getByText(/Execution|Exécution|Plan ·/)).toHaveCount(0);
    await expect(page.getByTestId("bot-typing")).toHaveCount(0);
    const one = thread.locator(".bot-bubble").first();
    const box = await one.boundingBox();
    expect(box!.height).toBeLessThan(44);
    await page.getByTestId("work-bot-parent-input").fill("Hi again");
    await page.getByTestId("work-bot-parent-send").click();
    await expect(page.getByTestId("bot-typing")).toBeVisible();
    await expect(thread.locator("[data-sender=user][data-pending]")).toHaveText("Hi again");
    await expect(page.getByText(/is typing…|écrit…/)).toHaveCount(0);
    // The dots show before the POST arrives; release only once the fixture holds the request.
    await expect.poll(() => app.evaluate(() => typeof (globalThis as unknown as { lane: State }).lane.release === "function")).toBe(true);
    await app.evaluate(() => (globalThis as unknown as { lane: State }).lane.release?.());
    await expect(page.getByTestId("bot-typing")).toHaveCount(0);
    await expect(thread.locator("[data-sender=bot]")).toContainText("Hello there");
  } finally { await app.evaluate(() => (globalThis as unknown as { lane?: State }).lane?.release?.()).catch(() => {}); await app.close(); }
});

test("signed-in Work home shows the composer and suggestions, Bot create has no native selects", async () => {
  const { app, page } = await launch({ hash: "#/home" });
  try {
    await install(app, 1);
    await page.reload(); // the connection gate reads /api/connection once at mount
    await app.evaluate(() => { (globalThis as unknown as { lane: State }).lane.jobStatus = "none"; });
    await page.evaluate(() => { location.hash = "#/work-home?epoch=owner"; });
    await expect(page.getByTestId("work-home-composer-input")).toBeVisible();
    await expect(page.getByTestId("work-home-suggestion")).toHaveCount(3);
    await expect(page.getByText("Copy invitations")).toHaveCount(0);
    await page.evaluate(() => { location.hash = "#/bot-new?epoch=owner"; });
    await expect(page.getByTestId("remote-bot-create")).toBeVisible();
    await expect(page.locator("select, details")).toHaveCount(0);
    await expect(page.getByText(/Earned autonomy|Ask accounting/)).toHaveCount(0);
  } finally { await app.close(); }
});

test("without a Bot, Reconnect and Channels are hidden and routines offer creation", async () => {
  const { app, page } = await launch({ hash: "#/home" });
  try {
    await install(app, 0);
    await page.reload(); // the connection gate reads /api/connection once at mount
    await page.evaluate(() => { location.hash = "#/bot-roster?epoch=owner"; });
    await expect(page.getByTestId("work-bot-owner-count")).toBeVisible();
    await expect(page.getByTestId("work-bot-reconnect")).toHaveCount(0);
    await expect(page.getByTestId("work-bot-channels")).toHaveCount(0);
    await page.evaluate(() => { location.hash = "#/automations?epoch=owner"; });
    await expect(page.getByTestId("routine-create-bot")).toBeVisible();
    await expect(page.getByText(/metadata only|UTC offset|cron/i)).toHaveCount(0);
  } finally { await app.close(); }
});

test("notifications open as a bell popover with tabs", async () => {
  const { app, page } = await launch({ hash: "#/home" });
  try {
    await install(app, 1);
    await page.reload(); // the connection gate reads /api/connection once at mount
    await page.evaluate(() => { location.hash = "#/work-home?epoch=owner"; });
    await page.getByTestId("notification-bell").click();
    const pop = page.getByTestId("notification-popover");
    await expect(pop).toBeVisible();
    await expect(pop.getByRole("tab")).toHaveCount(3);
    await expect(pop.getByTestId("notification-empty")).toBeVisible();
    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.getByText(/process-local|loaded window/)).toHaveCount(0);
  } finally { await app.close(); }
});
