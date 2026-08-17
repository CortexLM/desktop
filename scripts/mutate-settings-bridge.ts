/**
 * Attestation harness for the settings -> AI provider bridge.
 *
 * The claim under test: each half of the bridge has a test that goes red when
 * that half is removed. A claim about tests is only settled by breaking the code
 * and watching them fail, which is what this does.
 *
 * The four self-checks this repo established, all four implemented here:
 *
 *   1. A neutral control (comment-only edit) that must SURVIVE. If it dies, the
 *      suite is failing for reasons unrelated to the mutation and every other
 *      verdict is meaningless.
 *   2. Proof of application before any verdict. An unmatched pattern previously
 *      produced a false SURVIVED: the harness "mutated" nothing, the suite
 *      passed, and that was reported as a surviving mutant. Here every mutation
 *      re-reads the file and asserts the replacement is present; if it is not,
 *      the verdict is APPLY-FAILED, never SURVIVED.
 *   3. The error path is itself tested (`--self-test`): a pattern that is
 *      absent, wrongly indented, or not unique must produce APPLY-FAILED.
 *   4. Named killing tests. `describe.serial` can skip a detector when an
 *      earlier test fails first, so the harness records WHICH test failed and
 *      the report names it — a mutation killed by an unrelated early failure is
 *      visible instead of being counted as attested.
 *
 * Note on the runner: `--reporter=basic` DOES NOT EXIST in Vitest 4. A harness
 * that invoked it would have every run fail to start while still parsing "no
 * failures" out of the output, and would have reported a perfect score without
 * verifying anything. The default reporter is used, and the parser below keys on
 * strings the default reporter actually emits.
 *
 *   bun scripts/mutate-settings-bridge.ts
 *   bun scripts/mutate-settings-bridge.ts --self-test
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = join(import.meta.dir, '..');
const BACKUP_DIR = join(REPO, '.mutation-backup', 'settings-bridge');

const HANDLERS = 'packages/main/src/ipc/handlers/settings-handlers.ts';
const REGISTRY = 'packages/ai-engine/src/registry.ts';
const SETTINGS_SERVICE = 'packages/main/src/services/provider-settings-service.ts';
const PRELOAD = 'packages/preload/src/index.ts';

interface Mutation {
  id: string;
  file: string;
  find: string;
  replace: string;
  /** Which property of the bridge this breaks. */
  breaks: string;
  /** Vitest invocation that should detect it. */
  suite: string;
  neutral?: boolean;
}

const MAIN_SETTINGS_SUITE =
  'bunx vitest run --project main src/ipc/handlers/__tests__/settings-handlers.test.ts src/services/__tests__/provider-settings-service.test.ts 2>&1';
const PRELOAD_SUITE = 'bunx vitest run --project preload 2>&1';
const RENDERER_SUITE = 'bunx vitest run --project renderer src/views/settings 2>&1';

