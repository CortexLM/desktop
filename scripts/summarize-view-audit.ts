/**
 * Summarises the audit probes into a readable table plus the flags that matter.
 *
 * The screenshots cannot be inspected by the agent, so this is the evidence
 * layer: it turns the raw probe JSON into per-view verdicts based only on what
 * was actually measured in the running app.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'screenshots', 'audit', 'probes');

interface Probe {
  name: string;
  theme: string;
  rootClasses: string;
  errorBoundaryVisible: boolean;
  errorBoundaryText: string | null;
  stillLoading: boolean;
  text: string;
  textLength: number;
  buttons: { label: string; disabled: boolean; visible: boolean }[];
  inputs: number;
  testIds: string[];
  styles: Record<string, string>;
  geometry: {
    container: { x: number; y: number; width: number; height: number } | null;
    overflowingChildren: number;
    collapsedWithText: number;
  };
  emptiness: {
    looksEmpty: boolean;
    emptyStateTestIds: string[];
    hasHeading: boolean;
    hasDescription: boolean;
    hasAction: boolean;
  };
  consoleErrors: string[];
  pageErrors: string[];
}

const all: Probe[] = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  all.push(...(JSON.parse(readFileSync(join(DIR, file), 'utf8')) as Probe[]));
}

console.log(`Loaded ${all.length} probes\n`);

// --- Styling sanity: did CSS resolve at all? --------------------------------
// The pre-Tailwind baseline rendered with transparent backgrounds and a 'auto'
// header height. Any probe matching that shape means the bundle regressed.
console.log('=== STYLE RESOLUTION ===');
const styleGroups = new Map<string, string[]>();
for (const p of all) {
  const key = `${p.theme} | body=${p.styles.bodyBg} text=${p.styles.bodyColor} header=${p.styles.headerHeight}`;
  if (!styleGroups.has(key)) styleGroups.set(key, []);
  styleGroups.get(key)!.push(p.name);
}
for (const [key, names] of styleGroups) {
  console.log(`  ${key}`);
  console.log(`     ${names.length} views: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ' ...' : ''}`);
}

// --- Hard failures ----------------------------------------------------------
console.log('\n=== ERROR BOUNDARY TRIGGERED (view crashed) ===');
const crashed = all.filter((p) => p.errorBoundaryVisible);
if (crashed.length === 0) console.log('  none');
for (const p of crashed) {
  console.log(`  ${p.theme}/${p.name}: ${p.errorBoundaryText}`);
}

console.log('\n=== STUCK ON SUSPENSE SPINNER ===');
const loading = all.filter((p) => p.stillLoading);
if (loading.length === 0) console.log('  none');
for (const p of loading) console.log(`  ${p.theme}/${p.name}`);

console.log('\n=== PAGE ERRORS (uncaught exceptions) ===');
const pageErrs = new Map<string, string[]>();
for (const p of all) {
  for (const e of p.pageErrors) {
    if (!pageErrs.has(e)) pageErrs.set(e, []);
    pageErrs.get(e)!.push(`${p.theme}/${p.name}`);
  }
}
if (pageErrs.size === 0) console.log('  none');
for (const [err, where] of pageErrs) {
  console.log(`  ${err}`);
  console.log(`     first seen: ${where[0]} (${where.length} probes)`);
}

console.log('\n=== CONSOLE ERRORS (deduplicated) ===');
const consoleErrs = new Map<string, string[]>();
for (const p of all) {
  for (const e of p.consoleErrors) {
    if (!consoleErrs.has(e)) consoleErrs.set(e, []);
    consoleErrs.get(e)!.push(`${p.theme}/${p.name}`);
  }
}
if (consoleErrs.size === 0) console.log('  none');
for (const [err, where] of consoleErrs) {
  console.log(`  [${where.length}] ${err.slice(0, 220)}`);
  console.log(`     first: ${where[0]}`);
}

// --- Emptiness: does an empty panel explain itself? ------------------------
console.log('\n=== EMPTY / NEAR-EMPTY PANELS ===');
for (const p of all.filter((x) => x.emptiness.looksEmpty)) {
  const e = p.emptiness;
  const explains = e.hasHeading && e.hasDescription;
  console.log(
    `  ${p.theme}/${p.name}: chars=${p.textLength} heading=${e.hasHeading} desc=${e.hasDescription} action=${e.hasAction} ` +
      `${explains ? 'EXPLAINS' : '>>> UNEXPLAINED <<<'}`
  );
  if (p.textLength > 0) console.log(`     text: "${p.text.slice(0, 160)}"`);
}

// --- Layout defects --------------------------------------------------------
console.log('\n=== GEOMETRY FLAGS ===');
for (const p of all) {
  const g = p.geometry;
  if (g.overflowingChildren > 0 || g.collapsedWithText > 0) {
    console.log(
      `  ${p.theme}/${p.name}: overflow=${g.overflowingChildren} collapsedWithText=${g.collapsedWithText}` +
        (g.container ? ` container=${g.container.width}x${g.container.height}` : '')
    );
  }
}

// --- Per-view content inventory -------------------------------------------
console.log('\n=== PER-VIEW CONTENT (dark) ===');
for (const p of all.filter((x) => x.theme === 'dark').sort((a, b) => a.name.localeCompare(b.name))) {
  const visibleButtons = p.buttons.filter((b) => b.visible);
  const disabled = visibleButtons.filter((b) => b.disabled);
  console.log(
    `\n  ${p.name}  [${p.geometry.container ? `${p.geometry.container.width}x${p.geometry.container.height}` : 'no container'}]`
  );
  console.log(`     chars=${p.textLength} buttons=${visibleButtons.length} (disabled=${disabled.length}) inputs=${p.inputs}`);
  if (p.testIds.length) {
    console.log(`     testIds: ${[...new Set(p.testIds)].slice(0, 14).join(', ')}`);
  }
  if (visibleButtons.length) {
    console.log(
      `     controls: ${visibleButtons.map((b) => (b.disabled ? `${b.label}(disabled)` : b.label)).filter(Boolean).slice(0, 14).join(' | ')}`
    );
  }
  console.log(`     text: "${p.text.slice(0, 300)}"`);
}

// --- Theme comparison ------------------------------------------------------
console.log('\n=== THEME PARITY (same view, dark vs light) ===');
const byName = new Map<string, Probe[]>();
for (const p of all) {
  if (!byName.has(p.name)) byName.set(p.name, []);
  byName.get(p.name)!.push(p);
}
for (const [name, list] of byName) {
  const dark = list.find((p) => p.theme === 'dark');
  const light = list.find((p) => p.theme === 'light');
  if (!dark || !light) continue;
  const notes: string[] = [];
  if (dark.styles.bodyBg === light.styles.bodyBg) {
    notes.push(`SAME body bg in both themes (${dark.styles.bodyBg})`);
  }
  if (dark.styles.bodyColor === light.styles.bodyColor) {
    notes.push(`SAME text colour in both themes (${dark.styles.bodyColor})`);
  }
  if (Math.abs(dark.textLength - light.textLength) > 40) {
    notes.push(`text differs: dark=${dark.textLength} light=${light.textLength}`);
  }
  if (dark.errorBoundaryVisible !== light.errorBoundaryVisible) {
    notes.push(`crash differs: dark=${dark.errorBoundaryVisible} light=${light.errorBoundaryVisible}`);
  }
  if (notes.length) console.log(`  ${name}: ${notes.join('; ')}`);
}
console.log('\ndone');
