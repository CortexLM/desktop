import { test, expect, _electron as electron, type Page } from "@playwright/test";
import type { Project, Session, MessageWithParts } from "@cortex/schema";
import fs from "node:fs";
import path from "node:path";
import { launch, root } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify({ fake: { ...catalog.fake, models: { reasoner: catalog.fake.models.reasoner } } }))}`;
const name = "Café preparation", first = "Keep the amber project context.", second = "Keep the violet project context.", edited = "Use the updated amber instructions.";

async function request<T>(page: Page, url: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ url, method, body }) => {
    const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${url}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
    return response.json();
  }, { url, method, body });
}
const navigate = (page: Page, hash: string) => page.goto(`${page.url().split("#")[0]}${hash}`);
async function capture(page: Page, label: string) {
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const main = document.querySelector<HTMLElement>("main")!;
    const surface = dialog ?? main;
    const r = surface.getBoundingClientRect();
    return { overflow: surface.scrollWidth > surface.clientWidth + 1, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight };
  });
  expect(geometry.overflow).toBe(false);
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(geometry.width);
  expect(geometry.top).toBeGreaterThanOrEqual(0); expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  const file = test.info().outputPath(`${label}.png`);
  await page.screenshot({ path: file, animations: "disabled" });
  await test.info().attach(label, { path: file, contentType: "image/png" });
}
async function create(page: Page, instructions: string, orange = false, theme?: string) {
  await page.locator(".sidebar").getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New project", exact: true });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await dialog.getByRole("textbox", { name: "Instructions", exact: true }).fill(instructions);
  if (orange) {
    const icon = dialog.getByRole("radiogroup", { name: "Icon", exact: true });
    await icon.getByRole("radio", { name: "Calendar", exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(icon.getByRole("radio", { name: "Rocket", exact: true })).toHaveAttribute("aria-checked", "true");
    await dialog.getByRole("radio", { name: "Orange", exact: true }).click();
    for (const group of [icon, dialog.getByRole("radiogroup", { name: "Color", exact: true })]) {
      await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
      await expect(group.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
    }
  }
  if (theme) await capture(page, `project-create-${theme}`);
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".systeme-phead h1")).toHaveText(name);
  const id = await page.evaluate(() => new URLSearchParams(location.hash.split("?")[1]).get("id"));
  expect(id).toBeTruthy();
  return request<Project>(page, `/api/projects/${id}`);
}
async function move(page: Page, projectID: string) {
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Move to a project", exact: true }).click();
  await page.getByRole("combobox", { name: "Chat project", exact: true }).selectOption(projectID);
  await page.locator(".content-top").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Chat project", exact: true })).toHaveCount(0);
}
async function completed(page: Page, id: string, count: number) {
  await expect.poll(async () => (await request<MessageWithParts[]>(page, `/api/sessions/${id}/messages`)).filter((m) => m.info.role === "assistant" && m.info.time.completed && !m.info.error).length).toBe(count);
  await expect(page.getByTestId("assistant-text")).toHaveCount(count);
  await expect(page.getByTestId("assistant-text").last()).toContainText("Hello from the streaming test provider.");
}

for (const theme of ["light", "dark"]) test(`Projects persist through two restarts, route exact identities and preserve chats on deletion — ${theme}`, async () => {
  const fake = await startFakeProvider();
  const env = { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` };
  const launched = await launch({ hash: `#/projects?theme=${theme}`, env });
  const { dataDir } = launched;
  let { app, page } = launched;
  const errors: string[] = [];
  const setup = async () => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  };
  const reopen = async (hash: string) => {
    await app.close();
    app = await electron.launch({ args: [path.join(root, "packages/desktop/dist/main.cjs"), `--user-data-dir=${path.join(dataDir, "renderer")}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
      env: { ...process.env, ...env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: hash, CORTEX_LOCALE: "en" } as Record<string, string> });
    page = await app.firstWindow();
    await setup();
    await page.waitForFunction(() => "__bridgeFetch" in window);
  };
  try {
    await setup();
    await expect(page.getByRole("heading", { name: "No projects yet", exact: true })).toBeVisible();
    const a = await create(page, first, true, theme), b = await create(page, second);
    expect(a).toMatchObject({ name, instructions: first, icon: "rocket", color: "#FF6A13" });
    expect(b).toMatchObject({ name, instructions: second, icon: "calendar", color: "#8448FF" });
    expect(a.id).not.toBe(b.id);
    await navigate(page, `#/projects?theme=${theme}`);
    await expect(page.locator(".systeme-pcard h3")).toHaveText([name, name]);
    const order = await request<Project[]>(page, "/api/projects");
    await page.locator(".systeme-pcard").nth(order.findIndex((p) => p.id === a.id)).click();
    await expect(page).toHaveURL(new RegExp(`id=${a.id}`));
    await request(page, "/api/providers/fake/key", "PUT", { key: "sk-test-projects-1234" });
    await page.locator("main").getByRole("button", { name: "New chat", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`project=${a.id}`));
    const input = page.getByTestId("composer-input");
    await expect(page.getByTestId("model-trigger")).toHaveText(/Reasoner Large/);
    await input.fill("Prepare the project handoff");
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
    await request(page, "/api/providers/fake", "PATCH", { enabled: false });
    await app.evaluate(({ ipcMain }) => {
      const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<Reply>> })._invokeHandlers.get("cortex:fetch")!;
      const replies: Reply[] = [];
      (globalThis as unknown as { projectPrompts: Reply[] }).projectPrompts = replies;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, req: Wire) => {
        const response = await original(event, req);
        if (req.method === "POST" && new URL(req.url).pathname.endsWith("/prompt")) replies.push(response);
        return response;
      });
    });
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(input).toHaveValue("Prepare the project handoff");
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
    await expect.poll(async () => (await request<Session[]>(page, "/api/sessions")).length).toBe(1);
    const refused = (await request<Session[]>(page, "/api/sessions"))[0];
    expect(refused.projectID).toBe(a.id); expect(fake.requests).toHaveLength(0);
    const replies = await app.evaluate(() => (globalThis as unknown as { projectPrompts: Reply[] }).projectPrompts);
    expect(replies).toHaveLength(1); expect(replies[0].status).toBe(422);
    expect(JSON.parse(replies[0].body)).toMatchObject({ error: { code: "provider_disabled" } });
    expect(await request(page, `/api/sessions/${refused.id}/messages`)).toEqual([]);
    await request(page, "/api/providers/fake", "PATCH", { enabled: true });
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`id=${refused.id}`));
    await completed(page, refused.id, 1);
    expect(await request<Session[]>(page, "/api/sessions")).toHaveLength(1);
    const system = (index: number) => (fake.requests[index].body.messages as { role: string; content: string }[]).filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(system(0)).toContain(first);
    const messages = await request<MessageWithParts[]>(page, `/api/sessions/${refused.id}/messages`);

    await reopen(`#/project?id=${a.id}&theme=${theme}`);
    expect(await request<Project>(page, `/api/projects/${a.id}`)).toEqual(a);
    expect(await request<Project>(page, `/api/projects/${b.id}`)).toEqual(b);
    expect(await request<MessageWithParts[]>(page, `/api/sessions/${refused.id}/messages`)).toEqual(messages);
    await expect(page.locator("main .list").first()).toContainText("Prepare the project handoff");
    await capture(page, `project-overview-${theme}`);
    const tabs = page.getByRole("tablist", { name: "Project sections", exact: true });
    await tabs.getByRole("tab", { name: "Overview", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Files", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.getByRole("tab", { name: "Overview", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Edit instructions", exact: true }).click();
    const instructions = page.getByRole("textbox", { name: "Project instructions", exact: true });
    await instructions.fill("Discard this edit");
    await page.locator("main").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator("main .systeme-instr")).toHaveText(first);
    await page.locator("main").getByRole("button", { name: "Edit", exact: true }).click();
    await instructions.fill(edited);
    await page.locator("main").getByRole("button", { name: "Save", exact: true }).click();
    await expect(instructions).toHaveCount(0);
    await expect(page.locator("main .systeme-instr")).toHaveText(edited);
    await capture(page, `project-instructions-${theme}`);
    await navigate(page, `#/chat?id=${refused.id}&theme=${theme}`);
    await page.getByTestId("composer-input").fill("Use the revised instructions");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await completed(page, refused.id, 2);
    expect(system(1)).toContain(edited);
    expect(system(1)).not.toContain(first);
    await move(page, b.id);
    expect((await request<Session>(page, `/api/sessions/${refused.id}`)).projectID).toBe(b.id);
    await move(page, "");
    expect((await request<Session>(page, `/api/sessions/${refused.id}`)).projectID).toBeUndefined();
    await move(page, b.id);
    await navigate(page, `#/history?project=${a.id}&theme=${theme}`);
    await expect(page.locator("main .pg-empty")).toHaveText("Your history is empty.");
    await expect(page.locator(".pg-hrow")).toHaveCount(0);
    await navigate(page, `#/history?project=${b.id}&theme=${theme}`);
    await expect(page.locator(".pg-hrow .ttl")).toHaveText("Prepare the project handoff");
    await navigate(page, `#/search?theme=${theme}`);
    await page.getByRole("combobox", { name: "Search everywhere", exact: true }).fill("violet project");
    const hit = page.getByRole("listbox", { name: "Results", exact: true }).getByRole("option");
    await expect(hit).toHaveCount(1); await hit.click();
    await expect(page).toHaveURL(new RegExp(`id=${b.id}`));
    await navigate(page, `#/library?theme=${theme}`);
    await page.getByRole("textbox", { name: "Search the library", exact: true }).fill("updated amber");
    await page.locator("main .card").click();
    await expect(page).toHaveURL(new RegExp(`id=${a.id}`));
    const treeOrder = await request<Project[]>(page, "/api/projects");
    const tree = page.locator(".sidebar button.row").filter({ hasText: name }).nth(treeOrder.findIndex((p) => p.id === b.id));
    await tree.click(); await expect(tree).toHaveAttribute("aria-expanded", "true");
    const children = page.locator(`[id="${await tree.getAttribute("aria-controls")}"]`);
    await children.getByRole("button", { name: "Prepare the project handoff", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`id=${refused.id}`));
    await children.getByRole("button", { name: "See all", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`id=${b.id}`));
    await tree.press("Space"); await expect(tree).toHaveAttribute("aria-expanded", "false");
    await expect(children).toHaveAttribute("inert", "");
    const beforeDelete = await request<MessageWithParts[]>(page, `/api/sessions/${refused.id}/messages`);
    await navigate(page, `#/project?id=${b.id}&theme=${theme}`);
    await page.getByRole("button", { name: "More actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "Delete project", exact: true }).click();
    await expect(page).toHaveURL(/#\/projects(?:\?|$)/);
    expect((await request<Session>(page, `/api/sessions/${refused.id}`)).projectID).toBeUndefined();
    expect(await request<MessageWithParts[]>(page, `/api/sessions/${refused.id}/messages`)).toEqual(beforeDelete);

    await reopen(`#/projects?theme=${theme}`);
    expect(await request<Project[]>(page, "/api/projects")).toMatchObject([{ ...a, instructions: edited, time: { created: a.time.created } }]);
    expect(await request<MessageWithParts[]>(page, `/api/sessions/${refused.id}/messages`)).toEqual(beforeDelete);
    expect((await request<Session>(page, `/api/sessions/${refused.id}`)).projectID).toBeUndefined();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900));
    await expect(page.locator(".systeme-pcard h3")).toHaveText([name]);
    await expect(page.locator("main [role=status], main [role=alert]")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([1440, 900]);
    await capture(page, `projects-persisted-${theme}`);
    await navigate(page, `#/project?id=${b.id}&theme=${theme}`);
    await expect(page.getByRole("heading", { name: "This project isn’t available", exact: true })).toBeVisible();
    await navigate(page, `#/chat?id=${refused.id}&theme=${theme}`);
    await page.getByTestId("composer-input").fill("Continue outside a project");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await completed(page, refused.id, 3);
    expect(system(2)).not.toContain(edited);
    expect(system(2)).not.toContain(second);
    expect(fake.requests).toHaveLength(3);
    expect(errors).toEqual([]);
  } finally { try { await app.close(); } finally { try { await fake.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } } }
});

