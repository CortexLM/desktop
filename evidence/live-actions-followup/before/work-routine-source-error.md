# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: work-routine-source.spec.ts >> Work task conversion preserves source context and only creates on confirmation — light
- Location: tests/e2e/work-routine-source.spec.ts:47:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Task options', exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Task options', exact: true }) with timeout 15000ms
  - waiting for getByRole('button', { name: 'Task options', exact: true })

```

```yaml
- button "Hide sidebar"
- button "Back"
- button "Forward" [disabled]
- button "Share"
- button "Focus mode"
- navigation "Main navigation":
  - button "Home"
  - button "Library"
  - button "History"
  - button "Bot team"
  - button "Activity"
  - button "More"
  - radiogroup "Theme":
    - radio "System"
    - radio "Dark"
    - radio "Light" [checked]
  - button "Settings"
- complementary "Sidebar":
  - button "Cortex"
  - button "Notifications"
  - button "Search"
  - button "New chat"
  - button "Create your Bot"
  - text: Tools
  - button "Web search"
  - button "Documents"
  - button "Images"
  - button "Automations"
  - text: Recents
  - button "New chat"
  - text: Your chats will appear here.
  - button "Getting started 0 of 5":
    - img
    - text: Getting started 0 of 5
- main:
  - button "Back to the board"
  - text: Review the source project and prepare its weekly handoff without changing any files Done Review this project's open work. Prepare a concise weekly handoff.
  - img "Bot B, Idle"
  - text: Hello from the streaming test provider. Everything works.
  - button "Add"
  - textbox "Give Bot B an instruction"
  - button "Fast"
  - button "Dictate"
  - button "Voice mode"
- region "Notifications"
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import type { Bot, MessageWithParts, ScheduledTask, Session } from "@cortex/schema";
  3   | import fs from "node:fs";
  4   | import path from "node:path";
  5   | import { launch } from "./fixtures";
  6   | import { startFakeProvider } from "./fake-provider";
  7   | import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
  8   |
  9   | const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify({ fake: { ...catalog.fake, models: {
  10  |   ...catalog.fake.models, "text-only": { ...catalog.fake.models["text-only"], limit: { context: 100000, output: 1000 } },
  11  | } } }))}`;
  12  | const sourceModel = { providerID: "fake", modelID: "reasoner" };
  13  | const botModel = { providerID: "fake", modelID: "text-only" };
  14  | const title = "Review the source project and prepare its weekly handoff without changing any files";
  15  | const prompt = "Review this project's open work.\nPrepare a concise weekly handoff.";
  16  |
  17  | async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  18  |   return page.evaluate(async ({ url, method, body }) => {
  19  |     const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
  20  |     const response = await bridge(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  21  |     if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
  22  |     return response.json();
  23  |   }, { url, method, body });
  24  | }
  25  |
  26  | async function navigate(page: Page, hash: string) {
  27  |   await page.goto(`${page.url().split("#")[0]}${hash}`);
  28  | }
  29  |
  30  | async function capture(page: Page, name: string) {
  31  |   const file = test.info().outputPath(`${name}.png`);
  32  |   await page.screenshot({ path: file, animations: "disabled" });
  33  |   await test.info().attach(name, { path: file, contentType: "image/png" });
  34  | }
  35  |
  36  | async function openRoutine(page: Page, source: Session, theme: string) {
  37  |   await navigate(page, `#/work-task?id=${source.id}&theme=${theme}`);
  38  |   await expect(page.locator(".msg-user").first()).toHaveText(prompt);
