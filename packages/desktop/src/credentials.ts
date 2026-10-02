// Main-only credentials, encrypted with safeStorage when available. Public routes are write-only.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Credentials } from "@cortex/core";

export type Cipher = { isEncryptionAvailable(): boolean; encryptString(s: string): Buffer; decryptString(b: Buffer): string };

export function fileCredentials(file: string, cipher: Cipher): Credentials {
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
      try { fs.writeFileSync(fd, JSON.stringify(all)); }
      finally { fs.closeSync(fd); }
      fs.renameSync(temp, file);
    } catch (error) { fs.rmSync(temp, { force: true }); throw error; }
  };
  const enc = (s: string) => (cipher.isEncryptionAvailable() ? "e:" + cipher.encryptString(s).toString("base64") : "p:" + Buffer.from(s).toString("base64"));
  const dec = (s: string) => (s.startsWith("e:") ? cipher.decryptString(Buffer.from(s.slice(2), "base64")) : Buffer.from(s.slice(2), "base64").toString());
  return {
    get: (id) => { const v = read()[id]; return v ? dec(v) : undefined; },
    set: (id, key) => { const all = read(); all[id] = enc(key); write(all); },
    delete: (id) => { const all = read(); delete all[id]; write(all); },
  };
}
