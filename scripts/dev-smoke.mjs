import { _electron as electron } from "playwright";
const app = await electron.launch({ args: ["packages/desktop/dist/main.cjs", "--no-sandbox"], env: { ...process.env, CORTEX_DATA_DIR: "/tmp/opencode/g1/data", CORTEX_START_HASH: process.argv[2] ?? "" } });
const w = await app.firstWindow();
w.on("console", (m) => console.log("console:", m.type(), m.text()));
w.on("pageerror", (e) => console.log("pageerror:", e.message));
await w.waitForTimeout(2500);
await w.screenshot({ path: process.argv[3] ?? "/tmp/opencode/g1/smoke.png" });
console.log(await w.title(), await w.evaluate(() => document.body.innerText.slice(0, 300)));
await app.close();
