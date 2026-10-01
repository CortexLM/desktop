// Provider API keys, encrypted with the OS keychain (safeStorage). Keys stay in main;
// the renderer can only write or delete them through the engine's write-only route.
import fs from "node:fs";
import path from "node:path";
import type { Credentials } from "@cortex/core";

export type Cipher = { isEncryptionAvailable(): boolean; encryptString(s: string): Buffer; decryptString(b: Buffer): string };

export function fileCredentials(file: string, cipher: Cipher): Credentials {
  const read = (): Record<string, string> => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; } };
  const write = (all: Record<string, string>) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(all), { mode: 0o600 });
  };
  const enc = (s: string) => (cipher.isEncryptionAvailable() ? "e:" + cipher.encryptString(s).toString("base64") : "p:" + Buffer.from(s).toString("base64"));
  const dec = (s: string) => (s.startsWith("e:") ? cipher.decryptString(Buffer.from(s.slice(2), "base64")) : Buffer.from(s.slice(2), "base64").toString());
  return {
    get: (id) => { const v = read()[id]; return v ? dec(v) : undefined; },
    set: (id, key) => { const all = read(); all[id] = enc(key); write(all); },
    delete: (id) => { const all = read(); delete all[id]; write(all); },
  };
}
