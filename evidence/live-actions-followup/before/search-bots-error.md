# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search-bots.spec.ts >> Search finds persisted Bots by name and persona, preserving grouped keyboard identity — light
- Location: tests/e2e/search-bots.spec.ts:26:40

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('listbox', { name: 'Results', exact: true }).getByRole('group', { name: 'Bots', exact: true }).getByRole('option')
Expected: 2
Received: 0
Timeout:  2500ms

Call log:
  - Expect "toHaveCount" getByRole('listbox', { name: 'Results', exact: true }).getByRole('group', { name: 'Bots', exact: true }).getByRole('option') with timeout 2500ms
  - waiting for getByRole('listbox', { name: 'Results', exact: true }).getByRole('group', { name: 'Bots', exact: true }).getByRole('option')
    9 × locator resolved to 0 elements
      - unexpected value "0"

```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import type { Bot, Session } from "@cortex/schema";
  3   | import { launch } from "./fixtures";
  4   | import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
  5   |
  6   | const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`;
  7   | const model = { providerID: "fake", modelID: "reasoner" };
  8   | test.setTimeout(30_000);
  9   |
  10  | async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  11  |   return page.evaluate(async ({ url, method, body }) => {
  12  |     const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
  13  |     const response = await bridge(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  14  |     if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
  15  |     return response.json();
  16  |   }, { url, method, body });
  17  | }
  18  |
  19  | async function openSearch(page: Page) {
  20  |   await page.getByRole("button", { name: "Search", exact: true }).click();
  21  |   await page.getByRole("combobox", { name: "Command", exact: true }).fill("No command with this exact phrase");
  22  |   await page.getByRole("button", { name: "Search everywhere", exact: true }).click();
  23  |   await expect(page.getByRole("combobox", { name: "Search everywhere", exact: true })).toBeVisible();
  24  | }
  25  |
  26  | for (const theme of ["light", "dark"]) test(`Search finds persisted Bots by name and persona, preserving grouped keyboard identity — ${theme}`, async () => {
  27  |   const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL } });
  28  |   const errors: string[] = [];
  29  |   page.on("pageerror", (error) => errors.push(error.message));
  30  |   try {
  31  |     await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
  32  |     await page.emulateMedia({ reducedMotion: "reduce" });
  33  |     await expect.poll(() => page.evaluate(() => innerWidth)).toBe(960);
  34  |     await openSearch(page);
  35  |     const input = page.getByRole("combobox", { name: "Search everywhere", exact: true });
  36  |     const results = page.getByRole("listbox", { name: "Results", exact: true });
  37  |     const options = results.getByRole("option");
  38  |     const filters = page.getByRole("group", { name: "Filter by type", exact: true });
  39  |     await expect(results).toContainText("Nothing to search yet. Your chats will show up here.");
  40  |     await expect(results.locator(".systeme-hit")).toHaveCount(0);
  41  |
  42  |     // The intended Bot is not the newest/default Bot; navigation must carry its real ID.
  43  |     const target = await call<Bot>(page, "/api/bots", "POST", { name: "Éclaire", persona: "Prepares café release plans.", model });
  44  |     const other = await call<Bot>(page, "/api/bots", "POST", { name: "Café archive", persona: "Keeps winter receipts.", model });
  45  |     const chat = await call<Session>(page, "/api/sessions", "POST", { title: "CAFE planning chat", model });
  46  |     await openSearch(page);
  47  |     await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  48  |     await expect(results.locator(".systeme-hit .systeme-t")).toHaveText([chat.title]);
  49  |     await input.fill("cAFE");
> 50  |     await expect(results.getByRole("group", { name: "Bots", exact: true }).getByRole("option")).toHaveCount(2, { timeout: 2500 });
      |                                                                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  51  |     await expect(results.getByRole("group", { name: "Chats", exact: true }).getByRole("option")).toHaveCount(1);
  52  |     const titles = await options.locator(".systeme-t").allTextContents();
  53  |     expect(titles[0]).toBe(chat.title);
  54  |     expect(titles.slice(1).sort()).toEqual([target.name, other.name].sort());
  55  |     await expect(options.filter({ hasText: target.name }).locator(".systeme-s mark")).toHaveText("café");
  56  |     await expect(options.first()).toHaveAttribute("aria-selected", "true");
  57  |     for (let i = 0; i < titles.indexOf(target.name); i++) await input.press("ArrowDown");
  58  |     await expect(options.filter({ hasText: target.name })).toHaveAttribute("aria-selected", "true");
  59  |     await expect(input).toHaveAttribute("aria-activedescendant", (await options.filter({ hasText: target.name }).getAttribute("id"))!);
  60  |     const shot = test.info().outputPath(`search-bots-${theme}.png`);
  61  |     await page.screenshot({ path: shot, animations: "disabled" });
  62  |     await test.info().attach(`search-bots-${theme}`, { path: shot, contentType: "image/png" });
  63  |     await input.press("Enter");
  64  |     await expect.poll(() => page.evaluate(() => ({ route: location.hash.split("?")[0], id: new URLSearchParams(location.hash.split("?")[1]).get("id") }))).toEqual({ route: "#/bot", id: target.id });
  65  |     await expect(page.locator(".bot-hero .page-title")).toHaveText(target.name);
  66  |
  67  |     await openSearch(page);
  68  |     await input.fill("CAFÉ");
  69  |     await filters.getByRole("button", { name: "Bots", exact: true }).click();
  70  |     await expect(options).toHaveCount(2);
  71  |     await expect(results.getByRole("group", { name: "Chats", exact: true })).toHaveCount(0);
  72  |     await input.fill("eCLAIRE");
  73  |     await expect(options.locator(".systeme-t")).toHaveText([target.name]);
  74  |     await expect(options.locator(".systeme-t mark")).toHaveText(target.name);
  75  |     await page.reload();
  76  |     await filters.getByRole("button", { name: "Bots", exact: true }).click();
  77  |     await input.fill("ECLAIRE");
  78  |     await expect(options.locator(".systeme-t")).toHaveText([target.name]);
  79  |
  80  |     await call(page, `/api/bots/${target.id}`, "DELETE");
  81  |     await page.reload();
  82  |     await filters.getByRole("button", { name: "Bots", exact: true }).click();
  83  |     await input.fill("eclaire");
  84  |     await expect(options).toHaveCount(0);
  85  |     await expect(results.getByRole("heading", { name: /No results/ })).toBeVisible();
  86  |     await input.fill("CAFÉ");
  87  |     await expect(options.locator(".systeme-t")).toHaveText([other.name]);
  88  |     expect((await call<Bot[]>(page, "/api/bots")).map((b) => b.id)).toEqual([other.id]);
  89  |     expect(errors).toEqual([]);
  90  |   } finally { await app.close(); }
  91  | });
  92  |
  93  | test("Search reports either source's real request refusal and retries both lists", async () => {
  94  |   const { app, page } = await launch({ hash: "#/home", env: { CORTEX_CATALOG_URL: CATALOG_URL } });
  95  |   try {
  96  |     await page.emulateMedia({ reducedMotion: "reduce" });
  97  |     const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Search recovery bot", persona: "Reviews reliable results.", model });
  98  |     await page.evaluate(() => {
  99  |       const w = window as unknown as { searchRefuse: string };
  100 |       w.searchRefuse = "";
  101 |       const RequestOriginal = Request;
  102 |       // GET reaches a nonexistent real record: no engine/response stub, no writes bypassed.
  103 |       window.Request = class extends RequestOriginal {
  104 |         constructor(input: RequestInfo | URL, init?: RequestInit) {
  105 |           const request = new RequestOriginal(input, init);
  106 |           const url = new URL(request.url);
  107 |           const refuse = request.method === "GET" && url.pathname === w.searchRefuse;
  108 |           url.pathname += "/search-missing-record";
  109 |           super(refuse ? url.href : request);
  110 |         }
  111 |       };
  112 |     });
  113 |     for (const source of ["/api/bots", "/api/sessions"]) {
  114 |       await page.evaluate((path) => { (window as unknown as { searchRefuse: string }).searchRefuse = path; }, source);
  115 |       await openSearch(page);
  116 |       const input = page.getByRole("combobox", { name: "Search everywhere", exact: true });
  117 |       const results = page.getByRole("listbox", { name: "Results", exact: true });
  118 |       await input.fill("reliable");
  119 |       await expect(results.getByRole("heading", { name: "Couldn’t load this", exact: true })).toBeVisible();
  120 |       await expect(results.getByRole("option")).toHaveCount(0);
  121 |       await expect(input).not.toHaveAttribute("aria-activedescendant");
  122 |       await expect(results).not.toContainText("search-missing-record");
  123 |       await page.evaluate(() => { (window as unknown as { searchRefuse: string }).searchRefuse = ""; });
  124 |       await results.getByRole("button", { name: "Try again", exact: true }).click();
  125 |       await expect(results.getByRole("option").locator(".systeme-t")).toHaveText([bot.name]);
  126 |     }
  127 |   } finally { await app.close(); }
  128 | });
  129 |
```
