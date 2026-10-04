import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import type { ProviderConfig } from "@cortex/schema";
import fs from "node:fs";
import { launch } from "./fixtures";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const ROUTE = "/api/providers/fake", KEY = `${ROUTE}/key`;
const A = "sk-test-pending-1111", B = "sk-test-pending-2222", C = "sk-test-pending-3333", D = "sk-test-pending-4444";
type RequestWire = { url: string; method: string; headers: [string, string][]; body?: string };
type ResponseWire = { status: number; headers: [string, string][]; body: string };
type Gate = { method?: string; held?: ResponseWire; delivered?: ResponseWire; release?: () => void; restore: () => void; writes: { method: string; response: ResponseWire }[] };
test.setTimeout(40_000);

async function config(page: Page): Promise<ProviderConfig> {
  return page.evaluate(async (route) => {
    const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${route}`);
    if (!response.ok) throw new Error(`Provider GET: ${response.status}`);
    return response.json();
  }, ROUTE);
}
const expected = (hint?: string) => ({ providerID: "fake", enabled: true, hasKey: !!hint, ...(hint ? { keyHint: hint } : {}) });
const release = (app: ElectronApplication) => app.evaluate(() => { const g = (globalThis as unknown as { keyGate?: Gate }).keyGate; if (g) { g.method = undefined; g.release?.(); g.release = undefined; } });
async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const theme of ["light", "dark"]) test(`Provider key Save and Remove preserve edits made while their real response is pending — ${theme}`, async () => {
  const { app, page, dataDir } = await launch({ hash: `#/settings?section=providers&theme=${theme}`, locale: "en", env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`, CORTEX_TEST_PROVIDER_BASEURL: "",
  } });
  const errors: string[] = [], rendererHttp: string[] = [], evidence: Record<string, unknown> = { theme };
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (/^https?:/.test(request.url())) rendererHttp.push(request.url()); });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.getByTestId("provider-search").fill("fake");
    await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
    const input = page.getByTestId("provider-key-input"), save = page.getByTestId("provider-key-save"), remove = page.getByRole("button", { name: "Remove", exact: true });
    const form = page.locator("form").filter({ has: input }), hint = form.locator(".sub");
    await app.evaluate(({ ipcMain }, route) => {
      const original = (ipcMain as unknown as { _invokeHandlers: Map<string, (e: unknown, r: RequestWire) => Promise<ResponseWire>> })._invokeHandlers.get("cortex:fetch")!;
      const gate: Gate = { writes: [], restore: () => { ipcMain.removeHandler("cortex:fetch"); ipcMain.handle("cortex:fetch", original); } };
      (globalThis as unknown as { keyGate: Gate }).keyGate = gate;
      ipcMain.removeHandler("cortex:fetch");
      ipcMain.handle("cortex:fetch", async (event, request: RequestWire) => {
        const write = new URL(request.url).pathname === route && ["PUT", "DELETE"].includes(request.method), hold = write && gate.method === request.method;
        if (hold) gate.method = undefined;
        const response = await original(event, request);
        if (write) gate.writes.push({ method: request.method, response }); // Response metadata only; no key request body.
        if (hold) {
          gate.held = structuredClone(response);
          await new Promise<void>((resolve) => { gate.release = resolve; });
          gate.delivered = structuredClone(response);
        }
        return response;
      });
    }, KEY);
    const arm = (method: string) => app.evaluate((method) => { const g = (globalThis as unknown as { keyGate: Gate }).keyGate; g.method = method; g.held = undefined; g.delivered = undefined; }, method);
    const held = () => app.evaluate(() => (globalThis as unknown as { keyGate: Gate }).keyGate.held);
    const delivered = () => app.evaluate(() => (globalThis as unknown as { keyGate: Gate }).keyGate.delivered);
    const settle = async () => { await config(page); await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))); };
    await expect(input).toHaveAttribute("type", "password");
    await input.fill(A); await save.click();
    await expect(input).toHaveValue(""); await expect(hint).toHaveText("Saved · 1111");
    expect(await config(page)).toEqual(expected("1111"));

    await arm("PUT"); await input.fill(B); await save.click();
    await expect.poll(held).toBeDefined();
    const put = (await held())!;
    expect(put.status).toBe(200); expect(JSON.parse(put.body)).toEqual(expected("2222"));
    await expect.poll(() => config(page)).toEqual(expected("2222"));
    await expect(hint).toHaveText("Saved · 1111");
    await expect(input).toBeEnabled(); await expect(save).toBeDisabled(); await expect(remove).toBeDisabled();
    await input.fill(C); await expect(input).toHaveValue(C); expect(await delivered()).toBeUndefined();
    evidence.putPending = { response: put, stored: await config(page), inputEnabled: await input.isEnabled(), newerDraftAccepted: true, returned: false };
    await release(app); await expect.poll(delivered).toEqual(put);
    await expect(hint).toHaveText("Saved · 2222"); await expect(remove).toBeEnabled(); await settle();
    evidence.putSettled = { stored: await config(page), responseUnchanged: true, newerDraftPreserved: (await input.inputValue()) === C, draftLength: (await input.inputValue()).length };
    expect.soft(await input.inputValue(), "Completed Save must preserve the newer unsaved key").toBe(C);
    await form.scrollIntoViewIfNeeded(); await capture(page, "after-put-release");

    // Explicit preparation after the recorded assertion; continue to the independent Remove race.
    if (await input.inputValue() !== C) await input.fill(C);
    await arm("DELETE"); await remove.click();
    await expect.poll(held).toBeDefined();
    const deleted = (await held())!;
    expect(deleted.status).toBe(200); expect(JSON.parse(deleted.body)).toEqual(expected());
    await expect.poll(() => config(page)).toEqual(expected());
    await expect(hint).toHaveText("Saved · 2222");
    await expect(input).toBeEnabled(); await expect(save).toBeDisabled(); await expect(remove).toBeDisabled();
    await input.fill(D); await expect(input).toHaveValue(D); expect(await delivered()).toBeUndefined();
    evidence.deletePending = { response: deleted, stored: await config(page), inputEnabled: await input.isEnabled(), newerDraftAccepted: true, returned: false };
    await release(app); await expect.poll(delivered).toEqual(deleted);
    await expect(hint).toHaveText("Stored on this device, never shown again"); await expect(remove).toHaveCount(0); await settle();
    evidence.deleteSettled = { stored: await config(page), responseUnchanged: true, newerDraftPreserved: (await input.inputValue()) === D, draftLength: (await input.inputValue()).length };
    expect.soft(await input.inputValue(), "Completed Remove must preserve the newer unsaved key").toBe(D);
    await form.scrollIntoViewIfNeeded(); await capture(page, "after-delete-release");

    // Preserve the negative result above, then exercise genuine final recovery in both implementations.
    if (await input.inputValue() !== D) await input.fill(D);
    await expect(save).toBeEnabled(); await save.click();
    await expect(input).toHaveValue(""); await expect(hint).toHaveText("Saved · 4444"); await expect(remove).toBeEnabled();
    const stored = await config(page);
    expect(stored).toEqual(expected("4444")); await expect(save).toBeDisabled();
    const writes = await app.evaluate(() => (globalThis as unknown as { keyGate: Gate }).keyGate.writes);
    expect(writes.map((w) => [w.method, w.response.status, JSON.parse(w.response.body)])).toEqual([
      ["PUT", 200, expected("1111")], ["PUT", 200, expected("2222")], ["DELETE", 200, expected()], ["PUT", 200, expected("4444")],
    ]);
    const configs = await page.evaluate(async () => (await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch("cortex://local/api/providers")).json()) as ProviderConfig[];
    expect(configs).toEqual([expected("4444")]);
    for (const fixture of [A, B, C, D]) expect(JSON.stringify({ stored, configs, writes })).not.toContain(fixture);
    evidence.recovery = { stored, configs, writes, unchangedDraftCleared: true };
    const oversized = "sk-test-invalid-".padEnd(4097, "x");
    await input.fill(oversized); await save.click();
    await expect.poll(() => app.evaluate(() => (globalThis as unknown as { keyGate: Gate }).keyGate.writes.length)).toBe(5);
    const refused = await app.evaluate(() => (globalThis as unknown as { keyGate: Gate }).keyGate.writes.at(-1)!);
    expect(refused.method).toBe("PUT"); expect(refused.response.status).toBe(400);
    expect(JSON.parse(refused.response.body)).toMatchObject({ error: { code: "invalid_request" } });
    await expect(save).toBeEnabled(); await expect(input).toHaveValue(oversized); await expect(hint).toHaveText("Saved · 4444");
    expect(await config(page)).toEqual(expected("4444")); expect(JSON.stringify(refused)).not.toContain(oversized);
    evidence.refusal = { response: refused.response, draftLength: (await input.inputValue()).length, draftUnchanged: true, stored: await config(page) };
    await input.fill("sk-test-ordinary-remove-5555"); await remove.click();
    await expect(input).toHaveValue(""); await expect(hint).toHaveText("Stored on this device, never shown again");
    await expect(remove).toHaveCount(0); await expect(save).toBeDisabled(); expect(await config(page)).toEqual(expected());
    const removed = await app.evaluate(() => { const g = (globalThis as unknown as { keyGate: Gate }).keyGate; return { count: g.writes.length, last: g.writes.at(-1)! }; });
    expect(removed).toEqual({ count: 6, last: { method: "DELETE", response: { status: 200, headers: deleted.headers, body: deleted.body } } });
    evidence.ordinaryRemove = { stored: await config(page), draftCleared: true, response: removed.last.response };
    expect(errors).toEqual([]); expect(rendererHttp).toEqual([]);
  } finally {
    try { await test.info().attach("provider-key-pending-evidence", { body: JSON.stringify({ ...evidence, errors, rendererHttp }, null, 2), contentType: "application/json" }); }
    finally {
      try { await release(app); }
      finally {
        try { await app.evaluate(() => (globalThis as unknown as { keyGate?: Gate }).keyGate?.restore()); }
        finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
      }
    }
  }
});
