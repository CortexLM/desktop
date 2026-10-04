import { test, expect, type Page } from "@playwright/test";
import type { Bot, Session } from "@cortex/schema";
import { launch } from "./fixtures";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`;
const model = { providerID: "fake", modelID: "reasoner" };
test.setTimeout(30_000);

async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ url, method, body }) => {
    const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
    const response = await bridge(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
    return response.json();
  }, { url, method, body });
}

async function openSearch(page: Page) {
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("combobox", { name: "Command", exact: true }).fill("No command with this exact phrase");
  await page.getByRole("button", { name: "Search everywhere", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Search everywhere", exact: true })).toBeVisible();
}

for (const theme of ["light", "dark"]) test(`Search finds persisted Bots by name and persona, preserving grouped keyboard identity — ${theme}`, async () => {
  const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(960);
    await openSearch(page);
    const input = page.getByRole("combobox", { name: "Search everywhere", exact: true });
    const results = page.getByRole("listbox", { name: "Results", exact: true });
    const options = results.getByRole("option");
    const filters = page.getByRole("group", { name: "Filter by type", exact: true });
    await expect(results).toContainText("Nothing to search yet. Your chats will show up here.");
    await expect(results.locator(".systeme-hit")).toHaveCount(0);

    // The intended Bot is not the newest/default Bot; navigation must carry its real ID.
    const target = await call<Bot>(page, "/api/bots", "POST", { name: "Éclaire", persona: "Prepares café release plans.", model });
    const other = await call<Bot>(page, "/api/bots", "POST", { name: "Café archive", persona: "Keeps winter receipts.", model });
    const chat = await call<Session>(page, "/api/sessions", "POST", { title: "CAFE planning chat", model });
    await openSearch(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(results.locator(".systeme-hit .systeme-t")).toHaveText([chat.title]);
    await input.fill("cAFE");
    await expect(results.getByRole("group", { name: "Bots", exact: true }).getByRole("option")).toHaveCount(2, { timeout: 2500 });
    await expect(results.getByRole("group", { name: "Chats", exact: true }).getByRole("option")).toHaveCount(1);
    const titles = await options.locator(".systeme-t").allTextContents();
    expect(titles[0]).toBe(chat.title);
    expect(titles.slice(1).sort()).toEqual([target.name, other.name].sort());
    await expect(options.filter({ hasText: target.name }).locator(".systeme-s mark")).toHaveText("café");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    for (let i = 0; i < titles.indexOf(target.name); i++) await input.press("ArrowDown");
    await expect(options.filter({ hasText: target.name })).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute("aria-activedescendant", (await options.filter({ hasText: target.name }).getAttribute("id"))!);
    const shot = test.info().outputPath(`search-bots-${theme}.png`);
    await page.screenshot({ path: shot, animations: "disabled" });
    await test.info().attach(`search-bots-${theme}`, { path: shot, contentType: "image/png" });
    await input.press("Enter");
    await expect.poll(() => page.evaluate(() => ({ route: location.hash.split("?")[0], id: new URLSearchParams(location.hash.split("?")[1]).get("id") }))).toEqual({ route: "#/bot", id: target.id });
    await expect(page.locator(".bot-hero .page-title")).toHaveText(target.name);

    await openSearch(page);
    await input.fill("CAFÉ");
    await filters.getByRole("button", { name: "Bots", exact: true }).click();
    await expect(options).toHaveCount(2);
    await expect(results.getByRole("group", { name: "Chats", exact: true })).toHaveCount(0);
    await input.fill("eCLAIRE");
    await expect(options.locator(".systeme-t")).toHaveText([target.name]);
    await expect(options.locator(".systeme-t mark")).toHaveText(target.name);
    await page.reload();
    await filters.getByRole("button", { name: "Bots", exact: true }).click();
    await input.fill("ECLAIRE");
    await expect(options.locator(".systeme-t")).toHaveText([target.name]);

    await call(page, `/api/bots/${target.id}`, "DELETE");
    await page.reload();
    await filters.getByRole("button", { name: "Bots", exact: true }).click();
    await input.fill("eclaire");
    await expect(options).toHaveCount(0);
    await expect(results.getByRole("heading", { name: /No results/ })).toBeVisible();
    await input.fill("CAFÉ");
    await expect(options.locator(".systeme-t")).toHaveText([other.name]);
    expect((await call<Bot[]>(page, "/api/bots")).map((b) => b.id)).toEqual([other.id]);
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});

test("Search reports either source's real request refusal and retries both lists", async () => {
  const { app, page } = await launch({ hash: "#/home", env: { CORTEX_CATALOG_URL: CATALOG_URL } });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Search recovery bot", persona: "Reviews reliable results.", model });
    await page.evaluate(() => {
      const w = window as unknown as { searchRefuse: string };
      w.searchRefuse = "";
      const RequestOriginal = Request;
      // GET reaches a nonexistent real record: no engine/response stub, no writes bypassed.
      window.Request = class extends RequestOriginal {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          const request = new RequestOriginal(input, init);
          const url = new URL(request.url);
          const refuse = request.method === "GET" && url.pathname === w.searchRefuse;
          url.pathname += "/search-missing-record";
          super(refuse ? url.href : request);
        }
      };
    });
    for (const source of ["/api/bots", "/api/sessions"]) {
      await page.evaluate((path) => { (window as unknown as { searchRefuse: string }).searchRefuse = path; }, source);
      await openSearch(page);
      const input = page.getByRole("combobox", { name: "Search everywhere", exact: true });
      const results = page.getByRole("listbox", { name: "Results", exact: true });
      await input.fill("reliable");
      await expect(results.getByRole("heading", { name: "Couldn’t load this", exact: true })).toBeVisible();
      await expect(results.getByRole("option")).toHaveCount(0);
      await expect(input).not.toHaveAttribute("aria-activedescendant");
      await expect(results).not.toContainText("search-missing-record");
      await page.evaluate(() => { (window as unknown as { searchRefuse: string }).searchRefuse = ""; });
      await results.getByRole("button", { name: "Try again", exact: true }).click();
      await expect(results.getByRole("option").locator(".systeme-t")).toHaveText([bot.name]);
    }
  } finally { await app.close(); }
});