type Wire = { url: string; method: string; headers: [string, string][]; body?: string };
type Reply = { status: number; headers: [string, string][]; body: string };
type Gate = { path?: string; method?: string; held?: Reply; delivered?: Reply; release?: () => void; restore: () => void; writes: number };

test("Projects retain newer drafts and isolate late reads/writes across owners", async () => {
  const { app, page, dataDir } = await launch({ hash: "#/projects", env: { CORTEX_CATALOG_URL: CATALOG_URL } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const release = () => app.evaluate(() => { const g = (globalThis as unknown as { projectGate?: Gate }).projectGate; g?.release?.(); if (g) { g.release = undefined; g.path = undefined; } });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const a = await create(page, first), b = await create(page, second);
    await app.evaluate(({ ipcMain }) => {
      const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<Reply>> })._invokeHandlers.get("cortex:fetch")!;
      const gate: Gate = { writes: 0, restore: () => { ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", original); } };
      (globalThis as unknown as { projectGate: Gate }).projectGate = gate;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, req: Wire) => {
        const hold = gate.path === new URL(req.url).pathname && gate.method === req.method;
        if (hold) gate.path = undefined;
        if (req.method === "PATCH" && new URL(req.url).pathname.startsWith("/api/projects/")) gate.writes++;
        const response = await original(event, req);
        if (hold) { gate.held = structuredClone(response); await new Promise<void>((resolve) => { gate.release = resolve; }); gate.delivered = structuredClone(response); }
        return response;
      });
    });
    const arm = (id: string, method: string) => app.evaluate((_, { id, method }) => {
      const gate = (globalThis as unknown as { projectGate: Gate }).projectGate;
      gate.path = `/api/projects/${id}`; gate.method = method; gate.held = undefined; gate.delivered = undefined;
    }, { id, method });
    const held = () => app.evaluate(() => (globalThis as unknown as { projectGate: Gate }).projectGate.held);
    const settle = async () => {
      const response = await held(); expect(response).toBeDefined();
      await release();
      await expect.poll(() => app.evaluate(() => (globalThis as unknown as { projectGate: Gate }).projectGate.delivered)).toEqual(response);
      await request(page, "/api/projects");
      await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
    };
    const edit = async (id: string) => {
      await navigate(page, `#/project?id=${id}&v=instructions`);
      await page.locator("main").getByRole("button", { name: "Edit", exact: true }).click();
    };
    await edit(a.id);
    const instructions = page.getByRole("textbox", { name: "Project instructions", exact: true });
    await instructions.fill(edited); await arm(a.id, "PATCH");
    const save = page.locator("main").getByRole("button", { name: "Save", exact: true });
    await save.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect.poll(held).toBeDefined();
    expect((await held())?.status).toBe(200);
    expect(await app.evaluate(() => (globalThis as unknown as { projectGate: Gate }).projectGate.writes)).toBe(1);
    await expect(instructions).toBeEnabled(); await expect(save).toBeDisabled();
    await instructions.fill("A newer unsaved edit");
    await settle(); await expect(save).toBeEnabled();
    await expect(instructions).toHaveValue("A newer unsaved edit");
    expect((await request<Project>(page, `/api/projects/${a.id}`)).instructions).toBe(edited);
    await save.click(); await expect(instructions).toHaveCount(0);
    expect((await request<Project>(page, `/api/projects/${a.id}`)).instructions).toBe("A newer unsaved edit");

    await edit(a.id); await instructions.fill("Accepted in A while visiting B"); await arm(a.id, "PATCH"); await save.click();
    await expect.poll(held).toBeDefined();
    await navigate(page, `#/project?id=${b.id}&v=instructions`);
    await expect(page.locator("main .systeme-instr")).toHaveText(second);
    await settle();
    await expect(page).toHaveURL(new RegExp(`id=${b.id}`));
    await expect(page.locator("main .systeme-instr")).toHaveText(second);
    expect((await request<Project>(page, `/api/projects/${a.id}`)).instructions).toBe("Accepted in A while visiting B");
    expect((await request<Project>(page, `/api/projects/${b.id}`)).instructions).toBe(second);

    await arm(a.id, "GET"); await navigate(page, `#/project?id=${a.id}&v=instructions`); await expect.poll(held).toBeDefined();
    await navigate(page, `#/project?id=${b.id}&v=instructions`);
    await expect(page.locator("main .systeme-instr")).toHaveText(second);
    await settle(); await expect(page.locator("main .systeme-instr")).toHaveText(second);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`id=${a.id}`));
    await expect(page.locator("main .systeme-instr")).toHaveText("Accepted in A while visiting B");
    await page.getByRole("button", { name: "Forward", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`id=${b.id}`));
    await expect(page.locator("main .systeme-instr")).toHaveText(second);
    await edit(b.id); await instructions.fill("Retain after a real validation refusal");
    // Add a forbidden field to one serialized request; the real protocol validates it.
    await page.evaluate(() => {
      const original = Request.prototype.text;
      Request.prototype.text = async function () {
        if (this.method === "PATCH" && new URL(this.url).pathname.startsWith("/api/projects/")) {
          Request.prototype.text = original;
          return JSON.stringify({ ...JSON.parse(await original.call(this)), id: "forbidden-client-id" });
        }
        return original.call(this);
      };
    });
    await arm(b.id, "PATCH"); await save.click(); await expect.poll(held).toBeDefined();
    expect((await held())?.status).toBe(400);
    expect(JSON.parse((await held())!.body)).toMatchObject({ error: { code: "invalid_request" } });
    await settle();
    await expect(instructions).toHaveValue("Retain after a real validation refusal");
    await expect(save).toBeEnabled();
    expect((await request<Project>(page, `/api/projects/${b.id}`)).instructions).toBe(second);
    await save.click(); await expect(instructions).toHaveCount(0);
    expect((await request<Project>(page, `/api/projects/${b.id}`)).instructions).toBe("Retain after a real validation refusal");
    await page.evaluate(() => {
      const original = Request;
      const state = window as unknown as { projectReadsAllowed?: boolean; restoreProjectReads?: () => void };
      state.projectReadsAllowed = false;
      state.restoreProjectReads = () => { state.projectReadsAllowed = true; window.Request = original; };
      window.Request = class extends original {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          const request = new original(input, init), url = new URL(request.url);
          const refuse = !state.projectReadsAllowed && request.method === "GET" && url.pathname === "/api/projects";
          if (refuse) url.pathname += "/missing-project";
          super(refuse ? url.href : request);
        }
      };
    });
    await navigate(page, "#/library");
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await expect(page.locator("main .card")).toHaveCount(0);
    await page.evaluate(() => (window as unknown as { restoreProjectReads: () => void }).restoreProjectReads());
    await page.locator("main").getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator("main .card")).toHaveCount(2);
    expect(errors).toEqual([]);
  } finally {
    try { await release(); }
    finally {
      try { await app.evaluate(() => (globalThis as unknown as { projectGate?: Gate }).projectGate?.restore()); }
      finally { try { await app.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } }
    }
  }
});

