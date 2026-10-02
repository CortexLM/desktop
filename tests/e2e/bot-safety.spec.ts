import { test, expect, type Page } from "@playwright/test";
import type { Bot } from "@cortex/schema";
import { launch } from "./fixtures";

const env = { CORTEX_CATALOG_URL: "data:application/json,{}", CORTEX_TEST_PROVIDER_BASEURL: "" };
const model = { providerID: "test", modelID: "test" };

async function call<T>(page: Page, path: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ path, method, body }) => {
    const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
    const r = await bridge(`cortex://local${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
    return r.status === 204 ? null : r.json();
  }, { path, method, body });
}

async function show(page: Page, route: string, theme: string, preview = true) {
  await page.evaluate(({ route, theme, preview }) => history.pushState(null, "", `#/${route}${route.includes("?") ? "&" : "?"}theme=${theme}${preview ? "&preview" : ""}`), { route, theme, preview });
  await expect(page).toHaveURL(new RegExp(`#/${route.split("?")[0]}\\?`));
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const width of [960, 1440]) for (const theme of ["light", "dark"]) {
  test(`Bot Studio retains refused saves; accepted saves leave once — ${width} ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/bot?theme=${theme}`, locale: "en", env });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, width === 960 ? 640 : 900), width);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload();
      const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Original bot", model });
      await show(page, `bot-studio?id=${bot.id}`, theme, false);
      const input = page.locator("#bname");
      await expect(input).toHaveValue("Original bot");
      await input.fill("Keep this draft");
      await page.getByRole("button", { name: "Back to the Bot", exact: true }).click();
      const dialog = page.getByRole("alertdialog", { name: "Save your changes?" });
      const save = dialog.getByRole("button", { name: "Save", exact: true });
      await expect(save).toBeInViewport({ ratio: 1 });
      await call(page, `/api/bots/${bot.id}`, "DELETE");

      await page.evaluate(() => {
        const text = Request.prototype.text;
        // Hold request serialization, not the engine or its response. DELETE above makes PATCH really refuse.
        Request.prototype.text = async function () {
          if (this.method === "PATCH" && /^\/api\/bots\/[^/]+$/.test(new URL(this.url).pathname)) {
            document.documentElement.dataset.botWrites = String(Number(document.documentElement.dataset.botWrites ?? 0) + 1);
            await new Promise<void>((resolve) => window.addEventListener("release-bot-save", () => resolve(), { once: true }));
          }
          return text.call(this);
        };
      });
      await save.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(page.locator("html")).toHaveAttribute("data-bot-writes", "1");
      await expect(dialog).toHaveAttribute("aria-busy", "true");
      for (const button of await dialog.getByRole("button").all()) await expect(button).toBeDisabled();
      await expect(input).toBeDisabled();
      await expect(input).toHaveValue("Keep this draft");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event("release-bot-save")));
      await expect(page.getByText("Couldn’t save. Try again.", { exact: true })).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(save).toBeEnabled();
      await expect(input).toHaveValue("Keep this draft");
      await expect(page).toHaveURL(new RegExp(`#/bot-studio\\?.*id=${bot.id}`));
      await expect(page.getByText("Look saved", { exact: true })).toHaveCount(0);
      expect(await call<Bot[]>(page, "/api/bots")).toEqual([]);
      await capture(page, `bot-save-refused-${width}-${theme}`);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(input).toBeEditable();
      await expect(input).toHaveValue("Keep this draft");

      const next = await call<Bot>(page, "/api/bots", "POST", { name: "Another bot", model });
      await show(page, "home", theme, false);
      await expect(page.locator(".home")).toBeVisible();
      await show(page, `bot-studio?id=${next.id}`, theme, false);
      await expect(input).toHaveValue("Another bot");
      await input.fill("Accepted bot");
      await page.getByRole("button", { name: "Back to the Bot", exact: true }).click();
      await save.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(page.locator("html")).toHaveAttribute("data-bot-writes", "2");
      await expect(save).toBeDisabled();
      await expect(dialog).toBeVisible();
      expect((await call<Bot>(page, `/api/bots/${next.id}`)).name).toBe("Another bot");
      await page.evaluate(() => window.dispatchEvent(new Event("release-bot-save")));
      await expect(page).toHaveURL(new RegExp(`#/bot\\?.*id=${next.id}`));
      await expect(page.locator(".content-top .title")).toHaveText("Accepted bot");
      expect((await call<Bot>(page, `/api/bots/${next.id}`)).name).toBe("Accepted bot");
      await expect(page.locator("html")).toHaveAttribute("data-bot-writes", "2");
      expect(errors).toEqual([]);
    } finally { await app.close(); }
  });

  test(`Preview Bot shares saved look, draft, pause and activity — ${width} ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/bot-studio?theme=${theme}&preview`, locale: "en", env });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, width === 960 ? 640 : 900), width);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload();
      const input = page.locator("#bname");
      await expect(input).toHaveValue("Nova");
      await input.fill("Preview bot");
      await page.locator(".editor").getByRole("button", { name: "Drop", exact: true }).click();
      await page.locator(".editor").getByRole("button", { name: "Orange", exact: true }).click();
      const shape = await page.locator(".stage-canvas .m-shape").getAttribute("d");
      await show(page, "home", theme);
      await expect(page.locator(".home")).toBeVisible();
      await show(page, "bot-studio", theme);
      await expect(input).toHaveValue("Preview bot");
      await expect(page.locator(".stage-canvas .m-shape")).toHaveAttribute("d", shape!);
      await expect(page.locator(".stage-canvas .m-shape")).toHaveAttribute("fill", "#FF6A13");
      await page.getByRole("button", { name: "Back to the Bot", exact: true }).click();
      const dialog = page.getByRole("alertdialog", { name: "Save your changes?" });
      await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeInViewport({ ratio: 1 });
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator(".content-top .title")).toHaveText("Preview bot");
      await expect(page.locator(".hero-mascot .m-shape")).toHaveAttribute("d", shape!);
      const sidebarBot = page.locator(".sidebar .row").filter({ hasText: "Preview bot" });
      await expect(sidebarBot.locator(".mascot")).toHaveAttribute("data-state", "working");
      await page.locator(".bot-pill").click();
      await expect(page.locator(".hero-mascot .mascot")).toHaveAttribute("data-state", "asleep");
      await expect(sidebarBot.locator(".mascot")).toHaveAttribute("data-state", "asleep");
      await show(page, "chat", theme);
      const chatBot = page.locator(".thread .msg-bot-row .mascot").first();
      await expect(chatBot).toHaveAttribute("aria-label", /Preview bot/);
      await expect(chatBot).toHaveAttribute("data-state", "asleep");
      await expect(chatBot.locator(".m-shape")).toHaveAttribute("fill", "#FF6A13");
      await capture(page, `preview-bot-shared-${width}-${theme}`);
      await show(page, "work-home?v=empty", theme);
      await expect(page.getByRole("heading", { name: "Hand your first task to Preview bot" })).toBeVisible();
      await expect(page.locator(".travail-empty > .mascot .m-shape")).toHaveAttribute("d", shape!);
      await show(page, "work-task?v=done", theme);
      await expect(page.locator(".content-top .badge")).toHaveText("Done");
      await expect(sidebarBot.locator(".mascot")).toHaveAttribute("data-state", "asleep");
      await expect(sidebarBot.locator(".meta")).toHaveText("Paused");
      await show(page, "home", theme);
      await expect(sidebarBot.locator(".mascot")).toHaveAttribute("data-state", "asleep");
      await show(page, "bot", theme);
      await expect(page.locator(".bot-pill")).toHaveText("Paused");
      await page.locator(".bot-pill").click();
      await page.locator(".dock .composer input").fill("Read this request");
      await page.locator(".dock .composer input").press("Enter");
      await expect(sidebarBot.locator(".mascot")).toHaveAttribute("data-state", "listening");
      await show(page, "home", theme);
      await expect(sidebarBot.locator(".meta")).toHaveText("Read this request");
      await expect(sidebarBot.locator(".mascot")).toHaveAttribute("data-state", "working");

      await show(page, "bot-studio", theme);
      await input.fill("Discard this draft");
      await show(page, "work-task?v=done", theme);
      await expect(sidebarBot.locator(".meta")).toHaveText("followed up on 5 quotes");
      await expect(sidebarBot.locator(".mascot")).toHaveAttribute("data-state", "done");
      await expect(sidebarBot.locator(".m-shape")).toHaveAttribute("d", shape!);
      await expect(sidebarBot.locator(".m-shape")).toHaveAttribute("fill", "#FF6A13");
      await show(page, "home", theme);
      await expect(sidebarBot.locator(".meta")).toHaveText("Read this request");
      await expect(sidebarBot.locator(".mascot")).toHaveAttribute("data-state", "working");
      await show(page, "bot-studio", theme);
      await expect(input).toHaveValue("Discard this draft");
      await page.getByRole("button", { name: "Back to the Bot", exact: true }).click();
      await dialog.getByRole("button", { name: "Leave without saving", exact: true }).click();
      await expect(page.locator(".content-top .title")).toHaveText("Preview bot");
      await show(page, "bot-studio", theme);
      await expect(input).toHaveValue("Preview bot");

      await show(page, "bot-new", theme);
      await expect(page.getByTestId("bot-name-input")).toHaveValue("Preview bot");
      await page.getByTestId("bot-name-input").fill("Onboarded bot");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.locator(".onb-pick").getByRole("button", { name: "Drop", exact: true })).toHaveAttribute("aria-pressed", "true");
      for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByTestId("bot-create-submit").press("Enter");
      await expect(page.locator(".content-top .title")).toHaveText("Onboarded bot");
      await expect(page.locator(".hero-mascot .m-shape")).toHaveAttribute("fill", "#FF6A13");
      expect(await call<Bot[]>(page, "/api/bots")).toEqual([]);
      expect(await call(page, "/api/sessions")).toEqual([]);
      expect(errors).toEqual([]);
    } finally { await app.close(); }
  });
}

