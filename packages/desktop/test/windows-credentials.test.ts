import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import childProcess from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileCredentials, type Cipher } from "../src/credentials";
import { windowsCredentials } from "../src/windows-credentials";

let dir: string;
let file: string;
const cipher: Cipher = {
  isEncryptionAvailable: () => false,
  encryptString: () => { throw new Error("must not encrypt legacy"); },
  decryptString: (value) => value.toString().slice("legacy:".length),
};
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-windows-credentials-"));
  file = path.join(dir, "credentials.json");
  vi.spyOn(process, "platform", "get").mockReturnValue("win32");
  vi.spyOn(process, "arch", "get").mockReturnValue("x64");
  vi.stubEnv("SystemRoot", "C:\\Windows");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("Windows credential pipe boundary", () => {
  it("uses the absolute system host with secret input only in stdin", () => {
    const spawn = vi.spyOn(childProcess, "spawnSync").mockReturnValue({ status: 0, signal: null, stdout: "YmxvYg==" } as ReturnType<typeof childProcess.spawnSync>);
    expect(windowsCredentials.protect("test-secret-ü")).toBe("YmxvYg==");
    const [exe, args, options] = spawn.mock.calls[0];
    expect(exe).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    expect(args?.slice(0, 4)).toEqual(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]);
    expect(JSON.stringify(args)).not.toContain("test-secret");
    expect(JSON.stringify(args)).not.toContain(Buffer.from("test-secret-ü").toString("base64"));
    expect(options).toMatchObject({ input: `protect\n${Buffer.from("test-secret-ü").toString("base64")}`, stdio: ["pipe", "pipe", "ignore"], maxBuffer: 2097152, timeout: 15000, windowsHide: true });
    expect(options).not.toHaveProperty("env");
    expect(windowsCredentials.unprotect("test-ciphertext")).toBe("blob");
    spawn.mockReturnValueOnce({ status: 0, signal: null, stdout: "OK" } as ReturnType<typeof childProcess.spawnSync>);
    windowsCredentials.restrict(file);
    expect(spawn.mock.calls[2][2]?.input).toBe(`acl\n${file}`);
  });

  it.each([
    { status: 1, signal: null, stdout: "private-output", stderr: "private-error" },
    { status: null, signal: "SIGTERM", stdout: "private-output" },
    { status: 0, signal: null, stdout: "private-output" },
    { status: 0, signal: null, stdout: "" },
    { status: 0, signal: null, stdout: "A".repeat(2097156) },
    { status: 0, signal: null, stdout: "YQ==", error: new Error("private-error") },
  ])("sanitizes child failure %#", (result) => {
    vi.spyOn(childProcess, "spawnSync").mockReturnValue(result as ReturnType<typeof childProcess.spawnSync>);
    try { windowsCredentials.protect("private-input"); throw new Error("expected refusal"); }
    catch (error) {
      expect(error).toEqual(new Error("Credential protection unavailable"));
      expect(error).not.toHaveProperty("cause");
      expect(JSON.stringify(error)).not.toContain("private");
    }
  });

  it("rejects oversized input, relative system root and wrong architecture before spawning", () => {
    const spawn = vi.spyOn(childProcess, "spawnSync");
    expect(() => windowsCredentials.protect("x".repeat(2097152))).toThrow("Credential protection unavailable");
    vi.stubEnv("SystemRoot", "Windows");
    expect(() => windowsCredentials.protect("test-key")).toThrow("Credential protection unavailable");
    vi.stubEnv("SystemRoot", "C:\\Windows");
    vi.spyOn(process, "arch", "get").mockReturnValue("ia32");
    expect(() => windowsCredentials.protect("test-key")).toThrow("Credential protection unavailable");
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe("Windows atomic credential storage", () => {
  beforeEach(() => {
    vi.spyOn(windowsCredentials, "protect").mockImplementation((value) => Buffer.from(`protected:${value}`).toString("base64"));
    vi.spyOn(windowsCredentials, "unprotect").mockImplementation((value) => Buffer.from(value, "base64").toString().slice("protected:".length));
    vi.spyOn(windowsCredentials, "restrict").mockImplementation((temp) => { expect(fs.statSync(temp).size).toBe(0); });
  });

  it.each(["credentials.json", "mcp-credentials.json"])("protects %s without safeStorage or plaintext fallback", (name) => {
    file = path.join(dir, name);
    const store = fileCredentials(file, cipher);
    const secret = JSON.stringify({ url: "https://example.test", headers: { Authorization: "test-secret-ü" } });
    store.set("owner", secret);
    const values = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(values.owner).toBe(`d:${Buffer.from(`protected:${secret}`).toString("base64")}`);
    expect(fileCredentials(file, cipher).get("owner")).toBe(secret);
    store.delete("owner");
    expect(store.get("owner")).toBeUndefined();
  });

  it.each(["e:", "p:"])("migrates a successfully read %s entry while preserving every other entry", (prefix) => {
    const legacy = prefix + Buffer.from(`${prefix === "e:" ? "legacy:" : ""}test-old`).toString("base64");
    fs.writeFileSync(file, JSON.stringify({ owner: legacy, other: "e:untouched" }));
    expect(fileCredentials(file, cipher).get("owner")).toBe("test-old");
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ owner: `d:${Buffer.from("protected:test-old").toString("base64")}`, other: "e:untouched" });
    expect(fs.readdirSync(dir)).toEqual(["credentials.json"]);
  });

  it.each(["decrypt", "protect", "acl", "write", "sync", "rename"])("preserves exact legacy bytes after %s failure", (stage) => {
    const before = '{ "owner": "e:bGVnYWN5OnRlc3Qtb2xk", "other": "p:dGVzdA==" }\n';
    fs.writeFileSync(file, before);
    const fail = () => { throw new Error("test failure"); };
    if (stage === "decrypt") vi.spyOn(cipher, "decryptString").mockImplementationOnce(fail);
    if (stage === "protect") vi.mocked(windowsCredentials.protect).mockImplementationOnce(fail);
    if (stage === "acl") vi.mocked(windowsCredentials.restrict).mockImplementationOnce(fail);
    if (stage === "write") {
      const write = fs.writeFileSync;
      vi.spyOn(fs, "writeFileSync").mockImplementationOnce((fd) => { write(fd, "partial"); fail(); });
    }
    if (stage === "sync") vi.spyOn(fs, "fsyncSync").mockImplementationOnce(fail);
    if (stage === "rename") vi.spyOn(fs, "renameSync").mockImplementationOnce(fail);
    expect(() => fileCredentials(file, cipher).get("owner")).toThrow("test failure");
    expect(fs.readFileSync(file, "utf8")).toBe(before);
    expect(fs.readdirSync(dir)).toEqual(["credentials.json"]);
    if (stage === "acl") expect(windowsCredentials.restrict).toHaveBeenCalledOnce();
  });

  it("restricts before writing and syncs before rename", () => {
    const order: string[] = [];
    const write = fs.writeFileSync; const sync = fs.fsyncSync; const rename = fs.renameSync;
    vi.mocked(windowsCredentials.restrict).mockImplementation((temp) => { expect(fs.statSync(temp).size).toBe(0); order.push("acl"); });
    vi.spyOn(fs, "writeFileSync").mockImplementation((...args) => { order.push("write"); return write(...args); });
    vi.spyOn(fs, "fsyncSync").mockImplementation((fd) => { order.push("sync"); return sync(fd); });
    vi.spyOn(fs, "renameSync").mockImplementation((...args) => { order.push("rename"); return rename(...args); });
    fileCredentials(file, cipher).set("owner", "test-key");
    expect(order).toEqual(["acl", "write", "sync", "rename"]);
  });

  it("preserves existing bytes when new protection is unavailable", () => {
    fs.writeFileSync(file, '{"other":"p:dGVzdA=="}');
    const before = fs.readFileSync(file);
    vi.mocked(windowsCredentials.protect).mockImplementationOnce(() => { throw new Error("Credential protection unavailable"); });
    expect(() => fileCredentials(file, cipher).set("owner", "test-key")).toThrow("Credential protection unavailable");
    expect(fs.readFileSync(file)).toEqual(before);
    expect(windowsCredentials.restrict).not.toHaveBeenCalled();
  });
});
