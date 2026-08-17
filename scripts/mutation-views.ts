/**
 * Mutation harness for the renderer view suites.
 *
 * Why this exists, and why it is this paranoid
 * -------------------------------------------
 * Coverage cannot tell a real assertion from a decorative one. Executing a line
 * and *checking* it are different things, and the percentage counts only the
 * first. Mutation testing is the check: break the product code on purpose and
 * see whether a named test goes red.
 *
 * Three failure modes of a naive harness, all of which have actually happened in
 * this repo, are guarded against here:
 *
 * 1. A mutation that never applied. A regex that matches nothing leaves the file
 *    untouched, the suite stays green, and the harness prints SURVIVED — which
 *    reads as "no test covers this" when the truth is "nothing was tested at
 *    all". One real case assumed 10 spaces of indentation where the file had 12.
 *    So: every mutation is applied to a snapshot, the result is DIFFED against
 *    the original, and a zero diff is reported as NOT_APPLIED (a harness error),
 *    never as SURVIVED.
 *
 * 2. A harness that kills everything. If the runner reports failure no matter
 *    what is done to the source — wrong path, broken import, unrelated red test
 *    in the baseline — then every mutation is "killed" and the result is
 *    meaningless. So: a NEUTRAL CONTROL (a comment reword, semantically inert)
 *    must SURVIVE. If the control dies, the run is void.
 *
 * 3. Credit claimed by the wrong test. A mutation is "killed" only if the test
 *    that is *supposed* to catch it goes red. Asserting merely that the suite
 *    failed lets an unrelated (or earlier, order-dependent) test take the
 *    credit — and under `describe.serial` an early failure can skip the real
 *    detector entirely. So: each mutation names an `expectTest` substring, and
 *    the harness confirms that a matching test name appears among the failures.
 *
 * Run: bun scripts/mutation-views.ts [--filter <substring>]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');

interface Mutation {
  /** Stable identifier used in the report and by --filter. */
  id: string;
  /** Repo-relative file to mutate. */
  file: string;
  /** Literal text to replace. Must be present exactly once. */
  find: string;
  /** Replacement text. */
  replace: string;
  /**
   * Substring of the test name expected to fail. `null` marks the neutral
   * control, which must survive.
   */
  expectTest: string | null;
  /** Which vitest project(s) to run, plus an optional file filter. */
  run: { project: string; testFile?: string };
  /** What regression this mutation stands for. */
  describes: string;
}

