import { test, expect, type Page } from "@playwright/test";
import type { Bot, MessageWithParts, ScheduledTask, Session } from "@cortex/schema";
import fs from "node:fs";
import path from "node:path";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify({ fake: { ...catalog.fake, models: {
  ...catalog.fake.models, "text-only": { ...catalog.fake.models["text-only"], limit: { context: 100000, output: 1000 } },
} } }))}`;
const sourceModel = { providerID: "fake", modelID: "reasoner" };
const botModel = { providerID: "fake", modelID: "text-only" };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const title = "Review the source project and prepare its weekly handoff without changing any files";
const prompt = "Review this project's open work.\nPrepare a concise weekly handoff.";

async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ url, method, body }) => {
    const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
    const response = await bridge(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
    return response.json();
  }, { url, method, body });
}

async function navigate(page: Page, hash: string) {
  await page.goto(`${page.url().split("#")[0]}${hash}`);
}

async function capture(page: Page, name: string) {
  const file = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path: file, animations: "disabled" });
  await test.info().attach(name, { path: file, contentType: "image/png" });
}

async function openRoutine(page: Page, source: Session, theme: string) {
  await navigate(page, `#/work-task?id=${source.id}&theme=${theme}`);
  await expect(page.locator(".msg-user").first()).toHaveText(prompt);
  await expect(page.getByRole("button", { name: "Task options", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Task options", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Turn into a routine", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Turn into a routine", exact: true }).click();
  await expect(page).toHaveURL(/#\/automation-edit\?/);
}

for (const theme of ["light", "dark"]) {
  test(`Work task conversion preserves source context and only creates on confirmation — ${theme}`, async () => {
    const fake = await startFakeProvider();
    const { app, page, dataDir } = await launch({ hash: `#/work-home?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      const directory = path.join(dataDir, "source-project");
      fs.mkdirSync(directory);
      const b = await call<Bot>(page, "/api/bots", "POST", { name: "Bot B", model: botModel });
      const a = await call<Bot>(page, "/api/bots", "POST", { name: "Bot A", model: botModel });
      expect((await call<Bot[]>(page, "/api/bots"))[0].id).toBe(a.id);
      const source = await call<Session>(page, "/api/sessions", "POST", { title, kind: "bot", botID: b.id, model: sourceModel, directory, agent: "plan" });
      const [lead, tail] = prompt.split("\n");
      await call(page, `/api/sessions/${source.id}/prompt`, "POST", { parts: [{ type: "text", text: `${lead}\n` }, { type: "text", text: tail }] });
      await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${source.id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
      await navigate(page, `#/work-task?id=${source.id}&theme=${theme}`);
      await expect(page.locator(".msg-user")).toHaveText(prompt);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await capture(page, `work-task-source-${theme}`);

      await openRoutine(page, source, theme);
      const name = page.getByRole("textbox", { name: "Name", exact: true });
      const instructions = page.getByRole("textbox", { name: "Instructions", exact: true });
      const assigned = page.getByRole("radiogroup", { name: "Assigned Bot", exact: true });
      await expect(name).toHaveValue(title.slice(0, 60));
      await expect(instructions).toHaveValue(prompt);
      await expect(assigned.getByRole("radio", { name: /Bot B/ })).toHaveAttribute("aria-checked", "true");
      await expect(assigned.getByRole("radio", { name: /Bot A/ })).toHaveAttribute("aria-checked", "false");
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);
      await capture(page, `routine-source-editor-${theme}`);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page).toHaveURL(/#\/automations(?:\?|$)/);
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);
      expect(fake.requests).toHaveLength(1);

      await openRoutine(page, source, theme);
      await page.reload();
      await expect(name).toHaveValue(title.slice(0, 60));
      await expect(instructions).toHaveValue(prompt);
      await expect(assigned.getByRole("radio", { name: /Bot B/ })).toHaveAttribute("aria-checked", "true");
      const create = page.getByRole("button", { name: "Create routine", exact: true });
      await expect(create).toBeEnabled();
      for (const control of [name, instructions, assigned.getByRole("radio", { name: /Bot B/ }), create]) {
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport({ ratio: 1 });
        await control.click({ trial: true });
      }
      await page.evaluate(() => {
        const text = Request.prototype.text;
        let release!: () => void;
        const held = new Promise<void>((resolve) => { release = resolve; });
        window.addEventListener("release-routine-create", () => { Request.prototype.text = text; release(); }, { once: true });
        // Delay serialization only: the real engine handles the one admitted Create.
        Request.prototype.text = async function () {
          if (this.method === "POST" && new URL(this.url).pathname === "/api/tasks") {
            document.documentElement.dataset.routineWrites = String(Number(document.documentElement.dataset.routineWrites ?? 0) + 1);
            await held;
          }
          return text.call(this);
        };
      });
      await create.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(page.locator("html")).toHaveAttribute("data-routine-writes", "1");
      for (const control of [create, name, instructions, assigned.getByRole("radio", { name: /Bot A/ }), page.getByRole("button", { name: "Cancel", exact: true }), page.getByRole("button", { name: "Back to routines", exact: true })]) await expect(control).toBeDisabled();
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);
      await page.evaluate(() => window.dispatchEvent(new Event("release-routine-create")));
      await expect(page).toHaveURL(/#\/automations(?:\?|$)/);
      const tasks = await call<ScheduledTask[]>(page, "/api/tasks");
      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task).toMatchObject({ title: title.slice(0, 60), prompt, model: sourceModel, agent: "plan", directory, botID: b.id, enabled: true, runs: [] });
      expect((await call<Session>(page, `/api/sessions/${source.id}`)).title).toBe(title);
      await page.reload();
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual(tasks);
      await expect(page.locator(".travail-botgroup")).toContainText("Bot B");
      await expect(page.locator(".travail-rt .ttl")).toHaveText(task.title);
      await page.locator(".travail-rt .travail-grow").click();
      await expect(instructions).toHaveValue(prompt);
      await expect(assigned.getByRole("radio", { name: /Bot B/ })).toHaveAttribute("aria-checked", "true");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page).toHaveURL(/#\/automations(?:\?|$)/);
      expect(await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).toMatchObject({ prompt, model: sourceModel, agent: "plan", directory, botID: b.id });
      await page.getByRole("button", { name: `Options for ${task.title}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Run now", exact: true }).click();
      await expect.poll(async () => (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs[0]?.status).toBe("success");
      const run = (await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs[0];
      expect(run.sessionID).toBeTruthy();
      expect(run.sessionID).not.toBe(source.id);
      expect(await call<Session>(page, `/api/sessions/${run.sessionID}`)).toMatchObject({ kind: "bot", botID: b.id, model: sourceModel, agent: "plan", directory });
      expect(fake.requests).toHaveLength(2);
      expect(fake.requests[1].body.model).toBe(sourceModel.modelID);
      const messages = fake.requests[1].body.messages as { role: string; content: unknown }[];
      expect(messages.filter((m) => m.role === "user")).toEqual([{ role: "user", content: prompt }]);
      await expect(page.locator(".travail-hist .badge")).toHaveText("Succeeded");
      await capture(page, `routine-source-run-${theme}`);
      await page.reload();
      expect((await call<ScheduledTask>(page, `/api/tasks/${task.id}`)).runs).toEqual([run]);
      expect(errors).toEqual([]);
    } finally { await app.close(); await fake.close(); }
  });

  test(`Work routine source rejects missing tasks and attachments; reassignment uses the selected Bot — ${theme}`, async () => {
    const fake = await startFakeProvider();
    const { app, page, dataDir } = await launch({ hash: `#/automations?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      const b = await call<Bot>(page, "/api/bots", "POST", { name: "Bot B", model: botModel });
      const a = await call<Bot>(page, "/api/bots", "POST", { name: "Bot A", model: botModel, persona: "Use the reassigned Bot's instructions." });
      const source = await call<Session>(page, "/api/sessions", "POST", { title, kind: "bot", botID: b.id, model: sourceModel, directory: dataDir, agent: "plan" });
      for (const text of [prompt, "A follow-up belongs only to this conversation."]) {
        await call(page, `/api/sessions/${source.id}/prompt`, "POST", { parts: [{ type: "text", text }] });
        await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${source.id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
      }
      const create = page.getByRole("button", { name: "Create routine", exact: true });
      const name = page.getByRole("textbox", { name: "Name", exact: true });
      const instructions = page.getByRole("textbox", { name: "Instructions", exact: true });
      const error = page.getByRole("heading", { name: "Couldn’t load this", exact: true });
      await navigate(page, `#/automation-edit?source=missing-source&theme=${theme}`);
      await expect(error).toBeVisible();
      await expect(create).toBeDisabled();
      await expect(page.getByRole("radio", { name: /Bot A/ })).toHaveCount(0);
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);
      await capture(page, `routine-source-missing-${theme}`);

      await openRoutine(page, source, theme);
      await expect(instructions).toHaveValue(prompt);
      await expect(name).toHaveValue(title.slice(0, 60));
      const edited = "The reviewed routine prompt, independent of the conversation.";
      await instructions.fill(edited);
      await name.fill("Reassigned routine");
      await page.getByRole("radiogroup", { name: "Assigned Bot", exact: true }).getByRole("radio", { name: /Bot A/ }).click();
      await create.click();
      await expect(page).toHaveURL(/#\/automations(?:\?|$)/);
      const tasks = await call<ScheduledTask[]>(page, "/api/tasks");
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ title: "Reassigned routine", prompt: edited, model: botModel, botID: a.id });
      expect(tasks[0].agent).toBeUndefined();
      expect(tasks[0].directory).toBeUndefined();
      await page.getByRole("button", { name: "Options for Reassigned routine", exact: true }).click();
      await page.getByRole("menuitem", { name: "Run now", exact: true }).click();
      await expect.poll(async () => (await call<ScheduledTask>(page, `/api/tasks/${tasks[0].id}`)).runs[0]?.status).toBe("success");
      const run = (await call<ScheduledTask>(page, `/api/tasks/${tasks[0].id}`)).runs[0];
      const session = await call<Session>(page, `/api/sessions/${run.sessionID}`);
      expect(session).toMatchObject({ kind: "bot", botID: a.id, model: botModel, agent: "build" });
      expect(session.directory).toBeUndefined();
      expect(fake.requests).toHaveLength(3);
      expect(fake.requests[2].body.model).toBe(botModel.modelID);
      expect(JSON.stringify(fake.requests[2].body.messages)).toContain(a.persona);
      expect(JSON.stringify(fake.requests[2].body.messages)).not.toContain("Working directory:");

      // An already loaded draft must retain its content when its source is deleted before Create.
      await openRoutine(page, source, theme);
      await expect(instructions).toHaveValue(prompt);
      await call(page, `/api/sessions/${source.id}`, "DELETE");
      await create.click();
      await expect(page.getByText("Couldn’t save. Try again.", { exact: true })).toBeVisible();
      await expect(instructions).toHaveValue(prompt);
      await expect(create).toBeEnabled();
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toHaveLength(1);
      await page.reload();
      await expect(error).toBeVisible();
      await expect(create).toBeDisabled();

      const withFile = await call<Session>(page, "/api/sessions", "POST", { title: "Task with an attachment", kind: "bot", botID: b.id, model: sourceModel, directory: dataDir, agent: "plan" });
      await call(page, `/api/sessions/${withFile.id}/prompt`, "POST", { parts: [{ type: "text", text: prompt }] });
      await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${withFile.id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
      await openRoutine(page, withFile, theme);
      await expect(instructions).toHaveValue(prompt);
      // A file added while the draft is open also prevents text-only conversion.
      await call(page, `/api/sessions/${withFile.id}/prompt`, "POST", { parts: [{ type: "text", text: "Use this image too." }, { type: "file", mime: "image/png", filename: "source.png", url: `data:image/png;base64,${PNG}` }] });
      await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${withFile.id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
      await create.click();
      await expect(page.getByText("Couldn’t save. Try again.", { exact: true })).toBeVisible();
      await expect(instructions).toHaveValue(prompt);
      await expect(create).toBeEnabled();
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toHaveLength(1);
      await openRoutine(page, withFile, theme);
      await expect(error).toBeVisible();
      await expect(create).toBeDisabled();
      await expect(instructions).toHaveCount(0);
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toHaveLength(1);
      const original = await call<MessageWithParts[]>(page, `/api/sessions/${withFile.id}/messages`);
      expect(original.flatMap((m) => m.parts).filter((p) => p.type === "file")).toMatchObject([{ filename: "source.png" }]);
      await capture(page, `routine-source-attachment-refused-${theme}`);

      const orphan = await call<Session>(page, "/api/sessions", "POST", { title: "Deleted Bot source", kind: "bot", botID: b.id, model: sourceModel });
      await call(page, `/api/sessions/${orphan.id}/prompt`, "POST", { parts: [{ type: "text", text: prompt }] });
      await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${orphan.id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
      await call(page, `/api/bots/${b.id}`, "DELETE");
      await navigate(page, `#/automation-edit?source=${orphan.id}&theme=${theme}`);
      await expect(error).toBeVisible();
      await expect(create).toBeDisabled();
      await expect(page.getByRole("radio", { name: /Bot A/ })).toHaveCount(0);
      expect(await call<ScheduledTask[]>(page, "/api/tasks")).toHaveLength(1);
      expect(errors).toEqual([]);
    } finally { await app.close(); await fake.close(); }
  });
}

test("Routine source navigation ignores late source responses and late save completion", async () => {
  const fake = await startFakeProvider();
  const { app, page, dataDir } = await launch({ hash: "#/automations?theme=light", env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Source Bot", model: botModel });
    const first = await call<Session>(page, "/api/sessions", "POST", { title: "First source", kind: "bot", botID: bot.id, model: sourceModel, directory: dataDir, agent: "plan" });
    const second = await call<Session>(page, "/api/sessions", "POST", { title: "Second source", kind: "bot", botID: bot.id, model: botModel });
    for (const source of [first, second]) {
      await call(page, `/api/sessions/${source.id}/prompt`, "POST", { parts: [{ type: "text", text: source.title }] });
      await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${source.id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
    }
    await page.evaluate((id) => {
      const json = Response.prototype.json;
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      window.addEventListener("release-routine-source", () => { Response.prototype.json = json; release(); }, { once: true });
      // Hold parsing after the real IPC response, allowing another source route to commit first.
      Response.prototype.json = async function () {
        const value = await json.call(this);
        if (value?.id === id && value.kind === "bot") {
          document.documentElement.dataset.sourceHeld = "true";
          await held;
          document.documentElement.dataset.sourceReleased = "true";
        }
        return value;
      };
    }, first.id);
    await navigate(page, `#/automation-edit?source=${first.id}&theme=light`);
    await expect(page.locator("html")).toHaveAttribute("data-source-held", "true");
    await expect(page.getByRole("status")).toHaveText("Loading…");
    await expect(page.getByTestId("routine-save")).toBeDisabled();
    await navigate(page, `#/automation-edit?source=${second.id}&theme=light`);
    const name = page.getByRole("textbox", { name: "Name", exact: true });
    const instructions = page.getByRole("textbox", { name: "Instructions", exact: true });
    await expect(name).toHaveValue(second.title);
    await expect(instructions).toHaveValue(second.title);
    await instructions.fill("Reviewed second source");
    await page.evaluate(() => window.dispatchEvent(new Event("release-routine-source")));
    await expect(page.locator("html")).toHaveAttribute("data-source-released", "true");
    await expect(name).toHaveValue(second.title);
    await expect(instructions).toHaveValue("Reviewed second source");
    expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);

    await page.evaluate(() => {
      const json = Response.prototype.json;
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      window.addEventListener("release-routine-saved", () => { Response.prototype.json = json; release(); }, { once: true });
      // The task is already persisted; only delay the renderer's Create completion.
      Response.prototype.json = async function () {
        const value = await json.call(this);
        if (value?.title === "Second source" && value.schedule) {
          document.documentElement.dataset.saveHeld = "true";
          await held;
          document.documentElement.dataset.saveReleased = "true";
        }
        return value;
      };
    });
    await page.getByTestId("routine-save").click();
    await expect(page.locator("html")).toHaveAttribute("data-save-held", "true");
    await expect(name).toBeDisabled();
    await navigate(page, "#/work-home?theme=light");
    await expect(page.getByRole("button", { name: "Task options", exact: true }).first()).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("release-routine-saved")));
    await expect(page.locator("html")).toHaveAttribute("data-save-released", "true");
    await expect(page).toHaveURL(/#\/work-home\?/);
    await expect(page.getByText("Routine created", { exact: true })).toHaveCount(0);
    const tasks = await call<ScheduledTask[]>(page, "/api/tasks");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: second.title, prompt: "Reviewed second source", model: botModel, botID: bot.id });
    expect(tasks[0].directory).toBeUndefined();
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); }
});

test("Routine source waits for its Bot list and retains the draft through list failure and retry", async () => {
  const fake = await startFakeProvider();
  const { app, page, dataDir } = await launch({ hash: "#/automations?theme=light", env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const b = await call<Bot>(page, "/api/bots", "POST", { name: "Bot B", model: botModel });
    await call<Bot>(page, "/api/bots", "POST", { name: "Bot A", model: botModel });
    const source = await call<Session>(page, "/api/sessions", "POST", { title, kind: "bot", botID: b.id, model: sourceModel, directory: dataDir, agent: "plan" });
    await call(page, `/api/sessions/${source.id}/prompt`, "POST", { parts: [{ type: "text", text: prompt }] });
    await expect.poll(async () => (await call<MessageWithParts[]>(page, `/api/sessions/${source.id}/messages`)).at(-1)?.info.time.completed).toBeDefined();
    await page.evaluate(() => {
      const w = window as unknown as { routineListRefuse: boolean };
      w.routineListRefuse = true;
      const RequestOriginal = Request;
      // Refuse only the list via a real missing record; source Bot GET and all writes reach the engine.
      window.Request = class extends RequestOriginal {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          const request = new RequestOriginal(input, init);
          const url = new URL(request.url);
          const refuse = w.routineListRefuse && request.method === "GET" && url.pathname === "/api/bots";
          url.pathname += "/routine-list-missing";
          super(refuse ? url.href : request);
        }
      };
    });
    await navigate(page, `#/automation-edit?source=${source.id}&theme=light`);
    const name = page.getByRole("textbox", { name: "Name", exact: true });
    const instructions = page.getByRole("textbox", { name: "Instructions", exact: true });
    const create = page.getByRole("button", { name: "Create routine", exact: true });
    const assigned = page.getByRole("radiogroup", { name: "Assigned Bot", exact: true });
    await expect(name).toHaveValue(title.slice(0, 60));
    await expect(instructions).toHaveValue(prompt);
    await expect(assigned.getByRole("radio")).toHaveCount(0);
    await capture(page, "routine-source-list-unavailable");
    await expect(create).toBeDisabled({ timeout: 2500 });
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Couldn’t load this");
    await expect(alert.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    const draft = `${prompt}\nKeep this reviewed instruction.`;
    await instructions.fill(draft);
    expect(await call<ScheduledTask[]>(page, "/api/tasks")).toEqual([]);
    await page.evaluate(() => {
      (window as unknown as { routineListRefuse: boolean }).routineListRefuse = false;
      const json = Response.prototype.json;
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      window.addEventListener("release-routine-list", () => { Response.prototype.json = json; release(); }, { once: true });
      // Hold parsing of the real retry response: the draft must stay editable while its Bot is pending.
      Response.prototype.json = async function () {
        const value = await json.call(this);
        if (Array.isArray(value) && value.some((item) => item.name === "Bot B" && item.mascot)) {
          document.documentElement.dataset.routineListHeld = "true";
          await held;
        }
        return value;
      };
    });
    await alert.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-routine-list-held", "true");
    await expect(create).toBeDisabled();
    await expect(instructions).toBeEditable();
    await expect(instructions).toHaveValue(draft);
    await page.evaluate(() => window.dispatchEvent(new Event("release-routine-list")));
    await expect(alert).toHaveCount(0);
    await expect(assigned.getByRole("radio", { name: /Bot B/ })).toHaveAttribute("aria-checked", "true");
    await expect(assigned.getByRole("radio", { name: /Bot A/ })).toHaveAttribute("aria-checked", "false");
    await expect(instructions).toHaveValue(draft);
    await expect(create).toBeEnabled();
    await create.click();
    await expect(page).toHaveURL(/#\/automations(?:\?|$)/);
    const tasks = await call<ScheduledTask[]>(page, "/api/tasks");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: title.slice(0, 60), prompt: draft, botID: b.id, model: sourceModel, agent: "plan", directory: dataDir });
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); }
});
