import { test, expect, type Page } from "@playwright/test";
import type { Bot, MessageWithParts, Permission, ScheduledTask, Session } from "@cortex/schema";
import { launch } from "./fixtures";
import { fakeOpenAI, toolCall } from "../../packages/core/test/helpers";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`;
const model = { providerID: "fake", modelID: "reasoner" };

async function request(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(async ({ path, method, body }) => {
    const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
    const r = await bridge(`cortex://local${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  }, { path, method, body });
}

async function call<T>(page: Page, path: string, method = "GET", body?: unknown): Promise<T> {
  const result = await request(page, path, method, body);
  expect(result.status).toBeGreaterThanOrEqual(200);
  expect(result.status).toBeLessThan(300);
  return result.body;
}

async function routine(page: Page, directory: string) {
  const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Routine bot", model });
  return call<ScheduledTask>(page, "/api/tasks", "POST", { title: "Controlled routine", prompt: "Run the routine", botID: bot.id, model, directory, enabled: false, schedule: { type: "daily", time: "09:00" } });
}

async function capture(page: Page, name: string) {
  const row = page.locator(".travail-rt");
  await expect(page.locator(".travail-botgroup")).toContainText("Routine bot");
  await expect(row.locator(".ttl")).toHaveText("Controlled routine");
  // History can render before the row's reduced-motion entrance reaches its painted state.
  await expect(row).toHaveCSS("opacity", "1");
  for (const control of [row.locator(".travail-grow"), row.getByRole("switch"), row.getByRole("button", { name: "Options for Controlled routine", exact: true })]) {
    await expect(control).toBeInViewport({ ratio: 1 });
    await control.click({ trial: true });
  }
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const theme of ["light", "dark"]) {
  test(`Routine history reflects running, interruption and latest results — ${theme}`, async () => {
    const fake = await fakeOpenAI([
      { deltas: [toolCall("wait", "bash", { command: "echo test" })], finish: "tool_calls" },
      ...Array.from({ length: 8 }, () => ({ deltas: [{ content: "Routine complete." }], finish: "stop" as const })),
    ]);
    const { app, page, dataDir } = await launch({ hash: `#/automations?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      const task = await routine(page, dataDir);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const options = page.getByRole("button", { name: `Options for ${task.title}`, exact: true });
      const run = page.getByRole("menuitem", { name: "Run now", exact: true });
      const history = page.locator(".travail-hist tbody tr");
      const dots = page.locator(".travail-runs i");
      await options.click();
      await run.click();
      await expect(page.getByText("Run started", { exact: true })).toBeVisible();
      await expect.poll(async () => (await call<Permission[]>(page, "/api/permissions")).length).toBe(1);
      const permission = (await call<Permission[]>(page, "/api/permissions"))[0];
      expect((await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs[0]).toMatchObject({ status: "running", sessionID: permission.sessionID });
      await expect.soft(history.first().locator(".badge")).toHaveText("Running", { timeout: 2000 });
      await expect.soft(history.first().locator(".badge")).toHaveClass("badge run", { timeout: 2000 });
      await expect.soft(dots.last()).toHaveAttribute("data-s", "run", { timeout: 2000 });
      await capture(page, `routine-running-${theme}`);

      await options.click();
      await expect.soft(run).toBeDisabled({ timeout: 2000 });
      await page.keyboard.press("Escape");
      const duplicate = await request(page, `/api/tasks/${task.id}/run`, "POST");
      expect.soft(duplicate.status).toBe(409);
      expect.soft(duplicate.body).toMatchObject({ error: { code: "conflict" } });
      expect.soft((await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs).toHaveLength(1);
      expect.soft(await call<Session[]>(page, "/api/sessions")).toHaveLength(1);
      expect.soft(fake.requests).toHaveLength(1);

      await call(page, `/api/sessions/${permission.sessionID}/abort`, "POST");
      await expect.poll(async () => (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs.find((r) => r.sessionID === permission.sessionID)?.status).not.toBe("running");
      const interrupted = (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs.find((r) => r.sessionID === permission.sessionID);
      expect.soft(interrupted).toMatchObject({ status: "error", error: { code: "aborted" } });
      expect((await call<MessageWithParts[]>(page, `/api/sessions/${permission.sessionID}/messages`)).at(-1)?.info.error?.code).toBe("aborted");
      expect(await call<Permission[]>(page, "/api/permissions")).toEqual([]);
      await expect.soft(history.locator(".badge.err")).toHaveText("Failed", { timeout: 2000 });
      await expect.soft(dots.last()).toHaveAttribute("data-s", "err", { timeout: 2000 });
      await page.reload();
      await expect.soft(history.locator(".badge.err")).toHaveText("Failed", { timeout: 2000 });
      await capture(page, `routine-interrupted-${theme}`);

      // Nine real runs distinguish the latest eight from the oldest eight.
      for (let i = 0; i < 8; i++) {
        await call(page, `/api/tasks/${task.id}/run`, "POST");
        await expect.poll(async () => (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs[0].status).toBe("success");
        if (i === 0) await expect.poll(() => dots.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-s")))).toEqual(["err", "ok"]);
      }
      await expect(history.first().locator(".badge")).toHaveText("Succeeded");
      await expect(dots).toHaveCount(8);
      await expect.poll(() => dots.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-s")))).toEqual(Array(8).fill("ok"));
      expect((await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs).toHaveLength(9);
      expect(errors).toEqual([]);
    } finally { await app.close(); await fake.close(); }
  });

  test(`Routine actions retain honest feedback when the engine refuses — ${theme}`, async () => {
    const { app, page, dataDir } = await launch({ hash: `#/automations?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: "" } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      const task = await routine(page, dataDir);
      await page.reload();
      const options = page.getByRole("button", { name: `Options for ${task.title}`, exact: true });
      const run = page.getByRole("menuitem", { name: "Run now", exact: true });
      await expect(options).toBeVisible();
      await call(page, `/api/tasks/${task.id}`, "DELETE");
      await page.evaluate((id) => {
        const text = Request.prototype.text;
        let release!: () => void;
        const held = new Promise<void>((resolve) => { release = resolve; });
        window.addEventListener("release-routine-run", () => { Request.prototype.text = text; release(); }, { once: true });
        // Delay serialization only: the deleted task is refused by the real engine.
        Request.prototype.text = async function () {
          if (this.method === "POST" && new URL(this.url).pathname === `/api/tasks/${id}/run`) {
            document.documentElement.dataset.routineWrites = String(Number(document.documentElement.dataset.routineWrites ?? 0) + 1);
            await held;
          }
          return text.call(this);
        };
      }, task.id);
      await options.click();
      await run.evaluate((item: HTMLElement) => { item.click(); item.click(); });
      await expect.soft(page.locator("html")).toHaveAttribute("data-routine-writes", "1", { timeout: 2000 });
      await expect.soft(page.getByText("Run started", { exact: true })).toHaveCount(0, { timeout: 1000 });
      await options.click();
      await expect.soft(run).toBeDisabled({ timeout: 2000 });
      await page.keyboard.press("Escape");
      await page.evaluate(() => window.dispatchEvent(new Event("release-routine-run")));
      await expect(page.getByText("Couldn’t start the routine.", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Run started", { exact: true })).toHaveCount(0);
      await expect(page.locator(".travail-hist")).toHaveCount(0);
      expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
      await capture(page, `routine-start-refused-${theme}`);

      await options.click();
      await expect(run).toBeEnabled();
      await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
      await expect.soft(page.getByText("Couldn’t save. Try again.", { exact: true })).toBeVisible({ timeout: 2000 });
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);
      expect(errors).toEqual([]);
    } finally { await app.close(); }
  });
}
