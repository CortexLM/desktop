/**
 * Mutation harness for `packages/renderer/src/views/agents/`.
 *
 * A green suite proves nothing on its own: it is indistinguishable from a suite
 * whose assertions never touch the code. This applies a list of source mutations
 * one at a time and records whether the suite notices.
 *
 * Four self-checks, each answering a way this harness could lie:
 *
 *   1. NEUTRAL CONTROL — a mutation that changes only a comment must SURVIVE. If
 *      it is reported killed, the suite is failing on noise (or is flaky) and no
 *      other result from this run can be trusted.
 *
 *   2. PROOF OF APPLICATION — every mutation re-reads the file and asserts the
 *      content actually changed, and that the mutated text is present. A previous
 *      harness reported SURVIVED for a mutation whose pattern never matched
 *      (indentation assumed 10 spaces, actual 12), making a hole and a no-op
 *      indistinguishable. A non-matching pattern is APPLY-FAILED, never SURVIVED.
 *
 *   3. ERROR PATH — `--self-test` deliberately injects a pattern that is absent
 *      and one whose whitespace is wrong, and requires both to report
 *      APPLY-FAILED. This tests the harness's own failure detection.
 *
 *   4. TEST-ORDER INDEPENDENCE — each mutation runs the whole zone suite, and the
 *      report names which tests failed. A mutation "killed" only by an early
 *      failure that skips later tests is visible because the killing test is
 *      named. (No `describe.serial` is used in this zone's suites; that pattern
 *      let one early failure skip the detector that was supposed to catch the
 *      mutation, so the mutation was killed by the wrong test.)
 *
 * Usage:
 *   bun scripts/mutate-agents.ts            # run the mutation set
 *   bun scripts/mutate-agents.ts --self-test # prove APPLY-FAILED detection works
 *   bun scripts/mutate-agents.ts --only=<id>
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = join(import.meta.dir, '..');
const ZONE = 'packages/renderer/src/views/agents';
const BACKUP_DIR = '/tmp/mutate-agents-backup';

interface Mutation {
  id: string;
  file: string;
  /** Exact source text to replace. Must be unique in the file. */
  find: string;
  /** Replacement text. */
  replace: string;
  /** What regression this mutation simulates. */
  simulates: string;
  /** A neutral mutation is expected to survive; anything else must be killed. */
  neutral?: boolean;
}

