// Catalog loader for Node hosts (Electron main, scripts, tests).
import fs from "node:fs";
import path from "node:path";
import type { CatalogSource } from "./index";

export function nodeCatalogs(localesDir: string): CatalogSource {
  return (locale) => {
    const dir = path.join(localesDir, locale);
    if (!fs.existsSync(dir)) return {};
    return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))]));
  };
}
