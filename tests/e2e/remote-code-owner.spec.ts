import { test, expect, type ElectronApplication } from "@playwright/test";
import fs from "node:fs";
import { launch } from "./fixtures";

const id = "cnv_00000000000000000000000001";
type Wire = { url: string; method: string; body?: string };
type Gate = { calls: { path: string; body: unknown }[]; arrival: Promise<void>; arrived(): void; held: Promise<void>; release(): void; epoch: string; defer: string; restore(): void };
async function install(app: ElectronApplication, defer: string) {
  await app.evaluate(({ ipcMain }, { id, defer }) => {
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<unknown>> })._invokeHandlers;
    const original = handlers.get("cortex:fetch")!;
    let arrived!: () => void, release!: () => void;
    const gate: Gate = { calls: [], epoch: "old", defer, arrival: new Promise<void>(resolve => { arrived = resolve; }), arrived: () => arrived(), held: new Promise<void>(resolve => { release = resolve; }), release: () => release(), restore() { ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", original); } };
    (globalThis as unknown as { codeGate: Gate }).codeGate = gate;
    const session = () => ({ id, epoch: gate.epoch, runtime: "local", modelSlug: "fixture", title: "Owner test", state: "waiting", delivery: "ready" });
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname;
      let body: unknown;
      if (path === "/api/connection") body = { mode: "cloud", signedIn: true };
      else if (path === "/api/code/models") body = { epoch: gate.epoch, models: [{ slug: "fixture", name: "Fixture", tools: true }] };
      else if (path === "/api/code/sessions") body = request.method === "POST" ? session() : [];
      else if (path === "/api/code/capabilities") body = { epoch: gate.epoch, cloud: { available: false, reason: "code_compute_not_configured" } };
      else if (path.startsWith("/api/code/")) {
        gate.calls.push({ path, body: request.body ? JSON.parse(request.body) : undefined });
        const epoch = gate.epoch;
        if (path.endsWith(gate.defer)) { gate.arrived(); await gate.held; }
        body = path.endsWith("/snapshot") ? { session: { ...session(), epoch }, messages: [{ id: "message", role: "assistant", text: epoch === "old" ? "OLD_ACCOUNT_CONTENT" : "NEW_ACCOUNT_CONTENT", tools: [] }], permissions: epoch === "old" ? [{ id: "prm_00000000000000000000000001", tool_name: "bash", detail: "OLD_COMMAND" }] : [] } : session();
      } else return original(event, request);
      return { status: 200, headers: [["Content-Type", "application/json"]], body: JSON.stringify(body) };
    });
  }, { id, defer });
}
const arrival = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { codeGate: Gate }).codeGate.arrival);
const release = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { codeGate: Gate }).codeGate.release());