const MUTATIONS: Mutation[] = [
  // -------------------------------------------------------------------------
  // 1. NEUTRAL CONTROL — comment-only change, must SURVIVE.
  // -------------------------------------------------------------------------
  {
    id: 'neutral-comment',
    file: `${ZONE}/SessionList.tsx`,
    find: '/** Bucket used when a row carries no usable `updated_at`. */',
    replace: '/** Bucket label applied when a row has no usable `updated_at` value. */',
    simulates: 'nothing — neutral control; a kill here means the harness kills noise',
    neutral: true,
  },

  // -------------------------------------------------------------------------
  // SessionList — date grouping
  // -------------------------------------------------------------------------
  {
    id: 'sessionlist-nan-fallthrough',
    file: `${ZONE}/SessionList.tsx`,
    find: "  if (!isUsableTimestamp(timestamp)) return UNKNOWN_DATE_GROUP;",
    replace: "  if (false) return UNKNOWN_DATE_GROUP;",
    simulates: 'removal of the unusable-timestamp guard: undated sessions fall through to Older',
  },
  {
    id: 'sessionlist-elapsed-not-calendar',
    file: `${ZONE}/SessionList.tsx`,
    find: '  if (timestamp >= startOfToday) return \'Today\';',
    replace: "  if (now - timestamp < DAY_MS) return 'Today';",
    simulates: 'reverting Today to an elapsed-time rule: 23:00 yesterday reads as Today at 00:30',
  },
  {
    id: 'sessionlist-yesterday-boundary',
    file: `${ZONE}/SessionList.tsx`,
    find: "  if (timestamp >= startOfToday - DAY_MS) return 'Yesterday';",
    replace: "  if (timestamp >= startOfToday - 2 * DAY_MS) return 'Yesterday';",
    simulates: 'off-by-one day in the Yesterday boundary',
  },
  {
    id: 'sessionlist-week-boundary',
    file: `${ZONE}/SessionList.tsx`,
    find: "  if (timestamp >= startOfToday - 7 * DAY_MS) return 'This Week';",
    replace: "  if (timestamp >= startOfToday - 6 * DAY_MS) return 'This Week';",
    simulates: 'off-by-one in the week boundary',
  },
  {
    id: 'sessionlist-relative-unknown',
    file: `${ZONE}/SessionList.tsx`,
    find: "  if (!isUsableTimestamp(timestamp)) return 'Unknown';",
    replace: "  if (!isUsableTimestamp(timestamp)) return new Date(timestamp as number).toLocaleDateString();",
    simulates: 'reverting the relative-time guard: renders the literal text "Invalid Date"',
  },
  {
    id: 'sessionlist-future-negative',
    file: `${ZONE}/SessionList.tsx`,
    find: "  if (diff < 0) return 'Just now';",
    replace: '  if (false) return \'Just now\';',
    simulates: 'removal of the clock-skew guard: a future timestamp renders a negative age',
  },
  {
    id: 'sessionlist-group-order',
    file: `${ZONE}/SessionList.tsx`,
    find: '  for (const label of GROUP_ORDER) {\n    if (groups[label]) ordered[label] = groups[label];\n  }\n  return ordered;',
    replace: '  void GROUP_ORDER;\n  void ordered;\n  return groups;',
    simulates: 'reverting to insertion order: bucket order becomes a side effect of the SQL',
  },
  {
    id: 'sessionlist-finite-check',
    file: `${ZONE}/SessionList.tsx`,
    find: "  return typeof value === 'number' && Number.isFinite(value);",
    replace: "  return typeof value === 'number';",
    simulates: 'accepting NaN/Infinity as a usable timestamp',
  },

  // -------------------------------------------------------------------------
  // UsageTracking — nullable SQL aggregates
  // -------------------------------------------------------------------------
  {
    id: 'usage-null-coercion',
    file: `${ZONE}/UsageTracking.tsx`,
    find: "  return typeof value === 'number' && Number.isFinite(value) ? value : 0;",
    replace: '  return value as number;',
    simulates: 'reverting the null coercion: `null.toFixed(2)` throws and blanks the dashboard',
  },
  {
    id: 'usage-provider-cost',
    file: `${ZONE}/UsageTracking.tsx`,
    find: '            const cost = toFiniteNumber(row.cost);\n            return {\n              provider: row.provider ?? \'Unknown\',',
    replace: '            const cost = row.cost as number;\n            return {\n              provider: row.provider ?? \'Unknown\',',
    simulates: 'a null provider cost reaching toFixed() unguarded',
  },
  {
    id: 'usage-percentage-divzero',
    file: `${ZONE}/UsageTracking.tsx`,
    find: '              percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,\n            };\n          }),\n          byModel:',
    replace: '              percentage: (cost / totalCost) * 100,\n            };\n          }),\n          byModel:',
    simulates: 'removal of the divide-by-zero guard: percentages render as NaN%',
  },
  {
    id: 'usage-timeline-coercion',
    file: `${ZONE}/UsageTracking.tsx`,
    find: '          timeline: timelineResponse.data.rows.map((row) => ({\n            date: row.date ?? \'Unknown\',\n            cost: toFiniteNumber(row.cost),',
    replace: '          timeline: timelineResponse.data.rows.map((row) => ({\n            date: row.date ?? \'Unknown\',\n            cost: row.cost as number,',
    simulates: 'a null timeline cost reaching the chart tooltip’s toFixed()',
  },
  {
    id: 'usage-range-all-window',
    file: `${ZONE}/UsageTracking.tsx`,
    find: "      const startTime = timeRange === 'all' ? 0 : now - rangeMs;",
    replace: '      const startTime = now - rangeMs;',
    simulates: 'dropping the All-Time special case: startTime becomes a large negative number',
  },
  {
    id: 'usage-week-window',
    file: `${ZONE}/UsageTracking.tsx`,
    find: "    case 'week':\n      return 7 * dayMs;",
    replace: "    case 'week':\n      return 8 * dayMs;",
    simulates: 'a wrong week window in the range selector',
  },

  // -------------------------------------------------------------------------
  // AgentDetail — derived metrics
  // -------------------------------------------------------------------------
  {
    id: 'agentdetail-duration-guard',
    file: `${ZONE}/AgentDetail.tsx`,
    find: '  if (!bothUsable) return 0;\n\n  const duration = maxTime - minTime;\n  return duration > 0 ? duration : 0;',
    replace: '  const duration = (maxTime as number) - (minTime as number);\n  return duration;',
    simulates: 'reverting the duration guard: NaN and epoch-sized/negative durations render',
  },
  {
    id: 'agentdetail-duration-negative',
    file: `${ZONE}/AgentDetail.tsx`,
    find: '  return duration > 0 ? duration : 0;',
    replace: '  return duration;',
    simulates: 'allowing a negative duration through, which formats as "-1s"',
  },
  {
    id: 'agentdetail-entry-tokens',
    file: `${ZONE}/AgentDetail.tsx`,
    find: '  const total = toFiniteNumber(input as NullableNumber) + toFiniteNumber(output as NullableNumber);\n  return total > 0 ? total : undefined;',
    replace: '  const total = (input as number) + (output as number);\n  return total;',
    simulates: 'reverting the token sum: a half-recorded token count is silently dropped',
  },
  {
    id: 'agentdetail-metadata-throw',
    file: `${ZONE}/AgentDetail.tsx`,
    find: '  } catch {\n    return {};\n  }',
    replace: '  } catch (error) {\n    throw error;\n  }',
    simulates: 'reverting the metadata guard: one malformed row blanks the entire view',
  },
  {
    id: 'agentdetail-metadata-array',
    file: `${ZONE}/AgentDetail.tsx`,
    find: "    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)",
    replace: "    return typeof parsed === 'object' && parsed !== null",
    simulates: 'accepting a JSON array as metadata, so every field reads as missing',
  },
  {
    id: 'agentdetail-timestamp-guard',
    file: `${ZONE}/AgentDetail.tsx`,
    find: "  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return 'Unknown date';",
    replace: '  if (false) return \'Unknown date\';',
    simulates: 'reverting the timestamp guard: renders the literal text "Invalid Date"',
  },
  {
    id: 'agentdetail-formatduration-coercion',
    file: `${ZONE}/AgentDetail.tsx`,
    find: '  const total = toFiniteNumber(ms);\n  const seconds = Math.floor(total / 1000);',
    replace: '  const seconds = Math.floor(ms / 1000);',
    simulates: 'removing the last-line NaN coercion: renders the literal text "NaNs"',
  },
  {
    id: 'agentdetail-hours-branch',
    file: `${ZONE}/AgentDetail.tsx`,
    find: '  if (hours > 0) return `${hours}h ${minutes % 60}m`;\n  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;\n  return `${seconds}s`;\n}',
    replace: '  if (hours > 0) return `${hours}h ${minutes}m`;\n  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;\n  return `${seconds}s`;\n}',
    simulates: 'dropping the modulo on minutes: a 90-minute duration reads "1h 90m"',
  },

  // -------------------------------------------------------------------------
  // ChatView — the fixed runtime bugs
  // -------------------------------------------------------------------------
  {
    id: 'chatview-abort-on-unmount',
    file: `${ZONE}/ChatView.tsx`,
    find: '    return () => {\n      abortControllerRef.current?.abort();\n      abortControllerRef.current = null;\n    };',
    replace: '    return () => {\n      abortControllerRef.current = null;\n    };',
    simulates: 'BUG: AbortController never aborted on unmount — request outlives the view',
  },
  {
    id: 'chatview-abort-on-stop',
    file: `${ZONE}/ChatView.tsx`,
    find: '    if (abortControllerRef.current) {\n      abortControllerRef.current.abort();\n      abortControllerRef.current = null;\n    }',
    replace: '    if (abortControllerRef.current) {\n      abortControllerRef.current = null;\n    }',
    simulates: 'BUG: Stop button no longer aborts the in-flight controller',
  },
  {
    id: 'chatview-stop-ordering',
    file: `${ZONE}/ChatView.tsx`,
    find: '    setIsStreaming(false);\n    setStreamingMessageId(null);\n    setMessages((prev) =>\n      prev.map((msg) => (msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg))\n    );\n\n    try {\n      await window.cortex.ai.stopStream(sessionId);',
    replace: '    try {\n      await window.cortex.ai.stopStream(sessionId);\n      setIsStreaming(false);\n      setStreamingMessageId(null);\n      setMessages((prev) =>\n        prev.map((msg) => (msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg))\n      );',
    simulates: 'BUG: UI reset sequenced after the IPC call — a failing stop leaves the view stuck',
  },
  {
    id: 'chatview-stream-callback',
    file: `${ZONE}/ChatView.tsx`,
    find: "              if (chunk.type === 'chunk' && chunk.content) {",
    replace: "              if (chunk.type === 'chunk' && false) {",
    simulates: 'BUG: chunks never applied — the stub streamResponse that rendered nothing',
  },
  {
    id: 'chatview-streaming-flag-reset',
    file: `${ZONE}/ChatView.tsx`,
    find: '      setMessages((prev) =>\n        prev.map((msg) =>\n          msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg\n        )\n      );',
    replace: '      setMessages((prev) => prev);',
    simulates: 'a resolved stream leaving a permanent blinking caret in the transcript',
  },
  {
    id: 'chatview-abort-not-a-failure',
    file: `${ZONE}/ChatView.tsx`,
    find: "      const wasAborted = error instanceof DOMException && error.name === 'AbortError';",
    replace: '      const wasAborted = false;',
    simulates: 'treating a user cancellation as a provider failure in the transcript',
  },
  {
    id: 'chatview-parse-language-default',
    file: `${ZONE}/ChatView.tsx`,
    find: "      language: match[1] || 'text',",
    replace: '      language: match[1] as string,',
    simulates: 'an unlabelled fence losing its plain-text fallback language',
  },
  {
    id: 'chatview-parse-lastindex',
    file: `${ZONE}/ChatView.tsx`,
    find: "  const pattern = new RegExp(CODE_BLOCK_PATTERN.source, 'g');",
    replace: '  const pattern = CODE_BLOCK_PATTERN;',
    simulates: 'sharing a /g regex across calls, so lastIndex leaks between messages',
  },
  {
    id: 'chatview-memo-content',
    file: `${ZONE}/ChatView.tsx`,
    find: '    prev.message.content === next.message.content &&',
    replace: '',
    simulates: 'a memo comparator that ignores content, so streamed text stops updating',
  },
];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Verdict = 'KILLED' | 'SURVIVED' | 'APPLY-FAILED';

