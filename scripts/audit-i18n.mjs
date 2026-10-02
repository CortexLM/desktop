// Audits common copy sinks in renderer/main code and literal t()/tr() keys against English.
// ponytail: follows local consts and expression branches, not imported values, function returns or
// runtime data; add targeted sinks with regression cases when new UI APIs appear. Not a dataflow proof.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traverseMod from "@babel/traverse";
const traverse = traverseMod.default ?? traverseMod;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["packages/app/src", "packages/desktop/src"];
const ATTRS = new Set(["aria-label", "aria-description", "title", "placeholder", "alt", "label", "aria-valuetext", "description", "hint", "text", "children"]);
const KEYS = new Set(["title", "description", "label", "placeholder", "hint", "message", "text", "name"]);
const letters = /\p{L}/u;
// Only recognizable data syntax is exempt; ordinary lower-case words are still copy.
const notCopy = (s) => !letters.test(s) || /^Cortex(?: Code| Cloud)?$/.test(s)
  || /^(?:https?:\/\/|cortex:\/\/|\.{0,2}\/|~\/|[A-Z]:[\\/])\S+$/i.test(s)
  || /^[\w./@()-]+\.(?:[cm]?[jt]sx?|md|txt|json|html|css|svg|png|jpe?g|webp|pdf|docx|pptx|xlsx|csv|mp3|mp4|zip|ya?ml|toml)$/i.test(s)
  || /^(?:[⌘⌥⌃⇧]+|(?:(?:CmdOrCtrl|Command|Control|Cmd|Ctrl|Alt|Option|Shift|Meta)\+)+)(?:[A-Za-z0-9,.[\]/\\+=-]|F\d{1,2}|Enter|Return|Escape|Esc|Tab|Space|Backspace|Delete)$/.test(s);

const files = ROOTS.flatMap((r) => walk(path.join(root, r))).filter((f) => /\.(tsx?|mts)$/.test(f) && !/\.test\.|\/test\//.test(f));
function walk(d) { return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : []; }

const en = new Set();
const enDir = path.join(root, "packages/i18n/locales/en");
for (const f of fs.readdirSync(enDir).filter((x) => x.endsWith(".json") && !x.endsWith(".source.json"))) for (const k of Object.keys(JSON.parse(fs.readFileSync(path.join(enDir, f), "utf8")))) en.add(`${f.slice(0, -5)}.${k}`);
const hasKey = (k) => en.has(k) || en.has(`${k}_other`);

const problems = [];
const usedKeys = new Set();
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  let ast;
  try { ast = parse(src, { sourceType: "module", plugins: ["typescript", "jsx"] }); } catch (e) { problems.push(`${rel(file)}: parse error ${e.message}`); continue; }
  const reported = new Set();
  const report = (node, what, text) => {
    if (reported.has(node)) return;
    reported.add(node);
    problems.push(`${rel(file)}:${node.loc.start.line} ${what}: ${JSON.stringify(text.trim().slice(0, 80))}`);
  };
  const copy = (p, what, keyAllowed = false, seen = new Set()) => {
    if (!p?.node || seen.has(p.node)) return;
    seen.add(p.node);
    const n = p.node;
    if (p.isStringLiteral() || p.isJSXText()) {
      const s = n.value.trim();
      if (!notCopy(s) && !(keyAllowed && hasKey(s))) report(n, what, s);
    } else if (p.isTemplateLiteral()) {
      const parts = n.quasis.map((q) => q.value.cooked ?? q.value.raw);
      if (!notCopy(parts.join("0").trim())) report(n, what, parts.join("…"));
      for (const e of p.get("expressions")) copy(e, what, keyAllowed, seen);
    } else if (p.isIdentifier()) {
      const b = p.scope.getBinding(n.name);
      if (!b?.constant || b.kind !== "const" || !b.path.isVariableDeclarator() || !b.path.get("id").isIdentifier()) return;
      const init = b.path.get("init");
      // This exact Git ref is data; do not exempt the word "main" in other copy sinks.
      if (n.name === "BASE_BRANCH" && init.isStringLiteral({ value: "main" })) return;
      copy(init, what, keyAllowed, seen);
    } else if (p.isConditionalExpression()) {
      copy(p.get("consequent"), what, keyAllowed, seen);
      copy(p.get("alternate"), what, keyAllowed, seen);
    } else if (p.isLogicalExpression() || p.isBinaryExpression({ operator: "+" })) {
      if (n.operator !== "&&") copy(p.get("left"), what, keyAllowed, seen);
      copy(p.get("right"), what, keyAllowed, seen);
    } else if (p.isTSAsExpression() || p.isTSSatisfiesExpression() || p.isTSNonNullExpression() || p.isTSTypeAssertion()) {
      copy(p.get("expression"), what, keyAllowed, seen);
    } else if (p.isArrayExpression()) {
      for (const e of p.get("elements")) copy(e, what, keyAllowed, seen);
    }
  };
  traverse(ast, {
    JSXText(p) { copy(p, "JSX text"); },
    JSXAttribute(p) {
      const n = p.node.name.name; const v = p.get("value");
      if (ATTRS.has(n)) copy(v.isJSXExpressionContainer() ? v.get("expression") : v, `attribute ${n}`);
    },
    JSXExpressionContainer(p) {
      if (p.parent.type !== "JSXElement" && p.parent.type !== "JSXFragment") return;
      copy(p.get("expression"), "JSX string");
    },
    ObjectProperty(p) {
      const k = p.node.key.name ?? p.node.key.value;
      if (!KEYS.has(k) || p.node.computed && !p.get("key").isStringLiteral()) return;
      const call = p.parentPath.parentPath;
      const toast = call.isCallExpression() && call.get("callee").matchesPattern("toast.add");
      const menu = file.startsWith(path.join(root, "packages/desktop/src") + path.sep) && k === "label";
      // Catalog keys may be stored in screen/mascot definitions; visible menu/toast copy needs t().
      copy(p.get("value"), `property ${k}`, !toast && !menu);
    },
    CallExpression(p) {
      const c = p.node.callee; const a = p.node.arguments[0];
      const isT = c.type === "Identifier" && (c.name === "t" || c.name === "tr");
      if (isT && a?.type === "StringLiteral") usedKeys.add(a.value);
      if (c.type === "Identifier" && ["alert", "confirm", "prompt", "toast"].includes(c.name)) copy(p.get("arguments.0"), `${c.name} literal`);
    },
  });
}
for (const k of usedKeys) if (!hasKey(k)) problems.push(`missing en key: ${k}`);
function rel(f) { return path.relative(root, f); }

const out = process.argv.includes("--json") ? JSON.stringify({ files: files.length, keysUsed: usedKeys.size, catalogKeys: en.size, problems }, null, 2) : problems.join("\n");
if (out) console.log(out);
console.error(`i18n audit: ${files.length} files, ${usedKeys.size} keys used, ${en.size} keys in en, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
