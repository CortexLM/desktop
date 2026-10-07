// Main-only credentials. Public routes are write-only.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Credentials } from "@cortex/core";
import { windowsCredentials } from "./windows-credentials";

export type Cipher = { isEncryptionAvailable(): boolean; encryptString(s: string): Buffer; decryptString(b: Buffer): string };

export function fileCredentials(file: string, cipher: Cipher, requireEncryption = false): Credentials {
  const windows = process.platform === "win32";
  const read = (): Record<string, string> => {
    let all: unknown;
    try { all = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return Object.create(null);
      // JSON parse errors can include store contents; reject with a fixed message below.
      if (!(error instanceof SyntaxError)) throw error;
    }
    if (!all || typeof all !== "object" || Array.isArray(all) || Object.values(all).some((value) => typeof value !== "string")) {
      throw new Error("Invalid credential store");
    }
    return Object.assign(Object.create(null), all);
  };
  const write = (all: Record<string, string>) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${randomUUID()}.tmp`;
    const fd = fs.openSync(temp, "wx", 0o600);
    try {
      try {
        // Windows ignores POSIX mode: remove inherited access before writing ciphertext.
        if (windows) windowsCredentials.restrict(temp);
        fs.writeFileSync(fd, JSON.stringify(all));
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      fs.renameSync(temp, file);
    } catch (error) { fs.rmSync(temp, { force: true }); throw error; }
  };
  const enc = (s: string) => {
    if (requireEncryption && !windows && !cipher.isEncryptionAvailable()) throw new Error("Credential protection unavailable");
    return windows ? "d:" + windowsCredentials.protect(s) : (cipher.isEncryptionAvailable() ? "e:" + cipher.encryptString(s).toString("base64") : "p:" + Buffer.from(s).toString("base64"));
  };
  const dec = (s: string) => (s.startsWith("e:") ? cipher.decryptString(Buffer.from(s.slice(2), "base64")) : Buffer.from(s.slice(2), "base64").toString());
  return {
    get: (id) => {
      const all = read(); const value = all[id];
      if (!value) return undefined;
      if (requireEncryption && !windows && (!cipher.isEncryptionAvailable() || !value.startsWith("e:"))) throw new Error("Credential protection unavailable");
      if (!windows) return dec(value);
      if (value.startsWith("d:")) return windowsCredentials.unprotect(value.slice(2));
      if (!value.startsWith("e:") && !value.startsWith("p:")) throw new Error("Invalid credential store");
      const plain = dec(value);
      all[id] = enc(plain);
      write(all);
      return plain;
    },
    set: (id, key) => { const all = read(); all[id] = enc(key); write(all); },
    delete: (id) => { const all = read(); delete all[id]; write(all); },
  };
}