test("Bot onboarding does not navigate after leaving preview", async () => {
  const { app, page } = await launch({ hash: "#/bot-new?theme=light&preview", locale: "en", env });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByTestId("bot-name-input")).toHaveValue("Nova");
    for (let step = 0; step < 4; step++) await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.clock.install();
    await page.getByTestId("bot-create-submit").press("Enter");
    await expect(page.locator(".slide")).toHaveAttribute("data-done", "true");
    await show(page, "home", "light", false);
    await expect(page.locator(".home .composer")).toBeVisible();
    await page.clock.fastForward(2000);
    await expect(page).toHaveURL(/#\/home\?theme=light$/);
    expect(await call<Bot[]>(page, "/api/bots")).toEqual([]);
  } finally { await app.close(); }
});

test("Preview Bot locale reset and live-mode boundary", async () => {
  const { app, page } = await launch({ hash: "#/bot-studio?theme=light&preview", locale: "en", env });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.locator("#bname").fill("Preview only");
    await page.getByTestId("bot-studio-save").click();
    await expect(page.getByText("Look saved", { exact: true })).toBeVisible();
    await show(page, "work-task?v=done", "light");
    await expect(page.locator(".sidebar .row").filter({ hasText: "Preview only" }).locator(".meta")).toHaveText("followed up on 5 quotes");
    await show(page, "settings?v=appearance", "light");
    await page.locator(".pg-panel").getByRole("button", { name: "English", exact: true }).click();
    await page.getByRole("menuitem", { name: "Français", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await show(page, "bot", "light");
    await expect(page.locator(".content-top .title")).toHaveText("Nova");
    await expect(page.locator(".sidebar .row").filter({ hasText: "Nova" }).locator(".meta")).toHaveText("trie tes e-mails");
    await page.locator(".bot-pill").click();
    await show(page, "bot-studio", "light");
    await page.locator("#bname").fill("Discard on exit");
    await page.locator(".nav-btns button").first().click();
    await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
    await show(page, "bot", "light", false);
    await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
    await expect(page.locator(".content")).not.toContainText("Nova");
    expect(await call<Bot[]>(page, "/api/bots")).toEqual([]);
    const live = await call<Bot>(page, "/api/bots", "POST", { name: "Live bot", model });
    await show(page, "home", "light", false);
    await expect(page.locator(".home")).toBeVisible();
    await show(page, `bot?id=${live.id}`, "light", false);
    await expect(page.locator(".content-top .title")).toHaveText("Live bot");
    await show(page, "bot", "light");
    await expect(page.locator(".content-top .title")).toHaveText("Nova");
    await expect(page.locator(".bot-pill")).toHaveAttribute("data-on", "true");
    await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
    await show(page, "bot-studio", "light");
    await expect(page.locator("#bname")).toHaveValue("Nova");
    await show(page, "work-task?v=done", "light");
    await expect(page.locator(".content-top .badge")).toHaveText("Terminé");
    const saved = await call<Bot[]>(page, "/api/bots");
    await show(page, "home", "light", false);
    await expect(page.locator(".home")).toBeVisible();
    await show(page, "bot", "light");
    await expect(page.locator(".hero-mascot .mascot")).toHaveAttribute("data-state", "working");
    expect(await call<Bot[]>(page, "/api/bots")).toEqual(saved);
    expect(await call(page, "/api/sessions")).toEqual([]);
    expect((await call<Bot[]>(page, "/api/bots")).map((bot) => bot.name)).toEqual(["Live bot"]);
  } finally { await app.close(); }
});
