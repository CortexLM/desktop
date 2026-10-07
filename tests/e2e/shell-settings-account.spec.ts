import { test, expect, type ElectronApplication } from "@playwright/test";
import fs from "node:fs";
import { launch } from "./fixtures";
import shellFr from "../../packages/i18n/locales/fr/shell.json" with { type: "json" };
import systemFr from "../../packages/i18n/locales/fr/system.json" with { type: "json" };
import systemEn from "../../packages/i18n/locales/en/system.json" with { type: "json" };
import liveEn from "../../packages/i18n/locales/en/live.json" with { type: "json" };

type Wire = { url: string; method: string; body?: string };
const botID = "00000000-0000-4000-8000-000000000001";
// Stubs only the signed-in account reads; every other request reaches the real engine in main.
async function signedIn(app: ElectronApplication, mode: "cloud" | "selfhost") {
  await app.evaluate(({ ipcMain }, { mode, botID }) => {
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<unknown>> })._invokeHandlers;
    const original = handlers.get("cortex:fetch")!;
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname;
      let body: unknown;
      if (path === "/api/connection") body = { mode, signedIn: true, ...(mode === "selfhost" ? { url: "https://cortex.example.test" } : {}) };
      else if (path === "/api/connection/auth") body = { status: "signed_in", signedIn: true, email: "camille.laurent@example.test", owner: { origin: "https://cortex.example.test", revision: "00000000-0000-4000-8000-000000000002" } };
      else if (path === "/api/code/models") body = { epoch: "e1", models: [] };
      else if (path === "/api/remote/sessions") body = [];
      else if (path === "/api/work-bot") body = { epoch: "e1", bots: [{ id: botID, name: "Nova", description: "", label: "Sorts your email", look: "meadow", shape: "dots", lead_id: null, notifications: true, status: "idle", computer_kind: "none", updated_at: "2026-10-07T00:00:00Z" }] };
      else if (path === "/api/code/contract") {
        const { op } = JSON.parse(request.body ?? "{}") as { op: string };
        const data = op === "app.me" ? { email: "camille.laurent@example.test", display_name: "Camille Laurent", plan_slug: "free", is_guest: false, quotas: [] }
          : op === "app.models" ? { items: [{ slug: "cortex-1-mini", display_name: "Cortex 1 Mini", context_tokens: 262144, supports_reasoning: true, supports_tools: true, supports_vision: false, is_preview: false }] }
          : op === "app.registry.models" ? { items: [] } : null;
        body = { status: 200, data };
      } else return original(event, request);
      return { status: 200, headers: [["Content-Type", "application/json"]], body: JSON.stringify(body) };
    });
  }, { mode, botID });
}

test("signed-in Profile shows the account from /v1/me, never the signed-out invitation", async () => {
  const { app, page, dataDir } = await launch({ locale: "en" });
  try {
    await signedIn(app, "cloud");
    await page.evaluate(() => { location.hash = "#/profile"; });
    await expect(page.getByTestId("profile-name")).toHaveText("Camille Laurent");
    await expect(page.getByTestId("profile-email")).toContainText("camille.laurent@example.test");
    await expect(page.getByTestId("profile-plan")).toHaveText("Cortex Free");
    await expect(page.getByText(systemEn["profile.signedOutTitle"])).toHaveCount(0);
    await expect(page.getByTestId("rail-avatar")).toHaveText("CL");
  } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("Settings lists Models, Organization and Approvals and hides Providers for Cortex Cloud", async () => {
  const { app, page, dataDir } = await launch({ locale: "en" });
  try {
    await signedIn(app, "cloud");
    await page.evaluate(() => { location.hash = "#/settings?section=providers"; });
    await expect(page.getByTestId("settings-link-models")).toBeVisible();
    await expect(page.getByTestId("settings-link-settings-organisation")).toHaveText(systemEn["settings.link.organisation"]);
    await expect(page.getByTestId("settings-link-settings-approvals")).toHaveText(systemEn["settings.link.approvals"]);
    await expect(page.getByTestId("settings-nav-providers")).toHaveCount(0);
    await expect(page.locator(".pg-panel .page-title")).toHaveText(systemEn["settings.sec.general"]);
    await page.getByTestId("settings-link-models").click();
    const row = page.getByTestId("model-row");
    await expect(row.locator(".ttl")).toHaveText("Cortex 1 Mini");
    await expect(row).not.toContainText("cortex-1-mini");
    await expect(row.getByTestId("model-context")).toHaveText(liveEn["models.pages_other"].replace("{pages}", "520"));
  } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("self-hosted Settings keeps Providers", async () => {
  const { app, page, dataDir } = await launch({ locale: "en" });
  try {
    await signedIn(app, "selfhost");
    await page.evaluate(() => { location.hash = "#/settings"; });
    await expect(page.getByTestId("settings-link-models")).toBeVisible();
    await expect(page.getByTestId("settings-nav-providers")).toBeVisible();
  } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("French is the default, the sidebar has the Workspace group, the Bot shortcut and one Recents list", async () => {
  // Unsupported system language and no saved choice: the app falls back to the design's French.
  const { app, page, dataDir } = await launch({ env: { CORTEX_LOCALE: "" } });
  try {
    await signedIn(app, "cloud");
    await page.evaluate(() => { location.hash = "#/home"; });
    await expect(page.locator("html")).toHaveAttribute("lang", /^(fr|es|de|ja|zh-Hans|pt-BR|ko)$/);
    const lang = await page.locator("html").getAttribute("lang");
    test.skip(lang !== "fr", `host system language ${lang} is supported, so it wins over the French default`);
    const workspace = page.getByTestId("sidebar-workspace");
    await expect(workspace).toContainText(shellFr["nav.workspace"]);
    for (const k of ["nav.space", "nav.scheduled", "nav.planning", "nav.browser", "nav.plugins"] as const) await expect(workspace.getByRole("button", { name: shellFr[k], exact: true })).toBeVisible();
    await expect(page.locator(".sidebar").getByRole("button", { name: /Nova/ })).toBeVisible();
    await expect(page.locator(".sidebar").getByText(shellFr["nav.noChats"])).toHaveCount(1);
    await expect(page.locator(".sidebar .sb-group")).toHaveCount(5);
    await workspace.getByRole("button", { name: shellFr["nav.scheduled"], exact: true }).click();
    await expect(page).toHaveURL(/#\/scheduled/);
    await page.evaluate(() => { location.hash = "#/settings"; });
    await expect(page.getByTestId("settings-link-models")).toHaveText(systemFr["settings.link.models"]);
  } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});
