// Capture an installed Mac app over an SSH-forwarded CDP port; pixels come from screencapture, not CDP.
// Acquire the shared Mac lease first. Launch Cortex with --remote-debugging-port=9444, forward it over SSH.
// Start capture-server.py through mac-computer, forward its port too.
// Usage: node scripts/mac/capture-connected.mjs mac-live http://127.0.0.1:19444 http://127.0.0.1:19445 /tmp/opencode/native-captures
/* global window, document, location */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const [host, endpoint, captureURL, out] = process.argv.slice(2);
assert(host && endpoint && captureURL && out, "SSH host, CDP URL, capture URL and local output directory required");
const ssh = (command) => execFileSync("ssh", ["-o", "BatchMode=yes", host, command], { encoding: "utf8", timeout: 30_000 });
const browser = await chromium.connectOverCDP(endpoint);
const page = browser.contexts()[0].pages().find((p) => p.url().startsWith("cortex://app/"));
assert(page, "Installed Cortex window required");
assert.equal(await page.evaluate(() => window.cortex.platform), "darwin");
const errors = [];
page.on("pageerror", (error) => errors.push({ url: page.url(), message: error.message }));
await page.goto("cortex://app/index.html#/gallery");
await page.waitForFunction(() => Array.isArray(window.__screens));
const screens = await page.evaluate(() => window.__screens);
const routes = screens.flatMap((s) => (s.variants?.length ? s.variants.map(([v]) => ({ id: s.id, v })) : [{ id: s.id, v: "" }]));
const wid = ssh(`swift -e 'import CoreGraphics; for w in CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]] where w["kCGWindowOwnerName"] as? String == "Cortex" && w["kCGWindowLayer"] as? Int == 0 { print(w["kCGWindowNumber"] as! Int); break }' 2>/dev/null`).trim();
assert(/^\d+$/.test(wid), "Native Cortex window ID required");
fs.mkdirSync(out, { recursive: true });
const captures = [];
for (const theme of ["light", "dark"]) {
  ssh(`osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === "dark"}'`);
  for (const { id, v } of routes) {
    const hash = `#/${id}?theme=${theme}&shot${v ? `&v=${v}` : ""}`;
    await page.goto(`cortex://app/index.html${hash}`);
    await page.waitForFunction(({ hash, theme }) => location.hash === hash && document.documentElement.dataset.theme === theme && !!document.querySelector("main.content")?.textContent.trim(), { hash, theme });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(450);
    const name = `${id}${v ? "~" + v : ""}-${theme}.png`;
    const response = await fetch(`${captureURL}/${wid}`, { method: "POST", signal: globalThis.AbortSignal.timeout(30_000) });
    assert(response.ok, `Native capture failed: ${name} (${response.status})`);
    fs.writeFileSync(`${out}/${name}`, Buffer.from(await response.arrayBuffer()));
    captures.push({ name, hash });
  }
}
const appSha256 = ssh("shasum -a 256 /Applications/Cortex.app/Contents/Resources/app.asar").split(/\s/)[0];
fs.mkdirSync("evidence/mac", { recursive: true });
fs.writeFileSync("evidence/mac/manifest.json", JSON.stringify({ timestamp: new Date().toISOString(), appSha256, nativeWindowID: Number(wid), count: captures.length, captures, errors }, null, 2) + "\n");
await browser.close();
assert.equal(errors.length, 0, "Native capture sweep had renderer errors");
console.log(`Captured ${captures.length} native windows; renderer errors: ${errors.length}`);
