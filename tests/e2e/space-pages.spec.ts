import fs from "node:fs";
import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { launch } from "./fixtures";

type Wire = { url: string; method: string; body?: string };
const FILES = [{ id: "f1", filename: "Launch notes", created_at: "2026-10-07T09:00:00Z", byte_size: 120 }];

async function install(app: ElectronApplication, items: unknown[]) {
  await app.evaluate(({ ipcMain }, items) => {
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: Wire) => Promise<unknown>> })._invokeHandlers;
    const original = handlers.get("cortex:fetch")!;
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: Wire) => {
      const path = new URL(request.url).pathname;
      let body: unknown;
      if (path === "/api/connection") body = { mode: "cloud", signedIn: true };
      else if (path === "/api/code/models") body = { epoch: "e", models: [] };
      else if (path === "/api/code/contract") body = { data: JSON.parse(request.body ?? "{}").op === "app.library" ? { items } : { id: "f2", filename: "x", created_at: "2026-10-07T09:00:00Z", byte_size: 1 } };
      else return original(event, request);
      return { status: 200, headers: [["Content-Type", "application/json"]], body: JSON.stringify(body) };
    });
  }, items);
}
async function shot(page: Page, name: string) {
  const p = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path: p, animations: "disabled" });
  await test.info().attach(name, { path: p, contentType: "image/png" });
}

for (const theme of ["dark", "light"]) for (const [state, items] of [["empty", []], ["list", FILES]] as const) {
  test(`Space page form, validation and ${state} state — ${theme}`, async () => {
    const { app, page, dataDir } = await launch({ hash: `#/space?theme=${theme}`, locale: "en" });
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await install(app, [...items]);
      await page.evaluate(() => { location.hash = "#/home"; });
      await page.evaluate(() => { location.hash = "#/space"; });
      const create = page.getByTestId("space-create");
      await expect(create).toBeDisabled();
      await expect(page.getByLabel("Title")).toBeVisible();
      await expect(page.locator("details, select")).toHaveCount(0);
      if (state === "empty") await expect(page.getByTestId("live-empty")).toContainText("No pages yet");
      else await expect(page.getByTestId("space-row")).toContainText("Launch notes");
      await page.getByTestId("space-text").focus();
      await page.getByTestId("space-text").blur();
      await expect(page.getByTestId("space-text-error")).toBeVisible();
      await page.getByTestId("space-text").fill("Hello");
      await expect(create).toBeEnabled();
      await expect(page.getByTestId("space-text-error")).toHaveCount(0);
      await page.getByTestId("space-text").fill("");
      await shot(page, `space-${state}-${theme}`);
    } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
  });
}
