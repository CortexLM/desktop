import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTRACT_OPS } from "@cortex/schema";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx")).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
const locales = path.join(dir, "../../../../i18n/locales");
// The renderer modules need a window; the registration table is read from source instead.
const SCREENS = [...fs.readFileSync(path.join(dir, "index.tsx"), "utf8").matchAll(/id: "([\w-]+)", name: "([\w.-]+)"/g)].map((m) => ({ id: m[1]!, name: m[2]! }));
const en = JSON.parse(fs.readFileSync(path.join(locales, "en/live.json"), "utf8")) as Record<string, string>;

const TODO_6B = ["bot-channel", "bot-room", "bot-companion", "bot-invites", "bot-invite", "bot-share", "bot-computer", "code-automations", "code-automation", "code-connect",
  "g4-bot-create", "g4-bot-first-run", "g4-code-home", "g4-code-session", "connection", "providers", "provider-detail", "models", "model-picker", "remote-login", "remote-chat",
  "tool-approval", "space", "space-page", "scheduled", "scheduled-edit", "scheduled-history", "plugins", "plugin-detail", "skills", "mcp-add"];

describe("Todo 6b live screens", () => {
  it("registers every scoped design screen exactly once with translated names", () => {
    expect(SCREENS.map((s) => s.id).sort()).toEqual([...TODO_6B].sort());
    for (const s of SCREENS) expect(en[s.name.replace(/^live\./, "")], s.id).toBeTruthy();
  });

  it("calls only operations in the closed contract table, and every app operation is used", () => {
    const used = new Set([...source.matchAll(/"(app\.[a-z.]+)"/g)].map((m) => m[1]!));
    const table = Object.keys(CONTRACT_OPS).filter((k) => k.startsWith("app."));
    for (const op of used) expect(table, op).toContain(op);
    expect(table.filter((op) => !used.has(op) && !["app.instance", "app.automations.runs", "app.skill", "app.skill.update"].includes(op))).toEqual([]);
  });

  it("uses only translated static keys and every locale carries the same keys", () => {
    const keys = [...source.matchAll(/t\("live\.([\w.-]+)"/g)].map((m) => m[1]!);
    expect(keys.filter((k) => !(k in en))).toEqual([]);
    for (const l of fs.readdirSync(locales)) {
      const file = path.join(locales, l, "live.json");
      expect(Object.keys(JSON.parse(fs.readFileSync(file, "utf8"))).sort(), l).toEqual(Object.keys(en).sort());
    }
  });
});
