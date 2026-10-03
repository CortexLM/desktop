import { test, expect, type Page } from "@playwright/test";
import type { Permission, Session } from "@cortex/schema";
import { launch } from "./fixtures";
import { fakeOpenAI, toolCall } from "../../packages/core/test/helpers";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

async function call<T>(page: Page, path: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ path, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${path}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
    return r.status === 204 ? null : r.json();
  }, { path, method, body });
}

for (const theme of ["light", "dark"]) test(`Approvals list refusal stays unresolved until Retry succeeds — ${theme}`, async () => {
  const fake = await fakeOpenAI([{ deltas: [toolCall("held", "bash", { command: "echo approval" })], finish: "tool_calls" }]);
  const { app, page, dataDir } = await launch({ hash: `#/home?theme=${theme}`, env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`,
    CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`,
  } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const session = await call<Session>(page, "/api/sessions", "POST", { kind: "code", directory: dataDir, model: { providerID: "fake", modelID: "reasoner" } });
    await call(page, `/api/sessions/${session.id}/prompt`, "POST", { parts: [{ type: "text", text: "Run the command" }] });
    await expect.poll(async () => (await call<Permission[]>(page, "/api/permissions")).length).toBe(1);
    await page.evaluate(() => {
      const RequestOriginal = Request;
      const w = window as unknown as { refuseApprovalList: boolean };
      w.refuseApprovalList = true;
      // A missing real route refuses the list; engine responses and writes are not stubbed.
      window.Request = class extends RequestOriginal {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          const request = new RequestOriginal(input, init), url = new URL(request.url);
          const refuse = w.refuseApprovalList && request.method === "GET" && url.pathname === "/api/permissions";
          url.pathname += "/missing-list";
          super(refuse ? url.href : request);
        }
      };
      history.pushState(null, "", location.hash.replace("/home", "/approvals"));
    });
    await expect(page.getByRole("heading", { name: "Couldn’t load this", exact: true })).toBeVisible();
    await expect(page.getByText("Nothing to approve", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("approval-allow")).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Try again", exact: true });
    await expect(retry).toBeInViewport({ ratio: 1 });
    await retry.click({ trial: true });
    const shot = test.info().outputPath(`approvals-list-refused-${theme}.png`);
    await page.screenshot({ path: shot, animations: "disabled" });
    await test.info().attach(`approvals-list-refused-${theme}`, { path: shot, contentType: "image/png" });
    await page.evaluate(() => { (window as unknown as { refuseApprovalList: boolean }).refuseApprovalList = false; });
    expect(await call<Permission[]>(page, "/api/permissions")).toHaveLength(1);
    await retry.click();
    await expect(page.getByTestId("approval-allow")).toBeVisible();
    await expect(page.getByText("Nothing to approve", { exact: true })).toHaveCount(0);
    await call(page, `/api/sessions/${session.id}/abort`, "POST");
    expect(await call<Permission[]>(page, "/api/permissions")).toEqual([]);
    await expect(page.getByText("Nothing to approve", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); }
});