const MUTATIONS: Mutation[] = [
  // ---------------------------------------------------------------------------
  // Self-check 1: neutral control. Comment-only edit. Must SURVIVE.
  // ---------------------------------------------------------------------------
  {
    id: 'neutral-comment',
    file: HANDLERS,
    find: 'export function registerSettingsHandlers(): void {',
    replace:
      '// Enregistre les deux canaux du domaine settings.\nexport function registerSettingsHandlers(): void {',
    breaks: 'nothing — neutral control',
    suite: MAIN_SETTINGS_SUITE,
    neutral: true,
  },

  // ---------------------------------------------------------------------------
  // THE original bug: settings are persisted but the registry is never rebuilt.
  //
  // This is the mutation that matters most. A test asserting only "the settings
  // were saved" passes with this applied.
  // ---------------------------------------------------------------------------
  {
    id: 'no-registry-rebuild',
    file: HANDLERS,
    find: '    const activeIds = getAIService().applyRegistryConfig(settings.toRegistryConfig());',
    replace: '    const activeIds = getAIService().getRegisteredProviderIds();',
    breaks:
      'THE original bug: the key is stored but the registry keeps its startup providers, so the chat still fails with Provider not found',
    suite: MAIN_SETTINGS_SUITE,
  },

  // ---------------------------------------------------------------------------
  // The purge inside the hot reconfigure. `register()` is additive, so without
  // the clear a removed provider stays resolvable with its old key.
  // ---------------------------------------------------------------------------
  {
    id: 'reconfigure-without-purge',
    file: REGISTRY,
    find: '  reconfigure(config: RegistryConfig): void {\n    this.providers.clear();',
    replace: '  reconfigure(config: RegistryConfig): void {',
    breaks:
      'a provider removed from settings stays resolvable with its old key, because register() is additive',
    suite: MAIN_SETTINGS_SUITE,
  },

  // ---------------------------------------------------------------------------
  // Precedence inverted: the environment wins over the UI.
  // ---------------------------------------------------------------------------
  {
    id: 'env-wins-over-settings',
    file: SETTINGS_SERVICE,
    find: '      const apiKey = settingsKey ?? envEntry?.apiKey;',
    replace: '      const apiKey = envEntry?.apiKey ?? settingsKey;',
    breaks:
      'the environment overrides the key the user just typed, so the Save button appears to do nothing',
    suite: MAIN_SETTINGS_SUITE,
  },

  // ---------------------------------------------------------------------------
  // The key travels back to the renderer.
  // ---------------------------------------------------------------------------
  {
    id: 'key-leaks-to-renderer',
    file: SETTINGS_SERVICE,
    find: '      if (hasSettingsKey) view.maskedApiKey = maskApiKey(settingsKey);',
    replace: '      if (hasSettingsKey) view.maskedApiKey = settingsKey;',
    breaks: 'the plaintext key is sent back to the renderer instead of a mask',
    suite: MAIN_SETTINGS_SUITE,
  },

  // ---------------------------------------------------------------------------
  // The channel is cut at the preload allowlist.
  // ---------------------------------------------------------------------------
  {
    id: 'channel-cut-at-allowlist',
    file: PRELOAD,
    find: "  'settings:set-provider',\n] as const;",
    replace: '] as const;',
    breaks:
      'the Save button rejects at runtime with "IPC channel not allowed", reproducing the original symptom exactly',
    suite: PRELOAD_SUITE,
  },

  // ---------------------------------------------------------------------------
  // The renderer writes the key into localStorage again.
  // ---------------------------------------------------------------------------
  {
    id: 'renderer-keeps-key-after-save',
    file: 'packages/renderer/src/views/settings/SettingsView.tsx',
    find: '          draftKey: \'\',\n          draftBaseUrl: view.baseUrl ?? \'\',\n        }))\n      );\n    } catch {\n      toast.error(`Failed to save ${PROVIDER_LABELS[id]} settings`);',
    replace: '          draftKey: draft.draftKey,\n          draftBaseUrl: view.baseUrl ?? \'\',\n        }))\n      );\n    } catch {\n      toast.error(`Failed to save ${PROVIDER_LABELS[id]} settings`);',
    breaks: 'the plaintext key survives the save in renderer memory',
    suite: RENDERER_SUITE,
  },
];

// ============================================================================
// Engine
// ============================================================================

type Verdict = 'KILLED' | 'SURVIVED' | 'APPLY-FAILED';

interface Result {
  mutation: Mutation;
  verdict: Verdict;
  detail: string;
  /** Names of the tests that failed — self-check 4. */
  failingTests: string[];
}

const TOUCHED_FILES = [...new Set(MUTATIONS.map((m) => m.file))];

function backup(): void {
  mkdirSync(BACKUP_DIR, { recursive: true });
  for (const file of TOUCHED_FILES) {
    copyFileSync(join(REPO, file), join(BACKUP_DIR, file.replace(/[/\\]/g, '__')));
  }
}

function restore(): void {
  for (const file of TOUCHED_FILES) {
    const saved = join(BACKUP_DIR, file.replace(/[/\\]/g, '__'));
    if (existsSync(saved)) copyFileSync(saved, join(REPO, file));
  }
}

/**
 * Applies one mutation, or explains why it could not be applied.
 *
 * Self-check 2 lives here. Three refusals, all reported as APPLY-FAILED rather
 * than being allowed to masquerade as a passing suite:
 *
 *   - the pattern is absent (a refactor moved or reworded the line);
 *   - the pattern occurs more than once (the harness cannot know which one it
 *     meant, and replacing the first silently mutates the wrong site);
 *   - the replacement is not present in the file afterwards.
 */
function applyMutation(mutation: Mutation): { ok: true } | { ok: false; reason: string } {
  const path = join(REPO, mutation.file);
  const before = readFileSync(path, 'utf8');

  const occurrences = before.split(mutation.find).length - 1;
  if (occurrences === 0) {
    return { ok: false, reason: `pattern not found in ${mutation.file}` };
  }
  if (occurrences > 1) {
    return {
      ok: false,
      reason: `pattern is not unique in ${mutation.file} (${occurrences} occurrences)`,
    };
  }

  const after = before.replace(mutation.find, mutation.replace);
  if (after === before) {
    return { ok: false, reason: 'replacement produced an identical file' };
  }

  writeFileSync(path, after, 'utf8');

  // Proof of application: re-read from disk rather than trusting the write.
  const written = readFileSync(path, 'utf8');
  if (!written.includes(mutation.replace)) {
    writeFileSync(path, before, 'utf8');
    return { ok: false, reason: 'replacement absent from the file after writing' };
  }
  // A mutation that *wraps* its target (the neutral control prepends a comment
  // to the line it matches) legitimately leaves `find` in the file. Only demand
  // that the original disappeared when the replacement does not contain it --
  // otherwise this check reports APPLY-FAILED for a correctly applied mutation,
  // which is a false negative in the opposite direction from the one self-check
  // 2 exists to prevent.
  if (!mutation.replace.includes(mutation.find) && written.includes(mutation.find)) {
    writeFileSync(path, before, 'utf8');
    return { ok: false, reason: 'original pattern still present after writing' };
  }

  // For a wrapping mutation, the proof is that the count of the original did not
  // grow and the replacement is present -- both already established above.
  if (mutation.replace.includes(mutation.find)) {
    const beforeCount = before.split(mutation.find).length - 1;
    const afterCount = written.split(mutation.find).length - 1;
    if (afterCount !== beforeCount) {
      writeFileSync(path, before, 'utf8');
      return {
        ok: false,
        reason: `wrapping mutation changed the original's occurrence count (${beforeCount} -> ${afterCount})`,
      };
    }
  }

  return { ok: true };
}

