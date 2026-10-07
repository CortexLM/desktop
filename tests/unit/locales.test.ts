import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES, preferredLocale } from "@cortex/i18n";
import { nodeCatalogs } from "@cortex/i18n/node";

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../packages/i18n/locales");
const ns = (l: string) => (fs.existsSync(path.join(dir, l)) ? fs.readdirSync(path.join(dir, l)).filter((f) => f.endsWith(".json")) : []);
const keys = (l: string, f: string) => Object.keys(JSON.parse(fs.readFileSync(path.join(dir, l, f), "utf8")));
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("locale catalogs", () => {
  it("declares the backend's locale list", () => {
    expect(LOCALES).toEqual(["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"]);
  });
  it("follows the explicit choice, then the first supported system language, else English", () => {
    expect(preferredLocale("", ["en-US"])).toBe("en");
    expect(preferredLocale("", ["en-US", "de-DE"])).toBe("en");
    expect(preferredLocale("", ["xx-YY", "fr-FR"])).toBe("fr");
    expect(preferredLocale("", ["pt-PT"])).toBe("pt-BR");
    expect(preferredLocale("", ["xx-YY"])).toBe("en");
    expect(preferredLocale("", [])).toBe("en");
    expect(preferredLocale("en", ["de-DE"])).toBe("en");
    expect(preferredLocale("fr", ["en-US"])).toBe("fr");
    expect(preferredLocale("xx", ["de-DE"])).toBe("de");
  });
  it("translates every French value that is not a brand or technical token", () => {
    // Values that stay identical in French on purpose: product names, file formats, code and CSS easing names.
    const SAME = /^(?:Cortex(?: [A-Z][a-z]+)*|Studio Cortex|Word \(\.docx\)|Google Docs|Pull request|pnpm build|SIL Open Font License 1\.1|Micro-interactions|refs\/.*|ease-[a-z-]+|https:\/\/\S+|-{3}[\s\S]*|(?:Bot|Code|Cortex Code) · (?:invitation|session))$/;
    const fr = nodeCatalogs(dir)("fr"), en = nodeCatalogs(dir)("en");
    const same = Object.entries(en).filter(([n]) => n !== "components").flatMap(([n, keys]) => Object.entries(keys)
      .filter(([k, v]) => fr[n]?.[k] === v && (v.replace(/\{\w+\}/g, "").match(/\b[A-Za-z]{3,}\b/g) ?? []).length >= 2 && !SAME.test(v)).map(([k]) => `${n}.${k}`));
    expect(same).toEqual([]);
  });
  it("does not load translation source stamps as runtime catalogs", () => {
    const catalogs = nodeCatalogs(dir)("fr");
    expect(catalogs.chat["image.ready"]).toContain("quatre");
    expect(Object.keys(catalogs).some((name) => name.endsWith(".source"))).toBe(false);
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