test("Code Home preserves the next draft edited before prompt admission", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await install(app, "/prompt");
    await page.evaluate(() => { location.hash = "#/code"; });
    await expect(page.getByTestId("code-model-picker")).toHaveText("Fixture");
    await page.getByTestId("code-composer-input").fill("submitted");
    const entered = arrival(app);
    await page.getByTestId("code-api-send").click(); await entered;
    await page.getByTestId("code-composer-input").fill("next edited draft");
    await release(app);
    await expect(page.getByTestId("code-reconnect")).toBeVisible();
    await expect(page.getByTestId("code-composer-input")).toHaveValue("next edited draft");
  } finally { await release(app).catch(() => {}); await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("Code replacement epoch clears consent and ignores late old snapshot", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await install(app, "/unused");
    await page.evaluate(id => { location.hash = `#/code-session?source=code-api&id=${id}&epoch=old`; }, id);
    await expect(page.locator(".msg-bot")).toHaveText("OLD_ACCOUNT_CONTENT");
    await expect(page.getByTestId("permission-allow-once")).toBeVisible();
    await app.evaluate(() => { const gate = (globalThis as unknown as { codeGate: Gate }).codeGate; gate.defer = "/snapshot"; });
    const pending = arrival(app);
    await page.getByTestId("code-reconnect").click(); await pending;
    await app.evaluate(() => { (globalThis as unknown as { codeGate: Gate }).codeGate.epoch = "new"; });
    await page.evaluate(id => { location.hash = `#/code-session?source=code-api&id=${id}&epoch=new`; }, id);
    await expect(page.getByTestId("permission-allow-once")).toHaveCount(0);
    await expect(page.locator(".msg-bot")).toHaveCount(0);
    await release(app);
    await expect(page.locator(".msg-bot")).toHaveText("NEW_ACCOUNT_CONTENT");
    await expect(page.getByTestId("permission-allow-once")).toHaveCount(0);
    const calls = await app.evaluate(() => (globalThis as unknown as { codeGate: Gate }).codeGate.calls);
    expect(calls.filter(call => call.path.includes("permissions"))).toEqual([]);
  } finally { await release(app).catch(() => {}); await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

// Code lane UX: design composer and chips (no native select/textarea outside the composer, no runtime jargon),
// sidebar repositories, Machines Cloud occupancy and populated settings panes, against a signed-in producer fake.
test("Code home, sidebar, Machines and settings follow the design without developer jargon", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.evaluate(({ ipcMain }, { id }) => {
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<unknown>> })._invokeHandlers;
      const original = handlers.get("cortex:fetch")!;
      const session = { id, epoch: "e", runtime: "cloud", modelSlug: "fixture", title: "Corriger la pagination", state: "running", delivery: "ready", repo: "atelier/cortex-web" };
      const runtime = (n: string, status: string, trees: number) => ({ id: "rt_" + n, status, repo_url: "https://github.com/atelier/" + n, vcpus: 4, memory_mib: 16384, max_worktrees: 1, worktrees: trees ? [{ path: "/workspace/repo", session_id: id, branch: "fix/pagination" }] : [] });
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
        const path = new URL(request.url).pathname, json = request.body ? JSON.parse(request.body) as { op?: string } : {};
        const body: unknown = path === "/api/connection" ? { mode: "cloud", signedIn: true }
          : path === "/api/code/models" ? { epoch: "e", models: [{ slug: "fixture", name: "Code rapide", tools: true }, { slug: "deep", name: "Code réfléchi", tools: true }] }
          : path === "/api/code/sessions" ? [session]
          : path === "/api/code/capabilities" ? { epoch: "e", cloud: { available: true } }
          : path === "/api/code/repositories" ? { epoch: "e", githubConnected: true, githubState: "connected", items: [{ fullName: "atelier/cortex-web", defaultBranch: "main", private: true, source: "github" }] }
          : path === "/api/code/branches" ? { epoch: "e", repo: "atelier/cortex-web", githubConnected: true, githubState: "connected", items: ["main", "develop"] }
          : path === "/api/code/settings" ? { epoch: "e", defaultModel: "fixture/a", models: [{ ref: "fixture/a", name: "Code rapide" }] }
          : path === "/api/code/contract" && json.op === "code.runtimes" ? { status: 200, data: { items: [runtime("cortex-web", "running", 1), runtime("docs", "hibernated", 0)] } }
          : undefined;
        if (body === undefined) return original(event, request);
        return { status: 200, headers: [["Content-Type", "application/json"]], body: JSON.stringify(body) };
      });
    }, { id });
    await page.evaluate(() => { location.hash = "#/code"; });
    const home = page.getByTestId("screen-code");
    await expect(home.getByTestId("code-model-picker")).toHaveText("Code rapide");
    await expect(home.locator("select, details")).toHaveCount(0);
    await expect(home.locator("textarea")).toHaveCount(1);
    await expect(home.locator("form.composer textarea")).toHaveCount(1);
    await expect(home).not.toContainText(/LOCAL|backend|developer workspace/);
    await expect(home.getByTestId("code-task")).toContainText("Running");
    await home.getByTestId("code-env-picker").click();
    await page.getByRole("menuitemradio", { name: /Cloud/ }).click();
    await expect(home.getByTestId("code-repo-picker")).toBeVisible();
    await home.getByTestId("code-repo-picker").click();
    await page.getByRole("menuitemradio", { name: /atelier\/cortex-web/ }).click();
    await expect(home.getByTestId("code-branch-picker")).toBeVisible();
    await expect(page.getByTestId("code-sidebar-repos")).toContainText("cortex-web");
    await expect(page.getByTestId("code-sidebar-repos")).toContainText("Corriger la pagination");

    await page.evaluate(() => { location.hash = "#/code-machines"; });
    await expect(page.getByTestId("machines-count")).toHaveText("2");
    await expect(page.getByTestId("machines-busy")).toHaveText("1");
    await expect(page.getByTestId("machine-row")).toHaveCount(2);
    await expect(page.getByTestId("machine-detail")).toContainText("fix/pagination");
    await page.getByTestId("machines-search").fill("docs");
    await expect(page.getByTestId("machine-row")).toHaveCount(1);
    await expect(page.locator(".content select")).toHaveCount(0);

    await page.evaluate(() => { location.hash = "#/code-settings?v=repos"; });
    await expect(page.getByTestId("code-repo-row")).toContainText("atelier/cortex-web");
    await page.evaluate(() => { location.hash = "#/code-settings?v=approvals"; });
    await expect(page.getByTestId("code-default-model")).toHaveText("Code rapide");
    await expect(page.locator(".content select")).toHaveCount(0);
  } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});
