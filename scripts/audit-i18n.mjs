// Fails when a user-facing string in renderer or main-process code is not read from the i18n catalogs,
// or when a t() key used in code is missing from the English catalog.
// Flags: JSX text with letters; string literals in user-facing JSX attributes; string literals passed to
// toast/title/description/label/placeholder object keys; Electron menu `label:` literals.
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseMod from "@babel/traverse";
const traverse = traverseMod.default ?? traverseMod;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ROOTS = ["packages/app/src", "packages/desktop/src"];
const ATTRS = new Set(["aria-label", "aria-description", "title", "placeholder", "alt", "label", "aria-valuetext"]);
const KEYS = new Set(["title", "description", "label", "placeholder", "hint", "message", "text", "name"]);
const letters = /\p{L}{2,}/u;
// Strings that are not copy: i18n keys, css, ids, urls, icons, data-*
const notCopy = (s) => !letters.test(s) || /^[a-z0-9-]+(\.[\w-]+)+$/i.test(s) || /^[a-z][a-z0-9-]*$/.test(s) || /^(https?:|\/|#|\.\/|data:|var\(|cortex:)/.test(s) || /^[\w-]+(\s[\w-]+)*$/.test(s) && /^[a-z]/.test(s) && !/\s/.test(s);

const files = ROOTS.flatMap((r) => walk(path.join(root, r))).filter((f) => /\.(tsx?|mts)$/.test(f) && !/\.test\.|\/test\//.test(f));
function walk(d) { return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : []; }

const en = {};
const enDir = path.join(root, "packages/i18n/locales/en");
for (const f of fs.readdirSync(enDir).filter((x) => x.endsWith(".json"))) for (const k of Object.keys(JSON.parse(fs.readFileSync(path.join(enDir, f), "utf8")))) en[`${f.slice(0, -5)}.${k}`] = true;

const problems = [];
const usedKeys = new Set();
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  let ast;
  try { ast = parse(src, { sourceType: "module", plugins: ["typescript", "jsx"] }); } catch (e) { problems.push(`${rel(file)}: parse error ${e.message}`); continue; }
  const report = (node, what, text) => problems.push(`${rel(file)}:${node.loc.start.line} ${what}: ${JSON.stringify(text.trim().slice(0, 80))}`);
  traverse(ast, {
    JSXText(p) { const v = p.node.value.trim(); if (v && letters.test(v)) report(p.node, "JSX text", v); },
    JSXAttribute(p) {
      const n = p.node.name.name; const v = p.node.value;
      if (!ATTRS.has(n) || !v) return;
      if (v.type === "StringLiteral" && letters.test(v.value)) report(v, `attribute ${n}`, v.value);
      if (v.type === "JSXExpressionContainer" && v.expression.type === "StringLiteral" && letters.test(v.expression.value)) report(v, `attribute ${n}`, v.expression.value);
      if (v.type === "JSXExpressionContainer" && v.expression.type === "TemplateLiteral" && v.expression.quasis.some((q) => letters.test(q.value.cooked))) report(v, `attribute ${n}`, v.expression.quasis.map((q) => q.value.cooked).join("…"));
    },
    JSXExpressionContainer(p) {
      const e = p.node.expression;
      if (p.parent.type !== "JSXElement" && p.parent.type !== "JSXFragment") return;
      if (e.type === "StringLiteral" && letters.test(e.value) && !notCopy(e.value)) report(e, "JSX string", e.value);
      if (e.type === "TemplateLiteral" && e.quasis.some((q) => /\p{L}{3,}/u.test(q.value.cooked))) report(e, "JSX template", e.quasis.map((q) => q.value.cooked).join("…"));
    },
    ObjectProperty(p) {
      const k = p.node.key.name ?? p.node.key.value; const v = p.node.value;
      if (!KEYS.has(k) || v.type !== "StringLiteral") return;
      if (letters.test(v.value) && /\s/.test(v.value) && !/^[\w.-]+$/.test(v.value)) report(v, `property ${k}`, v.value);
      if (file.includes("packages/desktop") && k === "label" && letters.test(v.value)) report(v, "menu label", v.value);
    },
    CallExpression(p) {
      const c = p.node.callee; const a = p.node.arguments[0];
      const isT = (c.type === "Identifier" && (c.name === "t" || c.name === "tr")) ;
      if (isT && a?.type === "StringLiteral") usedKeys.add(a.value);
      if (c.type === "MemberExpression" && c.property.name === "add" && c.object.name === "toast" && a?.type === "ObjectExpression") {
        for (const prop of a.properties) if (prop.value?.type === "StringLiteral" && letters.test(prop.value.value) && /\s/.test(prop.value.value)) report(prop.value, "toast literal", prop.value.value);
      }
    },
  });
}
for (const k of usedKeys) if (!en[k] && !en[`${k}_other`]) problems.push(`missing en key: ${k}`);
function rel(f) { return path.relative(root, f); }

const out = process.argv.includes("--json") ? JSON.stringify({ files: files.length, keysUsed: usedKeys.size, catalogKeys: Object.keys(en).length, problems }, null, 2) : problems.join("\n");
if (out) console.log(out);
console.error(`i18n audit: ${files.length} files, ${usedKeys.size} keys used, ${Object.keys(en).length} keys in en, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
