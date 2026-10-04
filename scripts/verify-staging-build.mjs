// Local artifact check: read main-owned auth state without issuing backend requests.
import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const origin = process.env.CORTEX_STAGING_API_ORIGIN;
assert.ok(origin, "Expected compiled staging origin is required");
const data = await mkdtemp(path.join(os.tmpdir(), "cortex-staging-check-"));
let app;
try {
  app = await electron.launch({
    ...(process.env.CORTEX_STAGING_EXECUTABLE ? { executablePath: path.resolve(process.env.CORTEX_STAGING_EXECUTABLE) } : {}),
    args: [...(process.env.CORTEX_STAGING_EXECUTABLE ? [] : [path.resolve("packages/desktop/dist/main.cjs")]), ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env: { ...process.env, APPDATA: data, XDG_CONFIG_HOME: data, CORTEX_DATA_DIR: path.join(data, "engine"), CORTEX_STAGING_API_ORIGIN: "https://runtime-must-not-win.example.test" },
  });
  const userData = await app.evaluate(({ app }) => app.getPath("userData"));
  assert.equal(path.basename(userData), "Cortex-staging");
  const page = await app.firstWindow();
  await page.waitForFunction(() => "__bridgeFetch" in globalThis);
  const state = await page.evaluate(async () => {
    const call = async (route, method = "GET", body) => {
      const response = await globalThis.__bridgeFetch(`cortex://local${route}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (!response.ok) throw new Error(`Staging IPC check failed: ${response.status}`);
      return response.json();
    };
    await call("/api/connection", "PUT", { mode: "cloud", signedIn: false });
    return call("/api/connection/auth");
  });
  assert.equal(state.owner.origin, origin);
  assert.equal(state.signedIn, false);
  console.log("STAGING BUILD OK: isolated profile and main-only compiled origin");
} finally {
  await app?.close();
  await rm(data, { recursive: true, force: true });
}