/**
 * Names of failing tests, parsed from the default reporter's output.
 *
 * Self-check 4: the report names which test caught the mutation, so a mutation
 * "killed" by an unrelated early failure (a `describe.serial` cascade, a
 * timeout) is visible as such instead of being counted as attestation.
 */
function parseFailingTests(output: string): string[] {
  const names = new Set<string>();

  for (const line of output.split('\n')) {
    // Default reporter: " FAIL  |project| path/to/file.test.ts > suite > test"
    const fail = line.match(/^\s*FAIL\s+.*?>\s*(.+)$/);
    if (fail?.[1]) names.add(fail[1].trim());

    // And the per-test marker: "   × test name 3ms"
    const cross = line.match(/^\s*[×x]\s+(.+?)(\s+\d+ms)?$/);
    if (cross?.[1]) names.add(cross[1].trim());
  }

  return [...names];
}

function runSuite(mutation: Mutation): Result {
  let output: string;
  let failed: boolean;

  try {
    output = execSync(mutation.suite, { cwd: REPO, encoding: 'utf8', stdio: 'pipe' });
    failed = false;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    failed = true;
  }

  // A suite that never started is not a detection. Vitest 4 prints "Test Files"
  // on every completed run; its absence means the runner itself failed (a bad
  // flag such as the non-existent `--reporter=basic`, a link error, a bad path).
  if (!output.includes('Test Files')) {
    return {
      mutation,
      verdict: 'APPLY-FAILED',
      detail: 'the runner never completed a run — no "Test Files" summary in its output',
      failingTests: [],
    };
  }

  const failingTests = parseFailingTests(output);

  return {
    mutation,
    verdict: failed ? 'KILLED' : 'SURVIVED',
    detail: failed ? `suite failed (${failingTests.length} named tests)` : 'suite stayed green',
    failingTests,
  };
}

function evaluate(mutation: Mutation): Result {
  const applied = applyMutation(mutation);
  if (!applied.ok) {
    return { mutation, verdict: 'APPLY-FAILED', detail: applied.reason, failingTests: [] };
  }

  try {
    return runSuite(mutation);
  } finally {
    restore();
  }
}

// ============================================================================
// Self-test — self-check 3
// ============================================================================

/**
 * Exercises the harness's own error path.
 *
 * The failure this guards against is specific and has happened: a mutation whose
 * pattern no longer matched was reported as SURVIVED, which reads as "the tests
 * do not catch this bug" when the truth was "the harness never introduced the
 * bug". These three cases must all be APPLY-FAILED.
 */
