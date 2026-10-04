import { test as base, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function launch(opts: { hash?: string; env?: Record<string, string>; locale?: string } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-e2e-"));
  const app = await electron.launch({
    args: [path.join(root, "packages/desktop/dist/main.cjs"), `--user-data-dir=${path.join(dataDir, "renderer")}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env: { ...process.env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: opts.hash ?? "", CORTEX_LOCALE: opts.locale ?? "en", ...opts.env } as Record<string, string>,
  });
  const startup: string[] = [];
  app.process().stderr?.on("data", (chunk: Buffer) => startup.push(chunk.toString()));
  try {
    const page = await app.firstWindow();
    page.on("pageerror", (error) => startup.push(`renderer: ${error.name}: ${error.message}`));
    await page.waitForFunction(() => "__bridgeFetch" in window, null, { timeout: 30_000 });
    if (opts.locale) await page.evaluate((l) => localStorage.setItem("cortex.locale", l), opts.locale);
    return { app, page, dataDir };
  } catch (error) {
    try {
      const windows = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((window) => ({
        url: window.webContents.getURL(), loading: window.webContents.isLoading(),
        crashed: window.webContents.isCrashed(), visible: window.isVisible(),
      })));
      await base.info().attach("startup-windows", { body: JSON.stringify(windows), contentType: "application/json" });
      await base.info().attach("startup-stderr", { body: startup.join(""), contentType: "text/plain" });
    } finally { await app.close(); }
    throw error;
  }
}

export const test = base.extend<{ app: ElectronApplication; page: Page }>({
  app: async ({}, use) => { const { app } = await launch(); await use(app); await app.close(); },
  page: async ({ app }, use) => { await use(await app.firstWindow()); },
});
export { expect } from "@playwright/test";