const MUTATIONS: Mutation[] = [
  // -------------------------------------------------------------------------
  // Neutral control. A comment reword changes no behaviour: if this is reported
  // killed, the harness is flagging noise and every other verdict is suspect.
  // -------------------------------------------------------------------------
  {
    id: 'control-comment',
    file: 'packages/renderer/src/views/extensions/MCPMarketplace.tsx',
    find: '// Serveurs MCP populaires (catalogue hardcodé pour démo)',
    replace: '// Catalogue of popular MCP servers, hardcoded for the demo.',
    expectTest: null,
    run: { project: 'renderer', testFile: 'views/extensions' },
    describes: 'NEUTRAL CONTROL — comment reword, must survive',
  },

  // -------------------------------------------------------------------------
  // Bug 1: MCPMarketplace called process.cwd() at module scope, which threw a
  // ReferenceError on import and took down the whole Extensions view.
  // -------------------------------------------------------------------------
  {
    id: 'marketplace-process-cwd',
    file: 'packages/renderer/src/views/extensions/MCPMarketplace.tsx',
    find: "args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],",
    replace: "args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],",
    expectTest: 'module scope',
    run: { project: 'renderer', testFile: 'views/extensions' },
    describes: 'restore process.cwd() at module scope in MCPMarketplace',
  },

  // -------------------------------------------------------------------------
  // Bug 2: the debug:* domain returns raw values, not the { success, data }
  // envelope. Wrapping the settings response leaves SettingsPanel stuck on its
  // spinner and throws in Object.entries(settings.categories).
  // -------------------------------------------------------------------------
  {
    id: 'settings-envelope',
    file: 'packages/main/src/ipc/handlers/debug-handlers.ts',
    find: '  return { ...settings, logLevel: debugService.getSettings().logLevel };',
    replace:
      '  return { success: true, data: { ...settings, logLevel: debugService.getSettings().logLevel } } as unknown as DebugSettings;',
    expectTest: 'spinner',
    run: { project: 'renderer', testFile: 'views/debug' },
    describes: 'wrap debug:get-settings in the { success, data } envelope',
  },

  // -------------------------------------------------------------------------
  // Bug 3: returning the service's own options object (DebugServiceOptions)
  // instead of the renderer's DebugSettings contract. `categories` is absent, so
  // Object.entries(settings.categories) throws.
  // -------------------------------------------------------------------------
  {
    id: 'settings-service-shape',
    file: 'packages/main/src/ipc/handlers/debug-handlers.ts',
    find: '  return { ...settings, logLevel: debugService.getSettings().logLevel };',
    replace: '  return debugService.getSettings() as unknown as DebugSettings;',
    expectTest: 'categories',
    run: { project: 'renderer', testFile: 'views/debug' },
    describes: 'return DebugServiceOptions instead of the DebugSettings contract',
  },

  // -------------------------------------------------------------------------
  // Bug 4: SettingsPanel renders systemInfo.logs ("Logs Directory"). The handler
  // supplies it; dropping it blanks the row on screen.
  // -------------------------------------------------------------------------
  {
    id: 'system-info-logs',
    file: 'packages/main/src/ipc/handlers/debug-handlers.ts',
    find: "    logs: safely(() => app.getPath('logs')),",
    replace: "    logs: undefined as unknown as string,",
    expectTest: 'logs directory',
    run: { project: 'renderer', testFile: 'views/debug' },
    describes: 'drop `logs` from debug:get-system-info',
  },

  // -------------------------------------------------------------------------
  // Bug 5: the two-click Save trap. `enableIpcMonitoring` derived from
  // `enabled && categories.ipc`; `enabled` is false by default and the panel is
  // reachable without it, so opening debug settings and clicking Save turned
  // recording off. Measured: 1 message before Save, 0 after.
  // -------------------------------------------------------------------------
  {
    id: 'save-trap-conjunction',
    file: 'packages/main/src/ipc/handlers/debug-handlers.ts',
    find: '    enableIpcMonitoring: settings.categories.ipc,',
    replace: '    enableIpcMonitoring: settings.enabled && settings.categories.ipc,',
    expectTest: 'Save',
    run: { project: 'renderer', testFile: 'views/debug' },
    describes: 'restore `enabled && categories.ipc` for enableIpcMonitoring',
  },

  // -------------------------------------------------------------------------
  // Bug 6: IPCMessage.direction is stored 'send'|'receive' by the monitor but
  // filtered/coloured on 'renderer->main' by the panel. Dropping the mapping
  // makes rows invisible to the filter and flips the arrow.
  // -------------------------------------------------------------------------
  {
    id: 'ipc-direction-mapping',
    file: 'packages/main/src/ipc/handlers/debug-handlers.ts',
    find: "    direction: message.direction === 'send' ? 'renderer->main' : 'main->renderer',",
    replace: "    direction: message.direction as IPCMessage['direction'],",
    expectTest: 'direction',
    run: { project: 'renderer', testFile: 'views/debug' },
    describes: 'stop mapping monitor direction to the panel vocabulary',
  },

  // -------------------------------------------------------------------------
  // Bug 7: PlansView crashed on an undefined `rows`.
  // -------------------------------------------------------------------------
  {
    id: 'plansview-rows',
    file: 'packages/renderer/src/views/workspace/PlansView.tsx',
    find: '      setTasks(result?.rows ?? []);',
    replace: '      setTasks(result.rows);',
    expectTest: 'rows',
    run: { project: 'renderer', testFile: 'PlansView' },
    describes: 'remove the `rows` default in PlansView',
  },

  // -------------------------------------------------------------------------
  // Beyond the known bugs: the empty-vs-error distinction. A panel that renders
  // empty because its source failed is indistinguishable from one that is
  // legitimately empty — the thing that hid the IPC Inspector bug for so long.
  // -------------------------------------------------------------------------
  {
    id: 'automation-list-error-swallow',
    file: 'packages/renderer/src/views/automations/AutomationList.tsx',
    find: "      setError(error instanceof Error ? error.message : 'Failed to load automations');",
    replace: '      // error swallowed',
    expectTest: 'claiming there are no automations',
    run: { project: 'renderer', testFile: 'views/automations' },
    describes: 'swallow the load error in AutomationList (empty looks legitimate)',
  },
  {
    id: 'logs-viewer-error-swallow',
    file: 'packages/renderer/src/views/automations/LogsViewer.tsx',
    find: "      setError(error instanceof Error ? error.message : 'Failed to load logs');",
    replace: '      // error swallowed',
    expectTest: 'claiming there are no logs',
    run: { project: 'renderer', testFile: 'views/automations' },
    describes: 'swallow the load error in LogsViewer (empty looks legitimate)',
  },

  // -------------------------------------------------------------------------
  // Bug found during this work: PerformancePanel opened on the hardcoded
  // category 'timing', which no producer emits, so the panel always showed
  // "No performance data" while metrics sat in the monitor.
  // -------------------------------------------------------------------------
  {
    id: 'performance-hardcoded-category',
    file: 'packages/renderer/src/views/debug/PerformancePanel.tsx',
    find: `  const effectiveCategory =
    selectedCategory && categories.includes(selectedCategory)
      ? selectedCategory
      : categories[0] ?? '';`,
    replace: "  const effectiveCategory = selectedCategory ?? 'timing';",
    expectTest: 'did not hardcode',
    run: { project: 'renderer', testFile: 'views/debug' },
    describes: "restore the hardcoded 'timing' category in PerformancePanel",
  },

  // -------------------------------------------------------------------------
  // Bug found during this work: one automation's unreadable log history
  // replaced the whole (successfully loaded) list with an error screen.
  // -------------------------------------------------------------------------
  {
    id: 'automation-last-run-isolation',
    file: 'packages/renderer/src/views/automations/AutomationList.tsx',
    // Re-throwing rather than deleting the catch clause: removing it outright
    // leaves a `try` with no handler, which is a syntax error — the file would
    // fail to parse and every test in the project would go red, scoring a KILL
    // that proves nothing. Re-throwing restores exactly the old behaviour (the
    // error reaching the outer catch) with the file still valid.
    find: `        } catch (logError) {
          console.error('Failed to load last run for automation:', automation.id, logError);
        }`,
    replace: `        } catch (logError) {
          throw logError;
        }`,
    expectTest: 'last-run lookup fails',
    run: { project: 'renderer', testFile: 'views/automations' },
    describes: 'let a per-automation getLogs failure fail the whole list load',
  },
];