> 39  |   await expect(page.getByRole("button", { name: "Task options", exact: true })).toBeVisible();
      |                                                                                 ^ Error: expect(locator).toBeVisible() failed
  40  |   await page.getByRole("button", { name: "Task options", exact: true }).click();
  41  |   await expect(page.getByRole("menuitem", { name: "Turn into a routine", exact: true })).toBeVisible();
  42  |   await page.getByRole("menuitem", { name: "Turn into a routine", exact: true }).click();
  43  |   await expect(page).toHaveURL(/#\/automation-edit\?/);
  44  | }
  45  |
  46  | for (const theme of ["light", "dark"]) {
  47  |   test(`Work task conversion preserves source context and only creates on confirmation — ${theme}`, async () => {
  48  |     const fake = await startFakeProvider();
  49  |     const { app, page, dataDir } = await launch({ hash: `#/work-home?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
  50  |     const errors: string[] = [];
  51  |     page.on("pageerror", (error) => errors.push(error.message));
  52  |     try {
  53  |       await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
  54  |       await page.emulateMedia({ reducedMotion: "reduce" });
  55  |       const directory = path.join(dataDir, "source-project");
  56  |       fs.mkdirSync(directory);
  57  |       const b = await call<Bot>(page, "/api/bots", "POST", { name: "Bot B", model: botModel });
  58  |       const a = await call<Bot>(page, "/api/bots", "POST", { name: "Bot A", model: botModel });
  59  |       expect((await call<Bot[]>(page, "/api/bots"))[0].id).toBe(a.id);
  60  |       const source = await call<Session>(page, "/api/sessions", "POST", { title, kind: "bot", botID: b.id, model: sourceModel, directory, agent: "plan" });
  61  |       await call(page, `/api/sessions/${source.id}/prompt`, "POST", { parts: [{ type: "text", text: prompt }] });
  62  |       await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${source.id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
  63  |       await navigate(page, `#/work-task?id=${source.id}&theme=${theme}`);
  64  |       await expect(page.locator(".msg-user")).toHaveText(prompt);
  65  |       await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  66  |       await capture(page, `work-task-source-${theme}`);
  67  |
  68  |       await openRoutine(page, source, theme);
  69  |       const name = page.getByRole("textbox", { name: "Name", exact: true });
  70  |       const instructions = page.getByRole("textbox", { name: "Instructions", exact: true });
  71  |       const assigned = page.getByRole("radiogroup", { name: "Assigned Bot", exact: true });
  72  |       await expect(name).toHaveValue(title.slice(0, 60));
  73  |       await expect(instructions).toHaveValue(prompt);
  74  |       await expect(assigned.getByRole("radio", { name: "Bot B", exact: true })).toHaveAttribute("aria-checked", "true");
  75  |       await expect(assigned.getByRole("radio", { name: "Bot A", exact: true })).toHaveAttribute("aria-checked", "false");
  76  |       expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);
  77  |       await capture(page, `routine-source-editor-${theme}`);
  78  |       await page.getByRole("button", { name: "Cancel", exact: true }).click();
  79  |       await expect(page).toHaveURL(/#\/automations(?:\?|$)/);
  80  |       expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);
  81  |       expect(fake.requests).toHaveLength(1);
  82  |
  83  |       await openRoutine(page, source, theme);
  84  |       await page.reload();
  85  |       await expect(name).toHaveValue(title.slice(0, 60));
  86  |       await expect(instructions).toHaveValue(prompt);
  87  |       await expect(assigned.getByRole("radio", { name: "Bot B", exact: true })).toHaveAttribute("aria-checked", "true");
  88  |       const create = page.getByRole("button", { name: "Create routine", exact: true });
  89  |       await expect(create).toBeEnabled();
  90  |       for (const control of [name, instructions, assigned.getByRole("radio", { name: "Bot B", exact: true }), create]) {
  91  |         await control.scrollIntoViewIfNeeded();
  92  |         await expect(control).toBeInViewport({ ratio: 1 });
  93  |         await control.click({ trial: true });
  94  |       }
  95  |       await create.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  96  |       await expect(page).toHaveURL(/#\/automations(?:\?|$)/);
  97  |       const tasks = await call<ScheduledTask[]>(page, "/api/tasks");
  98  |       expect(tasks).toHaveLength(1);
  99  |       const task = tasks[0];
  100 |       expect(task).toMatchObject({ title: title.slice(0, 60), prompt, model: sourceModel, agent: "plan", directory, botID: b.id, enabled: true, runs: [] });
  101 |       expect((await call<Session>(page, `/api/sessions/${source.id}`)).title).toBe(title);
  102 |       await page.reload();
  103 |       expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual(tasks);
  104 |       await expect(page.locator(".travail-botgroup")).toContainText("Bot B");
  105 |       await expect(page.locator(".travail-rt .ttl")).toHaveText(task.title);
  106 |       await page.getByRole("button", { name: `Options for ${task.title}`, exact: true }).click();
  107 |       await page.getByRole("menuitem", { name: "Run now", exact: true }).click();
  108 |       await expect.poll(async () => (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs[0]?.status).toBe("success");
  109 |       const run = (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs[0];
  110 |       expect(run.sessionID).toBeTruthy();
  111 |       expect(run.sessionID).not.toBe(source.id);
  112 |       expect(await call<Session>(page, `/api/sessions/${run.sessionID}`)).toMatchObject({ kind: "bot", botID: b.id, model: sourceModel, agent: "plan", directory });
  113 |       expect(fake.requests).toHaveLength(2);
  114 |       expect(fake.requests[1].body.model).toBe(sourceModel.modelID);
  115 |       const messages = fake.requests[1].body.messages as { role: string; content: unknown }[];
  116 |       expect(messages.filter((m) => m.role === "user")).toEqual([{ role: "user", content: prompt }]);
  117 |       await expect(page.locator(".travail-hist .badge")).toHaveText("Succeeded");
  118 |       await capture(page, `routine-source-run-${theme}`);
  119 |       await page.reload();
  120 |       expect((await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs).toEqual([run]);
  121 |       expect(errors).toEqual([]);
  122 |     } finally { await app.close(); await fake.close(); }
  123 |   });
  124 | }
  125 |
```