for (const theme of ["light", "dark"]) test(`Projects keep accepted unbroken names and instructions readable at minimum size — ${theme}`, async () => {
  const { app, page, dataDir } = await launch({ hash: `#/projects?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL } });
  const name = "W".repeat(48), instructions = "W".repeat(4000), errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fits = async (selector: string) => {
    const targets = page.locator(selector);
    await expect(targets.first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const measured = await targets.evaluateAll((elements) => elements.map((el) => {
      const rect = el.getBoundingClientRect();
      return { tag: el.tagName, className: el.className, width: el.clientWidth, contentWidth: el.scrollWidth, right: rect.right, fits: el.scrollWidth <= el.clientWidth + 1 && rect.left >= 0 && rect.right <= innerWidth };
    }));
    expect.soft(measured.filter((row) => !row.fits), selector).toEqual([]);
  };
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
    await page.locator(".sidebar").getByRole("button", { name: "New project", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New project", exact: true });
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    await dialog.getByRole("textbox", { name: "Instructions", exact: true }).fill(instructions);
    await fits(".systeme-preview, .systeme-preview > span:last-child");
    await dialog.getByRole("button", { name: "Create project", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".systeme-phead h1")).toHaveText(name);
    const [project] = await request<Project[]>(page, "/api/projects");
    expect(project).toMatchObject({ name, instructions });
    await fits(".page, .systeme-phead h1, .systeme-instr");
    await page.getByRole("tab", { name: "Instructions", exact: true }).click();
    await expect(page.locator(".systeme-tabs [aria-selected=true]")).toHaveText("Instructions");
    await fits(".page, .systeme-phead h1, .systeme-instr");
    await capture(page, `project-long-input-${theme}`);
    await navigate(page, `#/projects?theme=${theme}`);
    await expect(page.locator(".systeme-pcard h3")).toHaveText(name);
    await fits(".page, .systeme-pbody, .systeme-pbody h3");
    await navigate(page, `#/library?theme=${theme}`);
    await expect(page.locator("main .card h3")).toHaveText(name);
    await fits(".page, main .card .body2, main .card h3, main .card p");
    expect((await request<Project>(page, `/api/projects/${project.id}`)).instructions).toBe(instructions);
    expect(errors).toEqual([]);
  } finally { try { await app.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); } }
});
