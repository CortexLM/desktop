import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const run = () => { try { execFileSync("node", ["scripts/audit-i18n.mjs"], { cwd: root, stdio: "pipe" }); return ""; } catch (e) { return String((e as { stdout: Buffer }).stdout); } };

describe("i18n audit", () => {
  it("flags literal copy in renderer code", () => {
    const probe = path.join(root, "packages/app/src/__audit_probe.tsx");
    fs.writeFileSync(probe, 'export const A = () => <b title="Hello world">Plain text</b>;\n');
    try { expect(run()).toMatch(/attribute title: "Hello world"[\s\S]*JSX text: "Plain text"/); } finally { fs.rmSync(probe); }
  });
});