function selfTest(): void {
  console.log('=== self-test: the harness error path ===\n');

  const cases: Array<{ name: string; mutation: Mutation }> = [
    {
      name: 'absent pattern',
      mutation: {
        id: 'self-absent',
        file: HANDLERS,
        find: 'thisStringIsNotInTheFileAnywhere_9f3a',
        replace: 'whatever',
        breaks: 'n/a',
        suite: 'true',
      },
    },
    {
      name: 'wrong indentation',
      mutation: {
        id: 'self-indent',
        // Real line, wrong leading whitespace: the exact near-miss a
        // hand-written pattern produces.
        file: HANDLERS,
        // Anchored with a leading newline and given MORE indentation than the
        // real line. Without the anchor, an un-indented pattern is a *substring*
        // of the indented line and would apply -- the near-miss would silently
        // succeed, which is the very thing this case exists to detect.
        find: '\n        const activeIds = getAIService().applyRegistryConfig(settings.toRegistryConfig());',
        replace: '\n        const activeIds: string[] = [];',
        breaks: 'n/a',
        suite: 'true',
      },
    },
    {
      name: 'non-unique pattern',
      mutation: {
        id: 'self-not-unique',
        file: HANDLERS,
        // Appears in both handlers.
        find: '  const settings = getProviderSettingsService();',
        replace: '  const settings = getProviderSettingsService(); // dup',
        breaks: 'n/a',
        suite: 'true',
      },
    },
  ];

  backup();
  let allPassed = true;

  try {
    for (const { name, mutation } of cases) {
      const applied = applyMutation(mutation);
      const ok = !applied.ok;
      if (!ok) allPassed = false;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${ok ? applied.reason : 'was applied!'}`);
      restore();
    }
  } finally {
    restore();
  }

  // The indentation case deserves a note: it must fail for "pattern not found",
  // NOT be silently applied against the trimmed line.
  console.log(
    '\n  Note: the indentation case must report "pattern not found" rather than\n' +
      '  matching the un-indented substring — otherwise a near-miss pattern would\n' +
      '  mutate a line the author did not intend.'
  );

  console.log(`\n${allPassed ? 'SELF-TEST PASSED' : 'SELF-TEST FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

// ============================================================================
// Report
// ============================================================================

function main(): void {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }

  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
  const selected = only ? MUTATIONS.filter((m) => m.id === only) : MUTATIONS;

  if (selected.length === 0) {
    console.error(`no mutation matches --only=${only}`);
    process.exit(1);
  }

  console.log(`Attesting ${selected.length} mutations on the settings bridge\n`);

  backup();
  const results: Result[] = [];

  try {
    for (const [index, mutation] of selected.entries()) {
      process.stdout.write(`[${index + 1}/${selected.length}] ${mutation.id} ... `);
      const result = evaluate(mutation);
      results.push(result);
      console.log(`${result.verdict}${mutation.neutral ? ' (expected SURVIVED)' : ''}`);
      if (result.verdict === 'APPLY-FAILED') console.log(`        ${result.detail}`);
      if (result.verdict === 'KILLED' && result.failingTests.length > 0) {
        console.log(`        killed by: ${result.failingTests[0]}`);
      }
    }
  } finally {
    restore();
  }

  // ---- Report -------------------------------------------------------------
  console.log(`\n${'='.repeat(78)}`);
  console.log('ATTESTATION REPORT — settings -> AI provider bridge');
  console.log('='.repeat(78));

  const neutral = results.filter((r) => r.mutation.neutral);
  const real = results.filter((r) => !r.mutation.neutral);
  const killed = real.filter((r) => r.verdict === 'KILLED');
  const survived = real.filter((r) => r.verdict === 'SURVIVED');
  const applyFailed = results.filter((r) => r.verdict === 'APPLY-FAILED');

  console.log(`\nreal mutations: ${real.length}`);
  console.log(`  KILLED       ${killed.length}`);
  console.log(`  SURVIVED     ${survived.length}`);
  console.log(`  APPLY-FAILED ${applyFailed.length}`);

  console.log('\n--- self-check 1: neutral control (must SURVIVE) ---');
  for (const r of neutral) {
    console.log(`  ${r.verdict === 'SURVIVED' ? 'PASS' : 'FAIL'}  ${r.mutation.id}: ${r.verdict}`);
  }

  console.log('\n--- self-check 2: proof of application ---');
  console.log(`  APPLY-FAILED count: ${applyFailed.length} (never counted as survivors)`);
  for (const r of applyFailed) console.log(`    ${r.mutation.id}: ${r.detail}`);

  console.log('\n--- self-check 4: which test caught each mutation ---');
  for (const r of killed) {
    console.log(`  ${r.mutation.id}`);
    console.log(`    breaks: ${r.mutation.breaks}`);
    console.log(`    attested by: ${r.failingTests[0] ?? '(no test name parsed)'}`);
    if (r.failingTests.length > 1) {
      console.log(`    (+${r.failingTests.length - 1} more failing)`);
    }
  }

  if (survived.length > 0) {
    console.log('\n--- SURVIVORS: bugs no test detects ---');
    for (const r of survived) {
      console.log(`  ${r.mutation.id}`);
      console.log(`    undetected: ${r.mutation.breaks}`);
    }
  }

  const rate = real.length > 0 ? ((killed.length / real.length) * 100).toFixed(1) : 'n/a';
  console.log(`\nattestation rate: ${rate}%`);

  // A killed neutral control invalidates every other verdict: the suite is red
  // for reasons that have nothing to do with the mutation.
  if (!neutral.every((r) => r.verdict === 'SURVIVED')) {
    console.log('\nRESULT INVALID: the neutral control was killed.');
    process.exit(1);
  }
  if (applyFailed.length > 0) {
    console.log('\nRESULT INCOMPLETE: some mutations never applied.');
    process.exit(1);
  }
  if (survived.length > 0) {
    console.log('\nINCOMPLETE COVERAGE: a real mutation survived.');
    process.exit(1);
  }

  console.log('\nAll real mutations were detected, and the neutral control survived.');
}

main();
