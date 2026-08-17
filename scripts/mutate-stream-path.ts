/**
 * Attestation harness for the cross-package bugs of the ChatView streaming path.
 *
 * The five known bugs span three packages: two live in ChatView itself (covered
 * by scripts/mutate-agents.ts), three live in preload / main. The claim under
 * test is "each fixed bug has a regression test that goes red if the fix is
 * removed". That claim is only settled by removing the fix and observing the
 * red — which is what this does.
 *
 * Same four self-checks as mutate-agents.ts: a neutral control that must
 * survive, proof-of-application before any verdict, an APPLY-FAILED path that is
 * never conflated with SURVIVED, and named killing tests so a mutation killed by
 * an unrelated early failure is visible.
 *
 *   bun scripts/mutate-stream-path.ts
 *   bun scripts/mutate-stream-path.ts --self-test
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = join(import.meta.dir, '..');
const BACKUP_DIR = '/tmp/mutate-stream-path-backup';

const PRELOAD = 'packages/preload/src/index.ts';
const MAIN_HANDLER = 'packages/main/src/ipc/handlers/ai-stream-handler.ts';

interface Mutation {
  id: string;
  file: string;
  find: string;
  replace: string;
  /** Which of the five reported bugs this re-introduces. */
  bug: string;
  /** Vitest invocation that should detect it. */
  suite: string;
  neutral?: boolean;
}

const PRELOAD_SUITE = "bunx vitest run --project preload 2>&1";
const MAIN_SUITE = "bunx vitest run --project main src/ipc/handlers/__tests__/ai-stream-handler.test.ts 2>&1";

const MUTATIONS: Mutation[] = [
  // ---------------------------------------------------------------------------
  // Neutral control: comment-only edit in preload. Must SURVIVE.
  // ---------------------------------------------------------------------------
  {
    id: 'neutral-comment-preload',
    file: PRELOAD,
    find: '    stopStream: async (sessionId) => {',
    replace: '    // Invokes the main-process stop handler for this session.\n    stopStream: async (sessionId) => {',
    bug: 'none — neutral control',
    suite: PRELOAD_SUITE,
    neutral: true,
  },

  // ---------------------------------------------------------------------------
  // BUG 3: preload.ai.streamResponse was a no-op stub.
  // ---------------------------------------------------------------------------
  {
    id: 'bug3-streamresponse-stub',
    file: PRELOAD,
    find: '        ipcRenderer.on(channel, listener);',
    replace: '        void listener;',
    bug: 'BUG 3: streamResponse never subscribes — the no-op stub, chunks never arrive',
    suite: PRELOAD_SUITE,
  },
  {
    id: 'bug3-never-resolves',
    file: PRELOAD,
    find: '          if (chunk.type === \'done\') {\n            settled = true;\n            cleanup();\n            resolve();',
    replace: '          if (chunk.type === \'done\') {\n            settled = true;\n            cleanup();',
    bug: 'BUG 3 variant: a done chunk never settles the promise, so the caller hangs forever',
    suite: PRELOAD_SUITE,
  },

  // ---------------------------------------------------------------------------
  // BUG 1: listener leak — one orphaned IPC listener per stream.
  // ---------------------------------------------------------------------------
  {
    id: 'bug1-listener-leak',
    file: PRELOAD,
    find: '        const cleanup = () => {\n          ipcRenderer.removeListener(channel, listener);\n        };',
    replace: '        const cleanup = () => {\n          // leak: listener stays attached for the life of the window\n        };',
    bug: 'BUG 1: the per-stream IPC listener is never removed — one orphan per message',
    suite: PRELOAD_SUITE,
  },

  // ---------------------------------------------------------------------------
  // BUG 4: ai:stop-stream had no main-process handler.
  // ---------------------------------------------------------------------------
  {
    id: 'bug4-no-stop-handler',
    file: MAIN_HANDLER,
    find: '  ipcMain.handle(IPC_CHANNELS.AI_STOP_STREAM, (_event, sessionId: unknown) => {',
    replace: '  ((_unused: unknown) => undefined)((_event: unknown, sessionId: unknown) => {',
    bug: 'BUG 4: no handler registered for ai:stop-stream — the Stop button fails silently',
    suite: MAIN_SUITE,
  },
  {
    id: 'bug4-stop-does-not-abort',
    file: MAIN_HANDLER,
    find: '    abortStream(sessionId);\n    return { success: true, data: { sessionId } };',
    replace: '    return { success: true, data: { sessionId } };',
    bug: 'BUG 4 variant: the stop handler reports success without aborting anything',
    suite: MAIN_SUITE,
  },

  // ---------------------------------------------------------------------------
  // BUG 5: a cancelled stream never received a terminal chunk.
  // ---------------------------------------------------------------------------
  {
    id: 'bug5-no-terminal-chunk',
    file: MAIN_HANDLER,
    find: '    if (!stream.webContents.isDestroyed()) {\n      const chunk: StreamChunk = { type: \'done\' };\n      stream.webContents.send(`ai:stream:${sessionId}`, chunk);\n    }',
    replace: '    // no terminal chunk: the renderer promise stays pending and its listener\n    // stays attached for the life of the window',
    bug: 'BUG 5: an aborted stream sends no terminal chunk — renderer listener leaks for good',
    suite: MAIN_SUITE,
  },
  {
    id: 'bug5-destroyed-guard',
    file: MAIN_HANDLER,
    find: '    if (!stream.webContents.isDestroyed()) {',
    replace: '    if (true) {',
    bug: 'BUG 5 variant: sending to destroyed webContents (throws in production)',
    suite: MAIN_SUITE,
  },
];

