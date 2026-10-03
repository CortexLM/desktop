import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import type { ProviderConfig } from "@cortex/schema";
import { launch } from "./fixtures";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const ORIGINAL = "sk-test-original-1111", REPLACEMENT = "sk-test-replacement-2222";
type WireRequest = { method: string; url: string; headers: [string, string][]; body?: string };
type WireResponse = { status: number; headers: [string, string][]; body: string };
type RequestRecord = { method: string; path: string; status?: number; enabled?: boolean; responseFields?: string[] };
type Observation = { requests: RequestRecord[]; httpRequests: number };

async function observe(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }) => {
    const observation: Observation = { requests: [], httpRequests: 0 };
    (globalThis as unknown as { providerDraftObservation: Observation }).providerDraftObservation = observation;
    const fetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (/^https?:/.test(url)) observation.httpRequests++;
      return fetch(input, init);
    };
    const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (event: unknown, request: WireRequest) => Promise<WireResponse>> })._invokeHandlers.get("cortex:fetch")!;
    ipcMain.removeHandler("cortex:fetch");
    ipcMain.handle("cortex:fetch", async (event, request: WireRequest) => {
      const entry: RequestRecord = { method: request.method, path: new URL(request.url).pathname };
      if (entry.method === "PATCH" && entry.path === "/api/providers/fake") entry.enabled = JSON.parse(request.body!).enabled;
      observation.requests.push(entry);
      // Passive observation: forward every original request and response unchanged; retain no key bodies.
      const response = await original(event, request);
      entry.status = response.status;
      if (entry.path.startsWith("/api/providers/fake") && response.status === 200) entry.responseFields = Object.keys(JSON.parse(response.body)).sort();
      return response;
    });
  });
}

const observed = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { providerDraftObservation: Observation }).providerDraftObservation);
const config = (page: Page) => page.evaluate(async (): Promise<ProviderConfig> => {
  const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch("cortex://local/api/providers/fake");
  if (response.status !== 200) throw new Error(`Provider read failed: ${response.status}`);
  return response.json();
});

for (const theme of ["light", "dark"]) test(`provider availability preserves an unsaved replacement key — 960 ${theme}`, async () => {
  test.setTimeout(25_000);
  const { app, page } = await launch({ hash: `#/settings?section=providers&theme=${theme}`, locale: "en", env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`,
    CORTEX_TEST_PROVIDER_BASEURL: "",
  } });
  const stages: { stage: string; draftPreserved: boolean; draftEmpty: boolean; stored: ProviderConfig }[] = [];
  const preparations: { stage: string; refilled: boolean }[] = [];
  try {
    await observe(app);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.getByTestId("provider-search").fill("fake");
    await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
    const input = page.getByTestId("provider-key-input"), save = page.getByTestId("provider-key-save");
    const hint = page.locator("form").filter({ has: input }).locator(".sub");
    const enable = page.getByRole("switch", { name: "Enable", exact: true });
    await expect(input).toHaveAttribute("type", "password");
    await input.fill(ORIGINAL);
    await save.click();
    await expect(hint).toHaveText("Saved · 1111");
    await expect(input).toHaveValue("");
    await expect(enable).toBeChecked();
    await input.fill(REPLACEMENT);
    await page.evaluate(() => document.fonts.ready);

    for (const enabled of [false, true]) {
      const stage = enabled ? "after-enable" : "after-disable";
      if (enabled) {
        // Continue the independent second direction only after recording the first loss.
        const refilled = await input.inputValue() === "";
        preparations.push({ stage: "before-enable", refilled });
        if (refilled) await input.fill(REPLACEMENT);
      }
      await test.step(stage, async () => {
        await enable.click();
        await expect(enable).toBeChecked({ checked: enabled });
        await expect(hint).toHaveText("Saved · 1111");
        const stored = await config(page);
        expect(stored).toEqual({ providerID: "fake", enabled, hasKey: true, keyHint: "1111" });
        const value = await input.inputValue();
        stages.push({ stage, draftPreserved: value === REPLACEMENT, draftEmpty: value === "", stored });
        await expect(input).toHaveAttribute("type", "password");
        const text = await page.locator("body").innerText();
        expect(text.includes(ORIGINAL) || text.includes(REPLACEMENT)).toBe(false);
        if (!enabled) {
          await page.locator("main .content-top").hover();
          await expect(page.locator(".toast")).toHaveCount(0);
          await input.scrollIntoViewIfNeeded();
          const path = test.info().outputPath(`provider-draft-${theme}.png`);
          await page.screenshot({ path, animations: "disabled" });
          await test.info().attach(`provider-draft-${theme}`, { path, contentType: "image/png" });
        }
        expect.soft(value === REPLACEMENT, `${stage}: accepted preference PATCH preserves the unsaved replacement draft`).toBe(true);
      });
    }

    await test.step("explicit Save accepts the replacement and clears its draft", async () => {
      // Explicit setup after both preservation checks; the fixed app needs neither refill.
      const refilled = await input.inputValue() === "";
      preparations.push({ stage: "before-save", refilled });
      if (refilled) await input.fill(REPLACEMENT);
      await save.click();
      await expect(hint).toHaveText("Saved · 2222");
      await expect(input).toHaveValue("");
      const stored = await config(page);
      expect(stored).toEqual({ providerID: "fake", enabled: true, hasKey: true, keyHint: "2222" });
      stages.push({ stage: "after-save", draftPreserved: false, draftEmpty: await input.inputValue() === "", stored });
    });

    const wire = await observed(app);
    expect(wire.requests.filter((r) => r.method !== "GET")).toEqual([
      { method: "PUT", path: "/api/providers/fake/key", status: 200, responseFields: ["enabled", "hasKey", "keyHint", "providerID"] },
      { method: "PATCH", path: "/api/providers/fake", enabled: false, status: 200, responseFields: ["enabled", "hasKey", "keyHint", "providerID"] },
      { method: "PATCH", path: "/api/providers/fake", enabled: true, status: 200, responseFields: ["enabled", "hasKey", "keyHint", "providerID"] },
      { method: "PUT", path: "/api/providers/fake/key", status: 200, responseFields: ["enabled", "hasKey", "keyHint", "providerID"] },
    ]);
    expect(wire.requests.some((r) => /\/sessions\/[^/]+\/(prompt|message)/.test(r.path))).toBe(false);
    expect(wire.httpRequests).toBe(0);
  } finally {
    await test.info().attach(`provider-draft-observation-${theme}`, { body: JSON.stringify({ theme, stages, preparations, ...await observed(app) }, null, 2), contentType: "application/json" });
    await app.close();
  }
});