interface Result {
  mutation: Mutation;
  verdict: Verdict;
  failingTests: string[];
  detail?: string;
}

function backupPath(file: string): string {
  return join(BACKUP_DIR, file.replace(/\//g, '__'));
}

function backup(file: string) {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  copyFileSync(join(REPO, file), backupPath(file));
}

function restore(file: string) {
  copyFileSync(backupPath(file), join(REPO, file));
}

/**
 * Apply a mutation and PROVE it landed.
 *
 * Returns null on success, or a reason string. Self-check #2: a pattern that
 * does not match, or an edit that leaves the file byte-identical, is reported as
 * APPLY-FAILED — never allowed to masquerade as SURVIVED.
 */
function apply(mutation: Mutation): string | null {
  const absolute = join(REPO, mutation.file);
  const before = readFileSync(absolute, 'utf8');

  const occurrences = before.split(mutation.find).length - 1;
  if (occurrences === 0) {
    return `pattern not found in ${mutation.file}`;
  }
  if (occurrences > 1) {
    return `pattern is not unique (${occurrences} occurrences) in ${mutation.file}`;
  }

  const after = before.replace(mutation.find, mutation.replace);

  if (after === before) {
    return 'replacement produced an identical file (find === replace?)';
  }

  writeFileSync(absolute, after);

  // Re-read from disk: proves the write landed, not just that we built a string.
  const onDisk = readFileSync(absolute, 'utf8');
  if (onDisk === before) {
    return 'file on disk unchanged after write';
  }
  if (mutation.replace.length > 0 && !onDisk.includes(mutation.replace)) {
    return 'mutated text absent from the file on disk';
  }
  if (onDisk.includes(mutation.find)) {
    return 'original text still present on disk after mutation';
  }

  return null;
}

/** Run the zone suite; return the names of failing tests. */
function runSuite(): { passed: boolean; failingTests: string[]; raw: string } {
  let raw: string;
  let passed: boolean;
  try {
    raw = execSync(
      'bunx vitest run --project renderer src/views/agents --reporter=default 2>&1',
      { cwd: REPO, encoding: 'utf8', stdio: 'pipe', timeout: 300_000 }
    );
    passed = true;
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    raw = (e.stdout ?? '') + (e.stderr ?? '');
    passed = false;
  }

  // Self-check #4: name the killing tests, so a mutation killed by an unrelated
  // early failure (rather than by its intended detector) is visible.
  const failingTests = Array.from(
    new Set(
      raw
        .split('\n')
        .filter((line) => /^\s*(×|✗)/.test(line))
        .map((line) => line.replace(/^\s*(×|✗)\s*/, '').replace(/\s+\d+ms\s*$/, '').trim())
    )
  );

  return { passed, failingTests, raw };
}

function evaluate(mutation: Mutation): Result {
  backup(mutation.file);

  const applyError = apply(mutation);
  if (applyError) {
    restore(mutation.file);
    return { mutation, verdict: 'APPLY-FAILED', failingTests: [], detail: applyError };
  }

  try {
    const { passed, failingTests } = runSuite();
    return {
      mutation,
      verdict: passed ? 'SURVIVED' : 'KILLED',
      failingTests,
    };
  } finally {
    restore(mutation.file);
  }
}

/**
 * Self-check #3: prove the harness reports APPLY-FAILED rather than SURVIVED
 * when a mutation does not actually land.
 */
function selfTest(): number {
  console.log('=== HARNESS SELF-TEST: APPLY-FAILED detection ===\n');

  const cases: Array<{ name: string; mutation: Mutation }> = [
    {
      name: 'pattern absent from the file',
      mutation: {
        id: 'selftest-absent',
        file: `${ZONE}/SessionList.tsx`,
        find: 'this_exact_string_does_not_exist_anywhere_in_the_file_12345',
        replace: 'irrelevant',
        simulates: 'self-test: a pattern that matches nothing',
      },
    },
    {
      name: 'correct code, wrong indentation (2 spaces instead of the real 2)',
      mutation: {
        id: 'selftest-bad-indent',
        file: `${ZONE}/SessionList.tsx`,
        // The real line has exactly 2 leading spaces; 6 must not match.
        find: '      if (!isUsableTimestamp(timestamp)) return UNKNOWN_DATE_GROUP;',
        replace: '      return UNKNOWN_DATE_GROUP;',
        simulates: 'self-test: right code, wrong leading whitespace',
      },
    },
    {
      name: 'non-unique pattern',
      mutation: {
        id: 'selftest-nonunique',
        file: `${ZONE}/SessionList.tsx`,
        find: 'const',
        replace: 'let',
        simulates: 'self-test: a pattern occurring many times',
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
    console.log(`      -> ${ok ? `APPLY-FAILED: ${error}` : 'reported success, but should have failed'}\n`);
  }

  // Also prove a well-formed mutation *does* apply, so the checks above are not
  // passing simply because `apply` always fails.
  const positive: Mutation = {
    id: 'selftest-positive',
    file: `${ZONE}/SessionList.tsx`,
    find: '  if (!isUsableTimestamp(timestamp)) return UNKNOWN_DATE_GROUP;',
    replace: '  if (false) return UNKNOWN_DATE_GROUP;',
    simulates: 'self-test: a correctly-specified mutation',
  };
  backup(positive.file);
  const positiveError = apply(positive);
  const applied = readFileSync(join(REPO, positive.file), 'utf8').includes(
    'if (false) return UNKNOWN_DATE_GROUP;'
  );
  restore(positive.file);

  const positiveOk = positiveError === null && applied;
  if (!positiveOk) failures += 1;
  console.log(`${positiveOk ? 'PASS' : 'FAIL'}  a correct mutation applies and is verified on disk`);
  console.log(`      -> ${positiveError ?? 'applied, and confirmed present on disk'}\n`);

  // And prove the file was restored, so a self-test run cannot leave the tree dirty.
  const restored = !readFileSync(join(REPO, positive.file), 'utf8').includes(
    'if (false) return UNKNOWN_DATE_GROUP;'
  );
  if (!restored) failures += 1;
  console.log(`${restored ? 'PASS' : 'FAIL'}  the file is restored after the mutation\n`);

  console.log(failures === 0 ? 'SELF-TEST: all checks passed' : `SELF-TEST: ${failures} FAILED`);
  return failures === 0 ? 0 : 1;
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--self-test')) {
    process.exit(selfTest());
  }

  const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
  const set = only ? MUTATIONS.filter((m) => m.id === only) : MUTATIONS;

  if (set.length === 0) {
    console.error(`no mutation matched --only=${only}`);
    process.exit(1);
  }

  console.log(`Running ${set.length} mutations against ${ZONE}\n`);

  const results: Result[] = [];
  for (const [index, mutation] of set.entries()) {
    process.stdout.write(`[${index + 1}/${set.length}] ${mutation.id} ... `);
    const result = evaluate(mutation);
    results.push(result);
    const expectation = mutation.neutral ? ' (expected SURVIVED)' : '';
    console.log(`${result.verdict}${expectation}`);
    if (result.detail) console.log(`        ${result.detail}`);
    if (result.verdict === 'KILLED' && result.failingTests.length > 0) {
      console.log(`        killed by: ${result.failingTests.slice(0, 3).join(' | ')}`);
      if (result.failingTests.length > 3) {
        console.log(`        (+${result.failingTests.length - 3} more failing tests)`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(78));
  console.log('MUTATION REPORT');
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
    const ok = r.verdict === 'SURVIVED';
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.mutation.id}: ${r.verdict}`);
    if (!ok) {
      console.log('        A neutral mutation was killed. The suite is failing on noise or is');
      console.log('        flaky; no other verdict in this run can be trusted.');
    }
  }

  console.log('\n--- self-check 2: proof of application ---');
  console.log(`  every applied mutation was re-read from disk and verified changed.`);
  console.log(`  APPLY-FAILED count: ${applyFailed.length} (these are NOT counted as survivors)`);
  for (const r of applyFailed) {
    console.log(`    ${r.mutation.id}: ${r.detail}`);
  }

  if (survived.length > 0) {
    console.log('\n--- SURVIVORS (each needs a hole/equivalent verdict) ---');
    for (const r of survived) {
      console.log(`\n  ${r.mutation.id}`);
      console.log(`    file:      ${r.mutation.file}`);
      console.log(`    simulates: ${r.mutation.simulates}`);
      console.log(`    -> classify: real coverage hole, or equivalent mutant?`);
    }
  }

  console.log('\n--- self-check 4: which test killed each mutation ---');
  for (const r of killed) {
    console.log(`  ${r.mutation.id}`);
    console.log(`    ${r.failingTests.length} failing test(s): ${r.failingTests.slice(0, 2).join(' | ')}`);
  }

  const score = real.length > 0 ? ((killed.length / real.length) * 100).toFixed(1) : 'n/a';
  console.log(`\nmutation score (excluding neutral + apply-failed): ${score}%`);

  const neutralOk = neutral.every((r) => r.verdict === 'SURVIVED');
  if (!neutralOk) {
    console.log('\nRESULT INVALID: neutral control was killed.');
    process.exit(1);
  }
  if (applyFailed.length > 0) {
    console.log('\nWARNING: some mutations never applied; their patterns need fixing.');
    process.exit(1);
  }
}

main();
