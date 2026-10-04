import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("i18n audit", () => {
  it("finds copy through common sinks without treating identifiers or source stamps as catalogs", () => {
    // An isolated CLI fixture cannot race another audit or typecheck in the real source tree.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex audit-"));
    const write = (file: string, content: string) => {
      const dest = path.join(dir, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content);
    };
    try {
      write("scripts/audit-i18n.mjs", fs.readFileSync(path.join(root, "scripts/audit-i18n.mjs"), "utf8"));
      fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "junction");
      write("packages/i18n/locales/en/common.json", JSON.stringify({ ok: "OK", items_other: "{count} items" }));
      write("packages/i18n/locales/en/common.source.json", JSON.stringify({ stale: "source hash" }));
      write("packages/app/src/probe.tsx", [
        'const CTA = "continue" as const; const alias = CTA;',
        'const HINT = "account";',
        'const BASE_BRANCH = "main"; const FILE = "AGENTS.md";',
        'const SHORTCUT = "Ctrl+Shift+P"; const BRAND = "Cortex";',
        'const unused = "Never displayed";',
        'export const A = ({ flag, count }) => <b title="Hello world" aria-label={HINT} className="not-copy">',
        'Plain text{"save"}{alias}{flag ? "retry" : t("common.ok")}{flag && "pending"}',
        '{`Delete ${count} items`}{"Saved " + count}{"main"}',
        '<small placeholder={flag ? "filter" : "search"} />',
        '<span>{FILE}{BASE_BRANCH}{SHORTCUT}{BRAND}{"Cortex Code"}{"⌘⇧P"}{"https://cortex.foundation"}</span>',
        '<span>{`${count}.png`}</span><Icon name="search" />',
        '{["compose", "refresh"].map((icon) => <IconBtn icon={icon} label={icon} />)}',
        '{["shell.nav.home"].map((key) => <button>{key.toLowerCase()}</button>)}',
        '{["common.ok"].map((key) => <button>{t(key)}</button>)}',
        '</b>;',
        'toast.add({ title: "saved", description: "synced", data: { icon: "check-circle" } });',
        'toast.add({ title: "common.ok" });',
        'const label = "rename"; const menu = [{ label }, { label: "common.ok" }];',
        'confirm("delete");',
        't("common.items", { count: 2 }); tr("common.missing"); t("common.source.stale");',
      ].join("\n"));
      write("packages/desktop/src/menu.ts", 'const QUIT = "quit"; export const menu = [{ label: QUIT }, { label: "edit", accelerator: "CmdOrCtrl+E" }];');
      const result = spawnSync(process.execPath, ["scripts/audit-i18n.mjs", "--json"], { cwd: dir, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(1);
      const audit = JSON.parse(result.stdout);
      expect(audit).toMatchObject({ files: 2, keysUsed: 4, catalogKeys: 2 });
      expect(audit.problems.map((s: string) => s.replace(/^packages\/.*?:\d+ /, ""))).toEqual([
        'attribute title: "Hello world"',
        'attribute aria-label: "account"',
        'JSX text: "Plain text"',
        'JSX string: "save"',
        'JSX string: "continue"',
        'JSX string: "retry"',
        'JSX string: "pending"',
        'JSX string: "Delete … items"',
        'JSX string: "Saved"',
        'JSX string: "main"',
        'attribute placeholder: "filter"',
        'attribute placeholder: "search"',
        'attribute label: "compose"',
        'attribute label: "refresh"',
        'JSX string: "shell.nav.home"',
        'property title: "saved"',
        'property description: "synced"',
        'property title: "common.ok"',
        'property label: "rename"',
        'confirm literal: "delete"',
        'property label: "quit"',
        'property label: "edit"',
        'missing en key: common.missing',
        'missing en key: common.source.stale',
      ]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
