import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileCredentials, type Cipher } from "../src/credentials";

const windowsHost = process.platform === "win32";
let dir: string; let file: string; let cipher: Cipher;
let credentials: ReturnType<typeof fileCredentials>;
beforeEach(() => {
  // Exercise the unchanged non-Windows format; Windows uses its own boundary suite.
  vi.spyOn(process, "platform", "get").mockReturnValue("linux");
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-credentials-"));
  file = path.join(dir, "credentials.json");
  cipher = {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(`test-cipher:${s}`),
    decryptString: (b) => b.toString().slice("test-cipher:".length),
  };
  credentials = fileCredentials(file, cipher);
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("file credentials", () => {
  it("requires native encryption for persistent session material without plaintext fallback", () => {
    credentials = fileCredentials(file, cipher, true);
    credentials.set("remote-session", "fixture-pair");
    expect(fileCredentials(file, cipher, true).get("remote-session")).toBe("fixture-pair");
    vi.spyOn(cipher, "isEncryptionAvailable").mockReturnValue(false);
    expect(() => credentials.get("remote-session")).toThrow("Credential protection unavailable");
    expect(() => credentials.set("remote-session", "replacement")).toThrow("Credential protection unavailable");
    credentials.delete("remote-session");
    expect(credentials.get("remote-session")).toBeUndefined();
  });
  it("treats a missing file as empty and creates its parent on first write", () => {
    file = path.join(dir, "nested", "credentials.json");
    credentials = fileCredentials(file, cipher);
    expect(credentials.get("provider")).toBeUndefined();
    expect(fs.existsSync(path.dirname(file))).toBe(false);
    expect(credentials.set("provider", "test-key")).toBeUndefined();
    expect(credentials.get("provider")).toBe("test-key");
    if (!windowsHost) expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it.each(["{", "null", "[]", '"invalid"', "1", "true", '{"other":false}', '{"other":null}', '{"other":{}}'])("rejects an invalid store without replacing it (%#)", (source) => {
    fs.writeFileSync(file, source);
    for (const operation of [() => credentials.get("provider"), () => credentials.set("provider", "test-key"), () => credentials.delete("provider")]) {
      expect(operation).toThrow("Invalid credential store");
      expect(fs.readFileSync(file, "utf8")).toBe(source);
    }
  });

  it.each(["EACCES", "EIO"])("propagates %s rather than replacing an unreadable store", (code) => {
    credentials.set("provider", "test-key");
    const before = fs.readFileSync(file, "utf8");
    const failure = Object.assign(new Error("test read failure"), { code });
    const read = vi.spyOn(fs, "readFileSync");
    for (const operation of [() => credentials.get("provider"), () => credentials.set("other", "test-new"), () => credentials.delete("provider")]) {
      read.mockImplementationOnce(() => { throw failure; });
      expect(operation).toThrow(failure);
    }
    expect(fs.readFileSync(file, "utf8")).toBe(before);
  });

  it.each([true, false])("round-trips, updates and deletes provider keys with encryption=%s", (encrypted) => {
    vi.spyOn(cipher, "isEncryptionAvailable").mockReturnValue(encrypted);
    credentials.set("provider", "test-key-ü");
    credentials.set("other", "test-other");
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(saved.provider).toBe(`${encrypted ? "e:" : "p:"}${Buffer.from(`${encrypted ? "test-cipher:" : ""}test-key-ü`).toString("base64")}`);
    credentials = fileCredentials(file, cipher);
    expect(credentials.get("provider")).toBe("test-key-ü");
    credentials.set("provider", "test-updated");
    expect(credentials.get("provider")).toBe("test-updated");
    expect(credentials.delete("provider")).toBeUndefined();
    expect(credentials.get("provider")).toBeUndefined();
    expect(credentials.get("other")).toBe("test-other");
    expect(fs.readdirSync(dir)).toEqual(["credentials.json"]);
  });

  it("uses stored prefixes when encryption availability changes", () => {
    credentials.set("encrypted", "test-encrypted");
    vi.spyOn(cipher, "isEncryptionAvailable").mockReturnValue(false);
    credentials.set("plain", "test-plain");
    expect(credentials.get("encrypted")).toBe("test-encrypted");
    expect(credentials.get("plain")).toBe("test-plain");
  });

  it("handles prototype-like IDs as own dictionary keys", () => {
    for (const id of ["__proto__", "constructor", "toString"]) {
      expect(credentials.get(id)).toBeUndefined();
      credentials.set(id, "test-key");
      expect(fileCredentials(file, cipher).get(id)).toBe("test-key");
      credentials.delete(id);
      expect(credentials.get(id)).toBeUndefined();
    }
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({});
  });

  it("replaces existing files with mode 0600 without truncating existing readers", () => {
    credentials.set("provider", "test-old");
    fs.chmodSync(file, 0o644);
    const before = fs.readFileSync(file, "utf8");
    const reader = fs.openSync(file, "r");
    try {
      credentials.set("provider", "test-new");
      expect(fs.readFileSync(reader, "utf8")).toBe(before);
      expect(credentials.get("provider")).toBe("test-new");
      if (!windowsHost) expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      expect(fs.readdirSync(dir)).toEqual(["credentials.json"]);
    } finally { fs.closeSync(reader); }
  });

  it.each(["set", "delete"])("preserves the store and removes partial temporary writes on %s failure", (operation) => {
    credentials.set("provider", "test-old");
    const before = fs.readFileSync(file, "utf8");
    const failure = Object.assign(new Error("test write failure"), { code: "ENOSPC" });
    const write = fs.writeFileSync;
    vi.spyOn(fs, "writeFileSync").mockImplementationOnce((target, _data, options) => {
      write(target, "{", options);
      throw failure;
    });
    expect(() => operation === "set" ? credentials.set("provider", "test-new") : credentials.delete("provider")).toThrow(failure);
    expect(fs.readFileSync(file, "utf8")).toBe(before);
    expect(credentials.get("provider")).toBe("test-old");
    expect(fs.readdirSync(dir)).toEqual(["credentials.json"]);
  });

  it.each(["set", "delete"])("preserves the store and cleans up after %s rename failure", (operation) => {
    credentials.set("provider", "test-old");
    const before = fs.readFileSync(file, "utf8");
    const failure = Object.assign(new Error("test rename failure"), { code: "EACCES" });
    vi.spyOn(fs, "renameSync").mockImplementationOnce((temp, destination) => {
      expect(path.dirname(String(temp))).toBe(dir);
      expect(destination).toBe(file);
      if (!windowsHost) expect(fs.statSync(temp).mode & 0o777).toBe(0o600);
      expect(fs.readFileSync(file, "utf8")).toBe(before);
      throw failure;
    });
    expect(() => operation === "set" ? credentials.set("provider", "test-new") : credentials.delete("provider")).toThrow(failure);
    expect(fs.readFileSync(file, "utf8")).toBe(before);
    expect(credentials.get("provider")).toBe("test-old");
    expect(fs.readdirSync(dir)).toEqual(["credentials.json"]);
  });

  it("does not overwrite or remove an existing temporary file", () => {
    credentials.set("provider", "test-old");
    const before = fs.readFileSync(file, "utf8");
    const open = fs.openSync;
    let collision = "";
    vi.spyOn(fs, "openSync").mockImplementation((target, flags, mode) => {
      if (String(target) !== file) {
        collision = String(target);
        const fd = open(target, "wx", 0o600);
        fs.writeSync(fd, "test-existing-file");
        fs.closeSync(fd);
      }
      return open(target, flags, mode);
    });
    expect(() => credentials.set("provider", "test-new")).toThrow(expect.objectContaining({ code: "EEXIST" }));
    vi.restoreAllMocks();
    expect(fs.readFileSync(file, "utf8")).toBe(before);
    expect(fs.readFileSync(collision, "utf8")).toBe("test-existing-file");
  });

  it("preserves older keys when encryption fails", () => {
    credentials.set("provider", "test-old");
    const before = fs.readFileSync(file, "utf8");
    const failure = new Error("test cipher failure");
    vi.spyOn(cipher, "encryptString").mockImplementationOnce(() => { throw failure; });
    expect(() => credentials.set("other", "test-new")).toThrow(failure);
    expect(fs.readFileSync(file, "utf8")).toBe(before);
    expect(credentials.get("provider")).toBe("test-old");
    expect(credentials.get("other")).toBeUndefined();
    expect(fs.readdirSync(dir)).toEqual(["credentials.json"]);
  });

  it("preserves every ciphertext when legacy decryption fails", () => {
    credentials.set("provider", "test-old");
    credentials.set("other", "test-other");
    const before = fs.readFileSync(file);
    const failure = new Error("test decrypt failure");
    vi.spyOn(cipher, "decryptString").mockImplementation(() => { throw failure; });
    expect(() => fileCredentials(file, cipher).get("provider")).toThrow(failure);
    expect(fs.readFileSync(file)).toEqual(before);
    expect(fs.readdirSync(dir)).toEqual(["credentials.json"]);
  });
});
