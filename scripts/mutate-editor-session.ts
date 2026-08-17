#!/usr/bin/env bun
/**
 * Mutation harness for the editor-session persistence work.
 *
 * Coverage says every line ran; it does not say an assertion would have noticed
 * if the line were wrong. Each mutation below breaks the persistence in a way a
 * plausible regression would, and the suite must go red for every one. A
 * SURVIVED mutant is a hole in the tests, not a curiosity.
 *
 * Usage: bun scripts/mutate-editor-session.ts
 */

import { execSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SESSION = join(ROOT, 'packages/renderer/src/store/editor-session.ts');
const STORE = join(ROOT, 'packages/renderer/src/store/editor-store.ts');

interface Mutation {
  name: string;
  file: string;
  from: string;
  to: string;
}

const MUTATIONS: Mutation[] = [
  // ---- Persist nothing at all -------------------------------------------
  {
    name: 'write nothing: setItem becomes a no-op',
    file: SESSION,
    from: '      const candidates = degradeSession(value.state);',
    to: '      const candidates = degradeSession(value.state);\n      if (candidates) return;',
  },
  {
    name: 'persist an empty tab list',
    file: SESSION,
    from: '    tabs: tabs.map((tab) => ({',
    to: '    tabs: ([] as SessionTabInput[]).map((tab) => ({',
  },

  // ---- Never rehydrate ---------------------------------------------------
  {
    name: 'never rehydrate: getItem always reports an empty session',
    file: SESSION,
    from: '      if (raw === null) return null;',
    to: '      if (raw === null || raw !== null) return null;',
  },
  {
    name: 'merge ignores the persisted session',
    file: STORE,
    from: '          const session = persisted as PersistedSession | undefined;',
    to: '          const session = undefined as PersistedSession | undefined;',
  },

  // ---- Write an invalid shape -------------------------------------------
  {
    name: 'persist tabs without their path',
    file: SESSION,
    from: '      path: tab.path,\n      language: tab.language,',
    to: '      path: undefined as unknown as string,\n      language: tab.language,',
  },
  {
    name: 'persist content as an object instead of a string',
    file: SESSION,
    from: '      content: keep.has(tab.id) ? tab.content : null,',
    to: '      content: keep.has(tab.id) ? ({ v: tab.content } as unknown as string) : null,',
  },

  // ---- Drop the cheap-but-visible extras --------------------------------
  {
    name: 'stop persisting cursor position',
    file: SESSION,
    from: '      cursorPosition: tab.cursorPosition,\n      scrollPosition: tab.scrollPosition,\n      baselineMtime: tab.baselineMtime,\n    })),',
    to: '      cursorPosition: undefined,\n      scrollPosition: tab.scrollPosition,\n      baselineMtime: tab.baselineMtime,\n    })),',
  },
  {
    name: 'stop persisting the conflict baseline',
    file: SESSION,
    from: '      isDirty: tab.isDirty,\n      isActive: tab.isActive,\n      cursorPosition: tab.cursorPosition,',
    to: '      isDirty: false,\n      isActive: tab.isActive,\n      cursorPosition: tab.cursorPosition,',
  },

  // ---- Budget / quota ----------------------------------------------------
  {
    name: 'apply the clean per-tab cap to unsaved content too',
    file: SESSION,
    from: '    if (tab.size > remaining) continue;\n    remaining -= tab.size;\n    keep.add(tab.id);\n  }\n\n  for (const tab of clean) {',
    to: '    if (tab.size > cleanPerTabLimit) continue;\n    if (tab.size > remaining) continue;\n    remaining -= tab.size;\n    keep.add(tab.id);\n  }\n\n  for (const tab of clean) {',
  },
  {
    name: 'give up on the first quota rejection instead of degrading',
    file: SESSION,
    from: '        } catch (error) {\n          onWriteFailure?.(stage, error);\n        }',
    to: '        } catch (error) {\n          onWriteFailure?.(stage, error);\n          return;\n        }',
  },
  {
    name: 'let a quota rejection escape to the caller',
    file: SESSION,
    from: '      for (let stage = 0; stage < candidates.length; stage += 1) {',
    to: '      if (candidates.length) engine.setItem(name, JSON.stringify({ state: value.state, version: value.version }));\n      for (let stage = 0; stage < candidates.length; stage += 1) {',
  },
  {
    name: 'oversized tab aborts the whole allocation (break instead of continue)',
    file: SESSION,
    from: '    if (tab.size > cleanPerTabLimit) continue;\n    if (tab.size > remaining) continue;',
    to: '    if (tab.size > cleanPerTabLimit) break;\n    if (tab.size > remaining) continue;',
  },

  // ---- Untrusted input ---------------------------------------------------
  {
    name: 'trust storage: skip tab validation',
    file: SESSION,
    from: '  if (typeof value.path !== \'string\' || value.path === \'\') return null;',
    to: '  if (false) return null;',
  },
  {
    name: 'allow duplicate paths back in from storage',
    file: SESSION,
    from: '    if (seenPaths.has(tab.path) || seenIds.has(tab.id)) continue;',
    to: '    if (false) continue;',
  },

  // ---- Reconciliation with disk -----------------------------------------
  {
    name: 'close a dirty tab whose file vanished (lose unsaved work)',
    file: SESSION,
    from: '      if (tab.isDirty) {\n        kept.push({ ...tab, diskState: \'missing\' });\n      } else {\n        closedPaths.push(tab.path);\n      }',
    to: '      closedPaths.push(tab.path);',
  },
  {
    name: 'keep a clean tab whose file vanished (dead tab)',
    file: SESSION,
    from: '      if (tab.isDirty) {\n        kept.push({ ...tab, diskState: \'missing\' });\n      } else {\n        closedPaths.push(tab.path);\n      }',
    to: '      kept.push(tab);',
  },
  {
    name: 'treat a transient read failure as a deletion',
    file: SESSION,
    from: '      if (!result.missing) {\n        // Transient / permission failure: change nothing.\n        kept.push(tab);\n        continue;\n      }',
    to: '      if (false) {\n        kept.push(tab);\n        continue;\n      }',
  },
  {
    name: 'never detect a conflict',
    file: SESSION,
    from: '    const diskChanged =\n      typeof tab.baselineMtime === \'number\' && mtime > tab.baselineMtime && content !== tab.content;',
    to: '    const diskChanged = false;',
  },
  {
    name: 'flag a conflict on mtime alone, ignoring the bytes',
    file: SESSION,
    from: '      typeof tab.baselineMtime === \'number\' && mtime > tab.baselineMtime && content !== tab.content;',
    to: '      typeof tab.baselineMtime === \'number\' && mtime > tab.baselineMtime;',
  },
  {
    name: 'overwrite unsaved edits with the disk content',
    file: SESSION,
    from: '    kept.push({ ...tab, diskState: diskChanged ? \'conflict\' : \'clean\' });',
    to: '    kept.push({ ...tab, content, diskState: diskChanged ? \'conflict\' : \'clean\' });',
  },
  {
    name: 'do not refresh a clean tab from disk',
    file: SESSION,
    from: '      kept.push({ ...tab, content, baselineMtime: mtime, diskState: \'clean\' });',
    to: '      kept.push({ ...tab, diskState: \'clean\' });',
  },
  {
    name: 'silently show the disk version when unsaved content was dropped',
    file: SESSION,
    from: '        diskState: \'unsaved-lost\',',
    to: '        diskState: \'clean\',',
  },
  {
    name: 'advance the baseline on a conflict (hides it next boot)',
    file: SESSION,
    from: '    kept.push({ ...tab, diskState: diskChanged ? \'conflict\' : \'clean\' });',
    to: '    kept.push({ ...tab, baselineMtime: mtime, diskState: diskChanged ? \'conflict\' : \'clean\' });',
  },

  // ---- Focus invariants --------------------------------------------------
  {
    name: 'skip focus repair after restore',
    file: SESSION,
    from: '  const resolved = requested ?? tabs.find((tab) => tab.isActive)?.id ?? tabs[tabs.length - 1].id;',
    to: '  const resolved = activeTabId ?? tabs[tabs.length - 1].id;',
  },
  {
    name: 'leave every restored tab flagged active',
    file: SESSION,
    from: '    tabs: tabs.map((tab) => ({ ...tab, isActive: tab.id === resolved })),',
    to: '    tabs: tabs.map((tab) => ({ ...tab })),',
  },

  // ---- Save path ---------------------------------------------------------
  {
    name: 'a save does not clear the conflict flag',
    file: STORE,
    from: '                  diskState: mtime === undefined ? tab.diskState : undefined,',
    to: '                  diskState: tab.diskState,',
  },
  {
    name: 'a save does not advance the baseline',
    file: STORE,
    from: '                  baselineMtime: mtime ?? tab.baselineMtime,',
    to: '                  baselineMtime: tab.baselineMtime,',
  },

  // ---- restoreSession wiring --------------------------------------------
  {
    name: 'restoreSession never reconciles',
    file: STORE,
    from: '        if (!read || tabs.length === 0) {',
    to: '        if (true) {',
  },
  {
    name: 'onRehydrateStorage never fires restoreSession',
    file: STORE,
    from: '  if (error || !state) return;\n  void state.restoreSession();',
    to: '  if (error || !state) return;',
  },
  {
    name: 'rehydrate handler ignores the error argument',
    file: STORE,
    from: '  if (error || !state) return;\n  void state.restoreSession();',
    to: '  if (!state) return;\n  void state.restoreSession();',
  },
  {
    name: 'onRehydrateStorage is not wired to the handler at all',
    file: STORE,
    from: '        onRehydrateStorage: () => handleRehydrated,',
    to: '        onRehydrateStorage: () => () => {},',
  },
  {
    name: 'restoreSession never settles its status',
    file: STORE,
    from: "          sessionStatus: 'restored',\n        });",
    to: "          sessionStatus: 'restoring',\n        });",
  },
];

const TARGET_TESTS = 'src/store src/views/editor';

function runSuite(): { red: boolean; summary: string } {
  try {
    const output = execSync(`bunx vitest run ${TARGET_TESTS} --reporter=dot 2>&1`, {
      cwd: join(ROOT, 'packages/renderer'),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 300_000,
    });
    const match = output.match(/Tests\s+(.+)/);
    return { red: false, summary: match?.[1]?.trim() ?? 'passed' };
  } catch (error) {
    const output = String((error as { stdout?: string }).stdout ?? '');
    const match = output.match(/Tests\s+(.+)/);
    return { red: true, summary: match?.[1]?.trim() ?? 'failed to run' };
  }
}

const backups = new Map<string, string>();
for (const file of [SESSION, STORE]) {
  const backup = `${file}.mutation-backup`;
  copyFileSync(file, backup);
  backups.set(file, backup);
}

function restoreAll(): void {
  for (const [file, backup] of backups) copyFileSync(backup, file);
}

let killed = 0;
const survivors: string[] = [];
const notApplied: string[] = [];

console.log('Baseline (unmutated) run...');
const baseline = runSuite();
if (baseline.red) {
  console.error(`✗ baseline is already red (${baseline.summary}); fix that before mutating.`);
  restoreAll();
  for (const backup of backups.values()) unlinkSync(backup);
  process.exit(1);
}
console.log(`✓ baseline green: ${baseline.summary}\n`);

for (const mutation of MUTATIONS) {
  restoreAll();

  const source = readFileSync(mutation.file, 'utf8');
  const occurrences = source.split(mutation.from).length - 1;

  if (occurrences === 0) {
    // A mutation that does not apply proves nothing, and silently counting it as
    // killed is exactly how a mutation harness starts lying.
    notApplied.push(mutation.name);
    console.log(`⚠️  NOT APPLIED  ${mutation.name}`);
    continue;
  }

  writeFileSync(mutation.file, source.replace(mutation.from, mutation.to));
  const result = runSuite();

  if (result.red) {
    killed += 1;
    console.log(`✓ KILLED    ${mutation.name}  (${result.summary})`);
  } else {
    survivors.push(mutation.name);
    console.log(`✗ SURVIVED  ${mutation.name}  (${result.summary})`);
  }
}

restoreAll();
for (const backup of backups.values()) unlinkSync(backup);

console.log(`\n${'='.repeat(70)}`);
console.log(`applied: ${MUTATIONS.length - notApplied.length}/${MUTATIONS.length}`);
console.log(`killed:  ${killed}`);
console.log(`survived: ${survivors.length}`);
if (notApplied.length) {
  console.log(`\nNOT APPLIED (anchor text not found — fix the harness):`);
  for (const name of notApplied) console.log(`  - ${name}`);
}
if (survivors.length) {
  console.log(`\nSURVIVORS (untested behaviour):`);
  for (const name of survivors) console.log(`  - ${name}`);
}

process.exit(survivors.length === 0 && notApplied.length === 0 ? 0 : 1);
