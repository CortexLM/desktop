import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@cortex/i18n";

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../packages/i18n/locales");
const ns = (l: string) => (fs.existsSync(path.join(dir, l)) ? fs.readdirSync(path.join(dir, l)).filter((f) => f.endsWith(".json")) : []);
const keys = (l: string, f: string) => Object.keys(JSON.parse(fs.readFileSync(path.join(dir, l, f), "utf8")));
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("locale catalogs", () => {
  it("declares the backend's locale list", () => {
    expect(LOCALES).toEqual(["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"]);
  });
  for (const l of LOCALES.filter((x) => x !== "en")) it(`${l} has every English key with the same placeholders`, () => {
    for (const f of ns("en")) {
      const enJ = JSON.parse(fs.readFileSync(path.join(dir, "en", f), "utf8"));
      const p = path.join(dir, l, f);
      expect(fs.existsSync(p), `${l}/${f}`).toBe(true);
      const tr = JSON.parse(fs.readFileSync(p, "utf8"));
      for (const k of keys("en", f)) { expect(tr[k], `${l}/${f} ${k}`).toBeTypeOf("string"); expect(vars(tr[k]), `${l}/${f} ${k}`).toBe(vars(enJ[k])); }
    }
  });
});
