// Native Windows abrupt-process regression; fixture values are generated, never logged.
import { fileCredentials } from "../packages/desktop/src/credentials";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fork, execFileSync } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";

const cipher = { isEncryptionAvailable: () => false, encryptString: () => { throw new Error("Legacy cipher must not be used"); }, decryptString: () => { throw new Error("Legacy cipher must not be used"); } };
if (process.argv[2] === "child") {
  process.on("message", ({ file, value }: { file: string; value: string }) => {
    fileCredentials(file, cipher).set("fixture", value);
    process.send?.("saved");
  });
} else {
  assert.equal(process.platform, "win32");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-dpapi-crash-"));
  const file = path.join(dir, "credentials.json"), value = randomBytes(32).toString("hex");
  const child = fork(process.argv[1], ["child"], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  try {
    const saved = once(child, "message", { signal: AbortSignal.timeout(30000) });
    child.send({ file, value });
    assert.equal((await saved)[0], "saved");
    const exited = once(child, "exit", { signal: AbortSignal.timeout(10000) });
    execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    await exited;
    const bytes = fs.readFileSync(file);
    assert.ok(!bytes.includes(value));
    assert.ok(JSON.parse(bytes.toString()).fixture.startsWith("d:"));
    assert.equal(fileCredentials(file, cipher).get("fixture"), value);
    console.log("PASS: Windows CurrentUser DPAPI survives abrupt writer termination; no plaintext in store");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
