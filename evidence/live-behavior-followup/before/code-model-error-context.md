# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: code-models.spec.ts >> Code sends the chosen model, restores session selection and refuses unavailable models — light
- Location: tests/e2e/code-models.spec.ts:37:3

# Error details

```
TimeoutError: locator.click: Timeout 2500ms exceeded.
Call log:
  - waiting for getByRole('menuitemradio').filter({ hasText: 'Reasoner Large' })

```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import type { MessageWithParts, ModelRef, PromptInput, Session } from "@cortex/schema";
  3   | import fs from "node:fs";
  4   | import path from "node:path";
  5   | import { launch } from "./fixtures";
  6   | import { startFakeProvider } from "./fake-provider";
  7   | import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
  8   |
  9   | const A = { providerID: "plain", modelID: "text-only" };
  10  | const B = { providerID: "fake", modelID: "reasoner" };
  11  | const models = {
  12  |   fake: { ...catalog.fake, models: { reasoner: catalog.fake.models.reasoner } },
  13  |   plain: { ...catalog.fake, id: "plain", name: "Plain Compatible", models: {
  14  |     "text-only": { ...catalog.fake.models["text-only"], limit: { context: 100000, output: 1000 } },
  15  |   } },
  16  |   mistralish: catalog.mistralish,
  17  | };
  18  | const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify(models))}`;
  19  | test.setTimeout(30_000);
  20  |
  21  | async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  22  |   return page.evaluate(async ({ url, method, body }) => {
  23  |     const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
  24  |     const response = await bridge(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  25  |     if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
  26  |     return response.json();
  27  |   }, { url, method, body });
  28  | }
  29  |
  30  | async function select(page: Page, name: string) {
  31  |   await page.locator(".composer .model").click();
> 32  |   await page.getByRole("menuitemradio").filter({ hasText: name }).click({ timeout: 2500 });
      |                                                                   ^ TimeoutError: locator.click: Timeout 2500ms exceeded.
  33  |   await expect(page.locator(".composer .model")).toHaveAttribute("aria-expanded", "false");
  34  | }
  35  |
  36  | for (const theme of ["light", "dark"]) {
  37  |   test(`Code sends the chosen model, restores session selection and refuses unavailable models — ${theme}`, async () => {
  38  |     const fake = await startFakeProvider();
  39  |     const { app, page, dataDir } = await launch({ hash: `#/code?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PICK_DIRECTORY: "", CORTEX_TEST_PROVIDER_BASEURL: "" } });
  40  |     const errors: string[] = [];
  41  |     page.on("pageerror", (error) => errors.push(error.message));
  42  |     try {
  43  |       const directory = path.join(dataDir, "project");
  44  |       fs.mkdirSync(directory);
  45  |       await app.evaluate(({ app, BrowserWindow, dialog }) => {
  46  |         BrowserWindow.getAllWindows()[0].setSize(960, 640);
  47  |         dialog.showOpenDialog = (() => new Promise((resolve) => {
  48  |           (app as NodeJS.EventEmitter).once("code-model-directory", (folder: string | null) => resolve({ canceled: !folder, filePaths: folder ? [folder] : [] }));
  49  |         })) as typeof dialog.showOpenDialog;
  50  |       });
  51  |       await page.emulateMedia({ reducedMotion: "reduce" });
  52  |       await expect.poll(() => page.evaluate(() => innerWidth)).toBe(960);
  53  |       // Both configured providers are genuinely keyless; a copied Chat key-only picker must fail.
  54  |       for (const provider of [A.providerID, B.providerID]) await call(page, `/api/providers/${provider}`, "PATCH", { enabled: true, baseURL: fake.url });
  55  |       await call(page, "/api/sessions", "POST", { title: "Unrelated latest chat", model: A });
  56  |       await page.evaluate(() => localStorage.setItem("cortex.model", "plain/text-only"));
  57  |       await page.addInitScript(() => {
  58  |         const w = window as unknown as { codePrompts: unknown[] };
  59  |         w.codePrompts = [];
  60  |         const text = Request.prototype.text;
  61  |         // Observe the real IPC payload without replacing its response or bypassing the engine.
  62  |         Request.prototype.text = async function () {
  63  |           const body = await text.call(this);
  64  |           if (this.method === "POST" && /\/api\/sessions\/[^/]+\/prompt$/.test(new URL(this.url).pathname)) w.codePrompts.push(JSON.parse(body));
  65  |           return body;
  66  |         };
  67  |       });
  68  |       await page.reload();
  69  |       await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  70  |       await select(page, "Reasoner Large");
  71  |       await page.locator(".composer .model").click();
  72  |       await page.getByTestId("thinking-toggle").getByRole("switch").setChecked(false);
  73  |       await page.keyboard.press("Escape");
  74  |       const input = page.getByTestId("code-composer-input"), form = page.locator("form.composer");
  75  |       const draft = "  Use the chosen model in this folder  ";
  76  |       await input.fill(draft);
  77  |       await input.press("Enter");
  78  |       await expect(input).toBeDisabled();
  79  |       await expect(form).toHaveAttribute("aria-busy", "true");
  80  |       await form.evaluate((el: HTMLFormElement) => { el.requestSubmit(); el.requestSubmit(); });
  81  |       await expect.poll(() => app.evaluate(({ app }) => app.listenerCount("code-model-directory"))).toBe(1);
  82  |       await app.evaluate(({ app }) => app.emit("code-model-directory", null));
  83  |       await expect(input).toBeEnabled();
  84  |       await expect(input).toHaveValue(draft);
  85  |       expect(await call<Session[]>(page, "/api/sessions?kind=code")).toEqual([]);
  86  |       expect(fake.requests).toHaveLength(0);
  87  |
  88  |       await input.press("Enter");
  89  |       await expect.poll(() => app.evaluate(({ app }) => app.listenerCount("code-model-directory"))).toBe(1);
  90  |       await app.evaluate(({ app }, folder) => app.emit("code-model-directory", folder), directory);
  91  |       await expect(page).toHaveURL(/#\/code-session\?/);
  92  |       const id = new URLSearchParams(page.url().split("?")[1]).get("id")!;
  93  |       await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
  94  |       expect(fake.requests).toHaveLength(1);
  95  |       expect(fake.requests[0].body.model).toBe(B.modelID);
  96  |       expect(await call<Session>(page, `/api/sessions/${id}`)).toMatchObject({ kind: "code", model: B, directory, agent: "build" });
  97  |       expect(await page.evaluate(() => (window as unknown as { codePrompts: PromptInput[] }).codePrompts.at(-1))).toMatchObject({ model: B, reasoning: false });
  98  |       await expect(input).toHaveValue("");
  99  |
  100 |       await select(page, "Plain Text");
  101 |       await input.fill("Continue with the plain model");
  102 |       await input.press("Enter");
  103 |       await expect.poll(async () => {
  104 |         const messages = await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
  105 |         return messages.length === 4 && !!messages.at(-1)?.info.time.completed;
  106 |       }).toBe(true);
  107 |       expect(fake.requests).toHaveLength(2);
  108 |       expect(fake.requests[1].body.model).toBe(A.modelID);
  109 |       expect(fake.requests[1].body.tools).toBeUndefined();
  110 |       const messages = await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`);
  111 |       expect(messages.map((m) => m.info.model)).toEqual([B, B, A, A]);
  112 |       expect(await page.evaluate(() => (window as unknown as { codePrompts: PromptInput[] }).codePrompts.at(-1)?.reasoning)).toBeUndefined();
  113 |
  114 |       await call(page, "/api/sessions", "POST", { title: "Newer unrelated chat", model: B });
  115 |       await page.evaluate(() => localStorage.setItem("cortex.model", "fake/reasoner"));
  116 |       await page.reload();
  117 |       await expect(page.locator(".composer .model")).toHaveText("Plain Text");
  118 |       await call(page, `/api/providers/${A.providerID}`, "PATCH", { enabled: false });
  119 |       await input.fill(draft);
  120 |       await input.press("Enter");
  121 |       await expect(page.getByText("Message not sent", { exact: true })).toBeVisible();
  122 |       await expect(input).toHaveValue(draft);
  123 |       await expect(input).toBeEnabled();
  124 |       expect(await call<MessageWithParts[]>(page, `/api/sessions/${id}/messages`)).toEqual(messages);
  125 |       expect((await call<Session>(page, `/api/sessions/${id}`)).model).toEqual(A);
  126 |       expect(fake.requests).toHaveLength(2);
  127 |
  128 |       await page.reload();
  129 |       await expect(page.locator(".composer .model")).toHaveText("No model");
  130 |       await input.fill(draft);
  131 |       await input.press("Enter");
  132 |       await expect(page.getByText("Message not sent", { exact: true })).toBeVisible();
```
