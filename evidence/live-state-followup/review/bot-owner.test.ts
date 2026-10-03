import { writeFileSync } from "node:fs";
import { expect, it } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/dist/index.js";
import { chromium } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/playwright/index.mjs";
import { createServer as createViteServer } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vite/dist/node/index.js";
import react from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/@vitejs/plugin-react/dist/index.js";
import { fakeOpenAI, testCore } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/core/test/helpers.ts";
import { createServer, listen } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/server/src/index.ts";

const root = "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite";
const out = "/tmp/opencode/live-state-review";
const tick = async (page: import("playwright").Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const stage = (name: string) => console.log(`stage: ${name}`);

it("the Bot route owner must replace a locally selected session before reading or sending", async () => {
  const provider = await fakeOpenAI(["Beta answer", "Alpha answer", "Follow-up answer"].map((content) => ({ deltas: [{ content }], finish: "stop" })));
  const core = testCore(provider.url);
  const model = { providerID: "fake", modelID: "reasoner" };
  const alpha = core.bots.create({ name: "Review Alpha", persona: "Alpha", model });
  const beta = core.bots.create({ name: "Review Beta", persona: "Beta", model });
  const betaSession = core.sessions.create({ kind: "bot", botID: beta.id, model });
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const route = `/api/bots/${beta.id}/sessions`;
  const app = createServer(core);
  let armed = true, returned = false, held = false;
  const api = await listen({ fetch: async (request) => {
    const response = await app.fetch(request);
    if (armed && new URL(request.url).pathname === route) { armed = false; held = true; stage("beta history held"); await blocked; returned = true; }
    return response;
  } });
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    stage("seeding beta");
    await core.sessions.promptAndWait(betaSession.id, { parts: [{ type: "text", text: "Beta saved request" }] });
    stage("beta persisted; starting isolated Vite");
    vite = await createViteServer({
      root: `${root}/packages/app`, configFile: false, envFile: false, cacheDir: `${out}/vite-cache`,
      plugins: [react()], logLevel: "error", server: { host: "127.0.0.1", port: 0, proxy: { "/api": api.url } },
    });
    await vite.listen();
    stage("isolated Vite ready");
    const port = (vite.httpServer!.address() as { port: number }).port;
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
    await page.addInitScript(() => localStorage.setItem("cortex.locale", "en"));
    await page.goto(`http://127.0.0.1:${port}/#/bot?id=${alpha.id}&theme=light`, { waitUntil: "domcontentloaded", timeout: 8000 });
    stage("page loaded");
    await expect.poll(() => page.locator(".content-top .title").textContent()).toBe(alpha.name);
    await expect.poll(() => page.getByTestId("composer-input").count()).toBe(1);
    await page.getByTestId("composer-input").fill("Alpha first request");
    await page.getByTestId("composer-send").click();
    stage("alpha prompt clicked");
    await expect.poll(() => page.locator(".thread-inner .msg-user").allTextContents()).toEqual(["Alpha first request"]);
    const alphaSession = core.sessions.list({ botID: alpha.id })[0]!;
    await expect.poll(() => core.sessions.isBusy(alphaSession.id)).toBe(false);
    await page.locator("button.roster-item").filter({ hasText: beta.name }).click();
    stage("beta navigation clicked");
    await expect.poll(() => held).toBe(true);
    await expect.poll(() => page.locator(".content-top .title").textContent()).toBe(beta.name);
    await tick(page);
    const whileHeld = { title: await page.locator(".content-top .title").textContent(), users: await page.locator(".thread-inner .msg-user").allTextContents(), returned };
    release();
    await expect.poll(() => returned).toBe(true);
    await page.evaluate(() => fetch("/api/health"));
    await tick(page);
    const afterRelease = { title: await page.locator(".content-top .title").textContent(), users: await page.locator(".thread-inner .msg-user").allTextContents() };
    await page.screenshot({ path: `${out}/bot-wrong-owner.png`, animations: "disabled" });
    await page.getByTestId("composer-input").fill("Intended for Beta after navigation");
    await page.getByTestId("composer-send").click();
    await expect.poll(() => provider.requests.length).toBe(3);
    await expect.poll(() => core.sessions.isBusy(alphaSession.id) || core.sessions.isBusy(betaSession.id)).toBe(false);
    const users = (id: string) => core.sessions.messages(id).filter((message) => message.info.role === "user").flatMap((message) => message.parts.filter((part) => part.type === "text").map((part) => part.text));
    const observation = { node: process.version, transport: "real browser HTTP; real core/session/storage; fixture provider only", alpha: { botID: alpha.id, sessionID: alphaSession.id, users: users(alphaSession.id) }, beta: { botID: beta.id, sessionID: betaSession.id, users: users(betaSession.id) }, whileHeld, afterRelease, errors };
    writeFileSync(`${out}/bot-owner-observation.json`, JSON.stringify(observation, null, 2) + "\n");
    console.log(JSON.stringify(observation));
    expect(errors).toEqual([]);
    expect.soft(whileHeld.users).not.toContain("Alpha first request");
    expect.soft(afterRelease.users).toEqual(["Beta saved request"]);
    expect.soft(users(betaSession.id)).toContain("Intended for Beta after navigation");
    expect.soft(users(alphaSession.id)).not.toContain("Intended for Beta after navigation");
  } finally {
    release();
    await browser?.close();
    await vite?.close();
    await api.close();
    await core.close();
    await provider.close();
  }
});
