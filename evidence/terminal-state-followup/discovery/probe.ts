// Offline inspection: existing built renderer + in-memory real core/protocol; no listening server.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

const repo = "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite";
const out = "/tmp/opencode/transcript-next-review";
const { createCore, memoryCredentials } = await import(`${repo}/packages/core/src/index.ts`);
const { createServer } = await import(`${repo}/packages/server/src/index.ts`);
const { chromium } = await import(`${repo}/node_modules/playwright/index.mjs`);
const sha = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const manifestPath = "evidence/live-state-followup/integrated/build-final.json";
const manifest = JSON.parse(readFileSync(`${repo}/${manifestPath}`, "utf8"));
const verifyBuild = () => manifest.members.map((row: { path: string; sha256: string }) => {
  const actual = sha(readFileSync(`${repo}/${row.path}`)); assert.equal(actual, row.sha256, row.path);
  return { ...row, actual };
});
const sourcePaths = ["packages/app/src/screens/chat/live-chat.tsx", "packages/app/src/screens/code/code.tsx", "packages/app/src/screens/work/home.tsx", "packages/app/src/state/live.ts", "packages/core/src/session.ts"];
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
const revision = "760c4a046ce454bc8b0ab2fd85c941fec321c3ea";
const source = sourcePaths.map((path) => {
  const bytes = readFileSync(`${repo}/${path}`);
  assert(bytes.equals(execFileSync("git", ["show", `${revision}:${path}`], { cwd: repo })));
  return { path, sha256: sha(bytes) };
});
const before = verifyBuild();
mkdirSync(`${out}/browser-tmp`, { recursive: true });
const providerCalls: string[] = [], events: unknown[] = [], requests: unknown[] = [], blocked: string[] = [];
const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), fetch: async (input: Request | string | URL) => {
  const url = input instanceof Request ? input.url : String(input);
  assert.equal(url, "https://provider.invalid/v1/chat/completions");
  providerCalls.push(url);
  return new Response(JSON.stringify({ error: { message: "Controlled provider refusal", type: "invalid_request_error" } }), { status: 401, headers: { "content-type": "application/json" } });
} });
const catalog = JSON.parse(readFileSync(`${repo}/packages/core/test/fixtures/catalog.json`, "utf8"));
catalog.fake.api = "https://provider.invalid/v1"; core.catalog.set(catalog);
const off = core.bus.subscribe((event: unknown) => events.push(event));
const api = createServer(core);
const call = async (path: string, method = "GET", body?: unknown) => {
  const response = await api.fetch(new Request(`http://transcript.invalid${path}`, { method,
    headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const data = await response.json(); return { status: response.status, data };
};
let browser;
const result: Record<string, unknown> = { revision, head, source, beforeMembers: before.length, beforeAllMatch: true,
  transport: "Browser requests intercepted before network; real app.fetch for API; initial real SSE greeting read then cancelled. Reload-only evidence, not live-stream proof." };
try {
  await call("/api/providers/fake/key", "PUT", { key: "sk-test-transcript-review" });
  const model = { providerID: "fake", modelID: "reasoner" };
  const chat = await call("/api/sessions", "POST", { kind: "chat", title: "Deleted review Chat", model });
  assert.equal(chat.status, 201);
  const chatID = chat.data.id;
  await call(`/api/sessions/${chatID}`, "DELETE");
  result.deletedGet = await call(`/api/sessions/${chatID}`);
  assert.equal((result.deletedGet as { status: number }).status, 404);
  const code = await call("/api/sessions", "POST", { kind: "code", title: "Failed review Code", directory: out, model });
  assert.equal(code.status, 201);
  const codeID = code.data.id;
  const pending = await core.sessions.prompt(codeID, { parts: [{ type: "text", text: "Return a controlled refusal" }] });
  await pending.done;
  const history = core.sessions.messages(codeID);
  assert.equal(history.at(-1)?.info.error?.code, "provider_auth_failed");
  result.codeHistory = history;
  result.codeStatuses = events.filter((event: any) => event.type === "session.status" && event.properties.sessionID === codeID);
  browser = await chromium.launch({ env: { ...process.env, TMPDIR: `${out}/browser-tmp` } });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 640 }, locale: "en-US", reducedMotion: "reduce" });
  await ctx.addInitScript(() => localStorage.setItem("cortex.locale", "en"));
  await ctx.route("**/*", async (route: any) => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== "http://transcript.invalid") { blocked.push(req.url()); return route.abort("blockedbyclient"); }
    if (url.pathname.startsWith("/api/")) {
      const response = await api.fetch(new Request(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined }));
      requests.push({ method: req.method(), path: url.pathname, status: response.status });
      if (url.pathname === "/api/events") {
        const reader = response.body!.getReader(), initial = await reader.read(); await reader.cancel();
        return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(initial.value!) });
      }
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    }
    const dist = `${repo}/packages/app/dist`, file = resolve(dist, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    assert(file.startsWith(dist + sep));
    await route.fulfill({ path: file });
  });
  const page = await ctx.newPage(), pageErrors: string[] = [];
  page.on("pageerror", (error: Error) => pageErrors.push(error.message));
  await page.goto(`http://transcript.invalid/#/chat?id=${chatID}&theme=light`);
  await page.locator('.thread [role="alert"]').waitFor();
  result.deletedChat = { alert: await page.locator('.thread [role="alert"]').innerText(), users: await page.locator('.thread .msg-user').count(), composerMounted: await page.getByTestId("composer-input").count() };
  assert((result.deletedChat as { alert: string }).alert.includes("Your message is kept. Try again in a moment."));
  await page.screenshot({ path: `${out}/deleted-chat.png`, animations: "disabled" });
  await page.goto(`http://transcript.invalid/#/code-session?id=${codeID}&theme=light`);
  await page.locator('.code-banner').waitFor();
  const sample = async () => ({ badge: await page.locator('.content-top .badge').innerText(), badgeClass: await page.locator('.content-top .badge').getAttribute("class"), error: await page.locator('.code-banner').innerText() });
  result.codeInitial = await sample(); assert.equal((result.codeInitial as { badge: string }).badge, "Ready");
  await page.reload(); await page.locator('.code-banner').waitFor(); result.codeReload = await sample();
  assert.equal((result.codeReload as { badge: string }).badge, "Ready");
  await page.screenshot({ path: `${out}/failed-code-reloaded.png`, animations: "disabled" });
  assert.deepEqual(core.sessions.messages(codeID), history);
  result.pageErrors = pageErrors; assert.deepEqual(pageErrors, []); assert.deepEqual(blocked, []);
  result.afterMembers = verifyBuild().length; result.afterAllMatch = true;
  result.confirmed = ["Deleted Chat displays retryable retained-message copy on actual not_found", "Persisted failed Code displays Ready badge and failure banner together after reload"];
} catch (error) { result.failure = String(error); process.exitCode = 1; }
finally {
  await browser?.close(); off(); await core.close();
  result.providerCalls = providerCalls; result.apiRequests = requests; result.blockedExternalRequests = blocked;
  result.cleanup = "Browser closed; in-memory core closed; no listening server created.";
  writeFileSync(`${out}/receipt.json`, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ ...result, source: undefined, apiRequests: undefined, codeHistory: undefined }, null, 2));
}
