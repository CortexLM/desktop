import { test, expect, type Page } from "@playwright/test";
import type { Bot, Session, MessageWithParts } from "@cortex/schema";
import { launch, root } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`;

async function call<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ url, method, body }) => {
    const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
    const r = await bridge(`cortex://local${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(`${method} ${url}: ${r.status}`);
    return r.status === 204 ? null : r.json();
  }, { url, method, body });
}

async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const theme of ["light", "dark"]) {
  test(`Code keeps cancelled and no-model drafts, locks pending submits — ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/code?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PICK_DIRECTORY: "", CORTEX_TEST_PROVIDER_BASEURL: "" } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ app, BrowserWindow, dialog }) => {
        BrowserWindow.getAllWindows()[0].setSize(960, 640);
        // Exercise the native-dialog IPC path; the engine remains real.
        dialog.showOpenDialog = (() => new Promise((resolve) => {
          (app as NodeJS.EventEmitter).once("composer-directory-result", (directory: string | null) => resolve({ canceled: !directory, filePaths: directory ? [directory] : [] }));
        })) as typeof dialog.showOpenDialog;
      });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const input = page.getByTestId("code-composer-input");
      const form = page.locator("form.composer");
      const draft = "  Keep this Code task exactly as typed  ";
      await input.fill(draft);
      await page.getByTestId("composer-send").click();
      await expect(input).toBeDisabled();
      await expect(input).toHaveValue(draft);
      await expect(form).toHaveAttribute("aria-busy", "true");
      for (const button of await form.getByRole("button").all()) await expect(button).toBeDisabled();
      await expect.poll(() => app.evaluate(({ app }) => app.listenerCount("composer-directory-result"))).toBe(1);
      await form.evaluate((el: HTMLFormElement) => { el.requestSubmit(); el.requestSubmit(); });
      expect(await app.evaluate(({ app }) => app.listenerCount("composer-directory-result"))).toBe(1);
      await app.evaluate(({ app }) => app.emit("composer-directory-result", null));
      await expect(input).toBeEnabled();
      await expect(input).toHaveValue(draft);
      expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);

      await input.press("Enter");
      await expect(input).toBeDisabled();
      await expect.poll(() => app.evaluate(({ app }) => app.listenerCount("composer-directory-result"))).toBe(1);
      await app.evaluate(({ app }, directory) => app.emit("composer-directory-result", directory), root);
      await expect(page.getByText("No model available", { exact: true })).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(input).toBeEnabled();
      await expect(input).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId("composer-send")).toBeInViewport({ ratio: 1 });
      expect(await call<Session[]>(page, "/api/sessions")).toEqual([]);
      await capture(page, `code-draft-kept-${theme}`);

      const session = await call<Session>(page, "/api/sessions", "POST", { kind: "code", directory: root, model: { providerID: "anthropic", modelID: "claude-x" } });
      await page.goto(`${page.url().split("#")[0]}#/code-session?theme=${theme}&id=${session.id}`);
      await expect(page.locator(".split-l .composer")).toBeVisible();
      await input.fill(draft);
      await page.getByTestId("composer-send").click();
      await expect(page.getByText("Message not sent", { exact: true })).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(input).toBeEnabled();
      expect(await call<MessageWithParts[]>(page, `/api/sessions/${session.id}/messages`)).toEqual([]);
      await capture(page, `code-session-draft-kept-${theme}`);
      expect(errors).toEqual([]);
    } finally { await app.close(); }
  });

  test(`Work and Bot drafts survive engine refusal; accepted sends clear once — ${theme}`, async () => {
    const fake = await startFakeProvider();
    const { app, page } = await launch({ hash: `#/work-home?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await call(page, "/api/providers/fake", "PATCH", { enabled: false });
      const model = { providerID: "fake", modelID: "reasoner" };
      await call<Bot>(page, "/api/bots", "POST", { name: "Task bot", model });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { name: "Hand your first task to Task bot" })).toBeVisible();
      await expect(page.locator(".empty .composer")).toBeVisible();
      const input = page.getByTestId("composer-input");
      const draft = "  Keep this task after refusal  ";
      await input.fill(draft);
      await page.getByTestId("composer-send").click();
      await expect(page.getByText("Couldn’t send that. Try again.", { exact: true })).toBeVisible();
      // session.created replaces the empty board before the engine refuses the prompt.
      await expect(page.locator(".travail-compose .composer")).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(input).toBeEnabled();
      await expect(input).toBeInViewport({ ratio: 1 });
      const tasks = await call<Session[]>(page, "/api/sessions?kind=bot");
      expect(tasks).toHaveLength(1);
      expect(await call<MessageWithParts[]>(page, `/api/sessions/${tasks[0].id}/messages`)).toEqual([]);
      await capture(page, `work-draft-kept-${theme}`);

      const bot = await call<Bot>(page, "/api/bots", "POST", { name: "Draft bot", model });
      for (const route of [`work-task?id=${tasks[0].id}`, `bot?id=${bot.id}`]) {
        await page.goto(`${page.url().split("#")[0]}#/${route}&theme=${theme}`);
        await page.reload();
        await input.fill(draft);
        await page.getByTestId("composer-send").click();
        await expect(page.getByText("Couldn’t send that. Try again.", { exact: true })).toBeVisible();
        await expect(input).toHaveValue(draft);
        await expect(input).toBeEnabled();
        await expect(input).toBeInViewport({ ratio: 1 });
        await capture(page, `${route.split("?")[0]}-draft-kept-${theme}`);
      }
      const botSessions = await call<Session[]>(page, `/api/bots/${bot.id}/sessions`);
      expect(botSessions).toHaveLength(1);
      expect(await call<MessageWithParts[]>(page, `/api/sessions/${botSessions[0].id}/messages`)).toEqual([]);
      expect(fake.requests).toHaveLength(0);

      await call(page, "/api/providers/fake", "PATCH", { enabled: true });
      // Two submits in one turn must admit one message, before React can disable controls.
      await page.locator("form.composer").evaluate((el: HTMLFormElement) => { el.requestSubmit(); el.requestSubmit(); });
      await expect(input).toHaveValue("");
      await expect(page.locator(".msg-user")).toHaveText(draft.trim());
      await expect(page.locator(".msg-bot")).toContainText("Everything works.");
      const messages = await call<MessageWithParts[]>(page, `/api/sessions/${botSessions[0].id}/messages`);
      expect(messages.filter((m) => m.info.role === "user")).toHaveLength(1);
      expect(fake.requests).toHaveLength(1);
      expect(errors).toEqual([]);
    } finally { await app.close(); await fake.close(); }
  });
}
