// Fills packages/i18n/locales/<target>/*.json from English using any OpenAI-compatible endpoint.
// Usage: TRANSLATE_BASE_URL=… TRANSLATE_API_KEY=… TRANSLATE_MODEL=… node scripts/translate-locales.mjs [--only ns] [--force]
// Only missing keys (or keys whose English changed, tracked in .source.json) are sent. Placeholders are verified.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "packages/i18n/locales");
const TARGETS = ["fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"];
const NAMES = { fr: "French", es: "Spanish", de: "German", ja: "Japanese", "zh-Hans": "Simplified Chinese", "pt-BR": "Brazilian Portuguese", ko: "Korean" };
const { TRANSLATE_BASE_URL: base, TRANSLATE_API_KEY: key, TRANSLATE_MODEL: model = "cc/claude-sonnet-5" } = process.env;
if (!base || !key) { console.error("TRANSLATE_BASE_URL and TRANSLATE_API_KEY are required"); process.exit(2); }
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const force = args.includes("--force");
const SYSTEM = "Translate Cortex UI catalogs. English is the source of truth. Never translate these product names: Cortex, Cortex Code, Cortex Bot, Cortex Chat, Space. Keep placeholders such as {count}, {name} unchanged. Interface copy only — do not invent vendor names. Keep keyboard symbols (⌘, ↵) and punctuation style natural for the target language. Keep proper names of people and companies. Return only a JSON object with the same keys.";

const files = (d) => fs.readdirSync(d, { recursive: true }).filter((f) => String(f).endsWith(".json") && !String(f).endsWith(".source.json")).map(String);
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const read = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {});

async function ask(lang, entries) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(base.replace(/\/$/, "") + "/chat/completions", {
      method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, stream: false, temperature: 0, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `Target language: ${lang}.\n${JSON.stringify(entries, null, 1)}` }] }),
    });
    const text = await res.text();
    const content = text.startsWith("data:")
      ? text.split("\n").filter((l) => l.startsWith("data:") && !l.includes("[DONE]")).map((l) => JSON.parse(l.slice(5)).choices?.[0]?.delta?.content ?? "").join("")
      : JSON.parse(text).choices[0].message.content;
    const m = content.match(/\{[\s\S]*\}/);
    try { const out = JSON.parse(m[0]); if (Object.keys(entries).every((k) => typeof out[k] === "string" && vars(out[k]) === vars(entries[k]))) return out; } catch { /* retry */ }
  }
  throw new Error(`translation failed for ${lang}`);
}

for (const f of files(path.join(dir, "en"))) {
  if (only && !f.replace(/\\/g, "/").startsWith(only)) continue;
  const en = read(path.join(dir, "en", f));
  const srcPath = path.join(dir, "en", f.replace(/\.json$/, ".source.json"));
  for (const loc of TARGETS) {
    const p = path.join(dir, loc, f);
    const cur = read(p);
    const stampPath = path.join(dir, loc, f.replace(/\.json$/, ".source.json"));
    const stamp = read(stampPath);
    const todo = Object.fromEntries(Object.entries(en).filter(([k, v]) => force || cur[k] === undefined || (stamp[k] !== undefined && stamp[k] !== v && loc !== "fr")));
    if (loc === "fr") for (const k of Object.keys(todo)) if (cur[k] !== undefined && !force) delete todo[k];
    const keys = Object.keys(todo);
    for (let i = 0; i < keys.length; i += 60) {
      const chunk = Object.fromEntries(keys.slice(i, i + 60).map((k) => [k, todo[k]]));
      Object.assign(cur, await ask(NAMES[loc], chunk));
      process.stdout.write(`${loc}/${f} ${Math.min(i + 60, keys.length)}/${keys.length}\n`);
    }
    const ordered = Object.fromEntries(Object.keys(en).map((k) => [k, cur[k]]));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(ordered, null, 2) + "\n");
    fs.writeFileSync(stampPath, JSON.stringify(en, null, 2) + "\n");
  }
  void srcPath;
}