type Verdict = 'KILLED' | 'SURVIVED' | 'APPLY-FAILED';

interface Result {
  mutation: Mutation;
  verdict: Verdict;
  failingTests: string[];
  detail?: string;
}

function backupPath(file: string) {
  return join(BACKUP_DIR, file.replace(/\//g, '__'));
}

function backup(file: string) {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  copyFileSync(join(REPO, file), backupPath(file));
}

function restore(file: string) {
  copyFileSync(backupPath(file), join(REPO, file));
}

/** Apply and PROVE it landed. Never lets a non-matching pattern read as SURVIVED. */
function apply(mutation: Mutation): string | null {
  const absolute = join(REPO, mutation.file);
  const before = readFileSync(absolute, 'utf8');

  const occurrences = before.split(mutation.find).length - 1;
  if (occurrences === 0) return `pattern not found in ${mutation.file}`;
  if (occurrences > 1) return `pattern not unique (${occurrences}x) in ${mutation.file}`;

  const after = before.replace(mutation.find, mutation.replace);
  if (after === before) return 'replacement identical to original';

  writeFileSync(absolute, after);

  const onDisk = readFileSync(absolute, 'utf8');
  if (onDisk === before) return 'file on disk unchanged after write';
  if (mutation.replace.length > 0 && !onDisk.includes(mutation.replace)) {
    return 'mutated text absent from disk';
  }
  return null;
}

function runSuite(command: string): { passed: boolean; failingTests: string[] } {
  let raw: string;
  let passed: boolean;
  try {
    raw = execSync(command, { cwd: REPO, encoding: 'utf8', stdio: 'pipe', timeout: 300_000 });
    passed = true;
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    raw = (e.stdout ?? '') + (e.stderr ?? '');
    passed = false;
  }

  const failingTests = Array.from(
    new Set(
      raw
        .split('\n')
        .filter((line) => /^\s*(×|✗)/.test(line))
        .map((line) => line.replace(/^\s*(×|✗)\s*/, '').replace(/\s+\d+ms\s*$/, '').trim())
    )
  );

  return { passed, failingTests };
}

function evaluate(mutation: Mutation): Result {
  backup(mutation.file);
  const applyError = apply(mutation);
  if (applyError) {
    restore(mutation.file);
    return { mutation, verdict: 'APPLY-FAILED', failingTests: [], detail: applyError };
  }
  try {
    const { passed, failingTests } = runSuite(mutation.suite);
    return { mutation, verdict: passed ? 'SURVIVED' : 'KILLED', failingTests };
  } finally {
    restore(mutation.file);
  }
}

function selfTest(): number {
  console.log('=== SELF-TEST: APPLY-FAILED detection (cross-package harness) ===\n');
  const cases: Array<{ name: string; mutation: Mutation }> = [
    {
      name: 'pattern absent from the file',
      mutation: {
        id: 'st-absent',
        file: PRELOAD,
        find: 'nonexistent_marker_qqq_12345',
        replace: 'x',
        bug: 'self-test',
        suite: PRELOAD_SUITE,
      },
    },
    {
      name: 'right code, wrong indentation',
      mutation: {
        id: 'st-indent',
        file: PRELOAD,
        // Real line has 8 leading spaces; 4 must not match.
        find: '    ipcRenderer.on(channel, listener);',
        replace: '    void listener;',
        bug: 'self-test',
        suite: PRELOAD_SUITE,
      },
    },
    {
      name: 'non-unique pattern',
      mutation: {
        id: 'st-nonunique',
        file: MAIN_HANDLER,
        find: 'stream',
        replace: 'strem',
        bug: 'self-test',
        suite: MAIN_SUITE,
      },
    },
  ];

  let failures = 0;
  for (const { name, mutation } of cases) {
    backup(mutation.file);
    const error = apply(mutation);
    restore(mutation.file);
    const ok = error !== null;
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    console.log(`      -> ${ok ? `APPLY-FAILED: ${error}` : 'wrongly reported success'}\n`);
  }

  // Positive control: a correct mutation must apply and be verified on disk.
  const positive = MUTATIONS.find((m) => m.id === 'bug3-streamresponse-stub')!;
  backup(positive.file);
  const positiveError = apply(positive);
  const landed = readFileSync(join(REPO, positive.file), 'utf8').includes('void listener;');
  restore(positive.file);
  const restored = !readFileSync(join(REPO, positive.file), 'utf8').includes('void listener;');

  const positiveOk = positiveError === null && landed;
  if (!positiveOk) failures += 1;
  console.log(`${positiveOk ? 'PASS' : 'FAIL'}  a correct mutation applies and is verified on disk`);
  console.log(`      -> ${positiveError ?? 'applied and confirmed present'}\n`);
  if (!restored) failures += 1;
  console.log(`${restored ? 'PASS' : 'FAIL'}  the file is restored afterwards\n`);

  console.log(failures === 0 ? 'SELF-TEST: all checks passed' : `SELF-TEST: ${failures} FAILED`);
  return failures === 0 ? 0 : 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit(selfTest());

  const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
  const set = only ? MUTATIONS.filter((m) => m.id === only) : MUTATIONS;

  console.log(`Attesting ${set.length} mutations across preload + main\n`);

  const results: Result[] = [];
  for (const [i, mutation] of set.entries()) {
    process.stdout.write(`[${i + 1}/${set.length}] ${mutation.id} ... `);
    const result = evaluate(mutation);
    results.push(result);
    console.log(`${result.verdict}${mutation.neutral ? ' (expected SURVIVED)' : ''}`);
    if (result.detail) console.log(`        ${result.detail}`);
    if (result.verdict === 'KILLED') {
      console.log(`        bug: ${mutation.bug}`);
      console.log(`        killed by: ${result.failingTests.slice(0, 2).join(' | ')}`);
      if (result.failingTests.length > 2) {
        console.log(`        (+${result.failingTests.length - 2} more)`);
      }
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log('ATTESTATION REPORT — cross-package stream path');
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

  console.log('\n--- self-check 1: neutral control ---');
  for (const r of neutral) {
    console.log(`  ${r.verdict === 'SURVIVED' ? 'PASS' : 'FAIL'}  ${r.mutation.id}: ${r.verdict}`);
  }

  console.log('\n--- self-check 2: proof of application ---');
  console.log(`  APPLY-FAILED count: ${applyFailed.length} (never counted as survivors)`);
  for (const r of applyFailed) console.log(`    ${r.mutation.id}: ${r.detail}`);

  if (survived.length > 0) {
    console.log('\n--- SURVIVORS ---');
    for (const r of survived) {
      console.log(`  ${r.mutation.id}`);
      console.log(`    bug left undetected: ${r.mutation.bug}`);
    }
  }

  console.log('\n--- bug -> attesting test ---');
  for (const r of killed) {
    console.log(`  ${r.mutation.bug}`);
    console.log(`    attested by: ${r.failingTests[0] ?? '(unnamed)'}`);
  }

  const score = real.length > 0 ? ((killed.length / real.length) * 100).toFixed(1) : 'n/a';
  console.log(`\nattestation rate: ${score}%`);

  if (!neutral.every((r) => r.verdict === 'SURVIVED')) {
    console.log('\nRESULT INVALID: neutral control killed.');
    process.exit(1);
  }
  if (applyFailed.length > 0) {
    console.log('\nWARNING: some mutations never applied.');
    process.exit(1);
  }
}

main();
