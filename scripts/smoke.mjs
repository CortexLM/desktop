// Packaged-app smoke test: launch the built binary, wait for its window over CDP, check it stays up, screenshot it.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const os = process.argv[2] ?? process.platform;
const dist = path.resolve("dist");
const find = () => {
  if (os === "mac") { const d = fs.readdirSync(dist).find((x) => x.startsWith("mac")); return path.join(dist, d, "Cortex.app/Contents/MacOS/Cortex"); }
  if (os === "linux") return path.join(dist, "linux-unpacked", "cortex-desktop");
  return path.join(dist, "win-unpacked", "Cortex.exe");
};
const bin = find();
fs.mkdirSync("out", { recursive: true });
const log = fs.openSync("out/smoke.log", "w");
const child = spawn(bin, ["--remote-debugging-port=9333", ...(os === "linux" ? ["--no-sandbox"] : [])], { stdio: ["ignore", log, log], env: { ...process.env, CORTEX_DATA_DIR: path.resolve("out/smoke-data") } });
const fail = (m) => { console.error("SMOKE FAIL:", m); child.kill(); process.exit(1); };
let page;
for (let i = 0; i < 60 && !page; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try { page = (await (await fetch("http://127.0.0.1:9333/json")).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
}
if (!page) fail("no window after 60s");
console.log("window:", page.title, page.url);
await new Promise((r) => setTimeout(r, 10000));
if (child.exitCode !== null) fail(`process exited with ${child.exitCode}`);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
const call = (method, params = {}) => new Promise((r) => { const id = Math.floor(Math.random() * 1e9); ws.addEventListener("message", function h(e) { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener("message", h); r(m.result); } }); ws.send(JSON.stringify({ id, method, params })); });
const text = await call("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
const shot = await call("Page.captureScreenshot", { format: "png" });
fs.writeFileSync("out/smoke-renderer.png", Buffer.from(shot.data, "base64"));
if (os === "mac") { try { execFileSync("screencapture", ["-x", "out/smoke-screen.png"]); } catch (e) { console.log("screencapture failed:", e.message); } }
const body = text?.result?.value ?? "";
console.log("renderer text:", body.slice(0, 200).replace(/\n/g, " | "));
if (!/Cortex/.test(body)) fail("renderer did not render the shell");
child.kill();
console.log("SMOKE OK");
