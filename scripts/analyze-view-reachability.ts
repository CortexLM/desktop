/**
 * Reachability analysis for view components.
 *
 * For each component under `views/` (plus a few notable components/), finds who
 * imports it and whether a path exists from the app root. A component that only
 * appears in its own barrel export and its own tests is dead code: exported,
 * tested, and unreachable by any user.
 *
 * This is static analysis, so it reports import edges, not runtime proof. The
 * runtime side is covered by the Playwright probes.
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';

const SRC = join(process.cwd(), 'packages', 'renderer', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);

/** Every non-test source file's content, for import scanning. */
const contents = new Map<string, string>();
for (const f of files) contents.set(f, readFileSync(f, 'utf8'));

/** Exported component/function names per file. */
function exportsOf(code: string): string[] {
  const names = new Set<string>();
  for (const m of code.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/export\s+\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  for (const m of code.matchAll(/export\s+default\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  return [...names];
}

interface Row {
  file: string;
  exports: string[];
  /** Files (non-test, non-barrel) that reference this module's basename. */
  importers: string[];
  barrelOnly: boolean;
  testOnly: boolean;
  verdict: string;
}

const rows: Row[] = [];

for (const file of files) {
  const rel = relative(process.cwd(), file);
  if (!rel.includes('/views/') && !rel.includes('/components/')) continue;
  const stem = basename(file, extname(file));
  if (stem === 'index') continue;

  const code = contents.get(file)!;
  const names = exportsOf(code);

  // Who references this module?
  //
  // Matching had to be done in-process rather than by shelling out to rg with
  // quoted patterns: the previous version's `-e "from '.*/${stem}'"` never
  // matched the codebase's dominant form, `lazyNamed(() => import('../../views/
  // editor/EditorView'), 'EditorView')`, and so reported EditorView and
  // AdvancedSearchPanel as unreachable while Workbench imports both. Any
  // reference to the module path counts, static or dynamic.
  const importers: string[] = [];
  const pathRe = new RegExp(`['"\`][^'"\`]*/${stem}['"\`]|['"\`]\\./${stem}['"\`]`);
  for (const [other, code2] of contents) {
    if (other === file) continue;
    if (pathRe.test(code2)) importers.push(relative(process.cwd(), other));
  }

  const nonTest = importers.filter((p) => !p.includes('__tests__') && !p.includes('.test.'));
  const nonBarrel = nonTest.filter((p) => !p.endsWith('/index.ts') && !p.endsWith('/index.tsx'));

  const barrelOnly = nonTest.length > 0 && nonBarrel.length === 0;
  const testOnly = nonTest.length === 0 && importers.length > 0;

  let verdict = 'reachable';
  if (importers.length === 0) verdict = 'NO IMPORTERS AT ALL';
  else if (testOnly) verdict = 'TEST-ONLY (dead in app)';
  else if (barrelOnly) verdict = 'BARREL-ONLY (no real consumer)';

  rows.push({ file: rel, exports: names, importers: nonBarrel, barrelOnly, testOnly, verdict });
}

console.log('=== COMPONENTS WITH NO REAL CONSUMER ===\n');
for (const r of rows.filter((r) => r.verdict !== 'reachable')) {
  console.log(`${r.verdict}: ${r.file}`);
  console.log(`   exports: ${r.exports.join(', ') || '(none detected)'}`);
  console.log(`   non-barrel importers: ${r.importers.length ? r.importers.join(', ') : 'NONE'}`);
  console.log();
}

console.log('\n=== REACHABLE (importer counts) ===');
for (const r of rows.filter((r) => r.verdict === 'reachable').sort((a, b) => a.importers.length - b.importers.length)) {
  console.log(`  ${String(r.importers.length).padStart(2)} ${r.file}`);
}

// --- Stub / demo-data detection --------------------------------------------
console.log('\n\n=== STUB AND MOCK-DATA MARKERS ===\n');
const markers = [
  { label: 'TODO/FIXME', re: /\/\/\s*(TODO|FIXME)[:\s]/g },
  { label: 'mock data comment', re: /mock\s*data|données?\s+mock|Pour l'instant/gi },
  { label: 'console.log-only handler', re: /console\.log\(['"`](?:Checkout|Create|Delete|Save|Update)/g },
  { label: 'not implemented', re: /not\s+implemented|non\s+implémenté|Not functional/gi },
];

for (const file of files) {
  const rel = relative(process.cwd(), file);
  if (!rel.includes('/views/') && !rel.includes('/components/')) continue;
  const code = contents.get(file)!;
  const hits: string[] = [];
  for (const { label, re } of markers) {
    const found = [...code.matchAll(re)];
    if (found.length) hits.push(`${label} x${found.length}`);
  }
  if (hits.length) {
    console.log(`${rel}`);
    console.log(`   ${hits.join(', ')}`);
    // Show the TODO lines themselves — they name what is missing.
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      if (/\/\/\s*(TODO|FIXME)[:\s]/.test(line)) {
        console.log(`   L${i + 1}: ${line.trim().slice(0, 130)}`);
      }
    });
    console.log();
  }
}