type Verdict = 'KILLED' | 'SURVIVED' | 'NOT_APPLIED' | 'WRONG_TEST';

interface Result {
  mutation: Mutation;
  verdict: Verdict;
  detail: string;
  diffLines: number;
  failedTests: string[];
}

/** Extracts failing test names from vitest output. */
function parseFailures(output: string): string[] {
  const names = new Set<string>();
  // Vitest marks failures with a red "×" (or "✗"/"FAIL") followed by the name.
  for (const line of output.split('\n')) {
    const m = /^\s*(?:×|✗)\s+(.+?)(?:\s+\d+ms)?\s*$/.exec(line);
    if (m) names.add(m[1].trim());
  }
  return [...names];
}

function runSuite(mutation: Mutation): { failed: boolean; output: string; failures: string[] } {
  // The default reporter, deliberately: `--reporter=basic` does not exist in
  // vitest 4 and makes the runner exit non-zero before loading a single test —
  // which every mutation would then score as KILLED. The default reporter prints
  // one `×  <test name>` line per failure, which is what `parseFailures` reads.
  const args = ['vitest', 'run', '--project', mutation.run.project];
  if (mutation.run.testFile) args.push(mutation.run.testFile);

  const proc = spawnSync('bunx', args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: 'true' },
  });

  const output = `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`;
  return { failed: proc.status !== 0, output, failures: parseFailures(output) };
}

/**
 * Number of lines that genuinely differ, ignoring positional shift.
 *
 * A naive index-by-index comparison reports every line after an insertion or
 * deletion as "changed" — a 4-line replacement scored 185. That number is not
 * wrong in a way that breaks the zero-diff guard, but it is useless as evidence:
 * the point of printing it is to show *what* was touched. Trimming the common
 * prefix and suffix gives the size of the actual edit.
 */
function countDiffLines(before: string, after: string): number {
  const a = before.split('\n');
  const b = after.split('\n');

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }

  return Math.max(a.length - prefix - suffix, b.length - prefix - suffix);
}

function main(): void {
  const filterIndex = process.argv.indexOf('--filter');
  const filter = filterIndex === -1 ? undefined : process.argv[filterIndex + 1];
  const selected = filter ? MUTATIONS.filter((m) => m.id.includes(filter)) : MUTATIONS;

  if (selected.length === 0) {
    console.error(`no mutation matched --filter ${filter}`);
    process.exit(2);
  }

  console.log(`\nRunning ${selected.length} mutation(s)\n${'='.repeat(72)}`);

  const results: Result[] = [];

  for (const mutation of selected) {
    const path = resolve(REPO, mutation.file);
    if (!existsSync(path)) {
      results.push({
        mutation,
        verdict: 'NOT_APPLIED',
        detail: `file not found: ${mutation.file}`,
        diffLines: 0,
        failedTests: [],
      });
      continue;
    }

    const original = readFileSync(path, 'utf8');

    // --- proof of application, part 1: the anchor must be present exactly once
    const occurrences = original.split(mutation.find).length - 1;
    if (occurrences !== 1) {
      results.push({
        mutation,
        verdict: 'NOT_APPLIED',
        detail: `anchor found ${occurrences} time(s), expected exactly 1`,
        diffLines: 0,
        failedTests: [],
      });
      console.log(`\n[${mutation.id}] NOT_APPLIED — anchor matched ${occurrences} time(s)`);
      continue;
    }

    const mutated = original.replace(mutation.find, mutation.replace);

    // --- proof of application, part 2: the text must actually have changed
    const diffLines = countDiffLines(original, mutated);
    if (diffLines === 0) {
      results.push({
        mutation,
        verdict: 'NOT_APPLIED',
        detail: 'replacement produced a byte-identical file',
        diffLines: 0,
        failedTests: [],
      });
      console.log(`\n[${mutation.id}] NOT_APPLIED — zero diff`);
      continue;
    }

    console.log(`\n[${mutation.id}] applying (${diffLines} line(s) changed) — ${mutation.describes}`);

    try {
      writeFileSync(path, mutated, 'utf8');

      // --- proof of application, part 3: re-read from disk and confirm
      const readBack = readFileSync(path, 'utf8');
      if (!readBack.includes(mutation.replace)) {
        results.push({
          mutation,
          verdict: 'NOT_APPLIED',
          detail: 'written file does not contain the replacement',
          diffLines,
          failedTests: [],
        });
        console.log(`[${mutation.id}] NOT_APPLIED — replacement absent from disk`);
        continue;
      }

      const { failed, failures } = runSuite(mutation);

      if (mutation.expectTest === null) {
        // Neutral control: it must survive.
        const verdict: Verdict = failed ? 'KILLED' : 'SURVIVED';
        results.push({
          mutation,
          verdict,
          detail: failed
            ? 'CONTROL DIED — the harness kills noise, every other verdict is void'
            : 'control survived, harness discriminates',
          diffLines,
          failedTests: failures,
        });
        console.log(`[${mutation.id}] ${verdict} (control) — ${failures.length} failing test(s)`);
        continue;
      }

      if (!failed) {
        results.push({
          mutation,
          verdict: 'SURVIVED',
          detail: 'suite stayed green with the fix removed',
          diffLines,
          failedTests: [],
        });
        console.log(`[${mutation.id}] SURVIVED — no test caught it`);
        continue;
      }

      // Killed — but by the right test?
      const matching = failures.filter((name) =>
        name.toLowerCase().includes(mutation.expectTest!.toLowerCase())
      );

      if (matching.length === 0) {
        results.push({
          mutation,
          verdict: 'WRONG_TEST',
          detail: `expected a failing test matching "${mutation.expectTest}", got: ${failures.slice(0, 5).join(' | ') || '(none parsed)'}`,
          diffLines,
          failedTests: failures,
        });
        console.log(
          `[${mutation.id}] WRONG_TEST — red, but not the named detector (${failures.length} failure(s))`
        );
        continue;
      }

      results.push({
        mutation,
        verdict: 'KILLED',
        detail: `caught by: ${matching[0]}`,
        diffLines,
        failedTests: failures,
      });
      console.log(`[${mutation.id}] KILLED by "${matching[0]}"`);
    } finally {
      // Always restore, even if the runner threw.
      writeFileSync(path, original, 'utf8');
      const restored = readFileSync(path, 'utf8');
      if (restored !== original) {
        console.error(`\nFATAL: failed to restore ${mutation.file}`);
        process.exit(3);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  console.log(`\n${'='.repeat(72)}\nSUMMARY\n${'='.repeat(72)}`);
  for (const r of results) {
    console.log(
      `${r.verdict.padEnd(12)} ${r.mutation.id.padEnd(32)} diff=${String(r.diffLines).padStart(2)}  ${r.detail}`
    );
  }

  const control = results.find((r) => r.mutation.expectTest === null);
  const real = results.filter((r) => r.mutation.expectTest !== null);

  const controlOk = !control || control.verdict === 'SURVIVED';
  const notApplied = real.filter((r) => r.verdict === 'NOT_APPLIED');
  const survived = real.filter((r) => r.verdict === 'SURVIVED');
  const wrongTest = real.filter((r) => r.verdict === 'WRONG_TEST');
  const killed = real.filter((r) => r.verdict === 'KILLED');

  console.log(
    `\ncontrol: ${controlOk ? 'survived (harness valid)' : 'DIED (harness INVALID)'}` +
      `\nkilled: ${killed.length}/${real.length}` +
      `\nsurvived: ${survived.length}` +
      `\nwrong test: ${wrongTest.length}` +
      `\nnot applied (harness error): ${notApplied.length}`
  );

  const ok =
    controlOk && notApplied.length === 0 && survived.length === 0 && wrongTest.length === 0;
  process.exit(ok ? 0 : 1);
}

main();
