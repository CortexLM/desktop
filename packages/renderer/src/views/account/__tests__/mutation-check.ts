/**
 * Mutation check for the account-views suite.
 *
 * Coverage cannot tell a test that asserts behaviour from one that merely
 * executes a line, so each mutation below breaks a real property of the views
 * and the suite must fail. Design notes, each from a defect actually observed
 * in this repo's harnesses:
 *
 *  1. A NEUTRAL control (a comment reword) must SURVIVE. If it dies, the suite
 *     is keyed to noise and every other result is meaningless.
 *  2. Every mutation PROVES it changed the file (byte comparison before/after).
 *     A harness once reported SURVIVED for a regex that matched nothing —
 *     it had assumed 10-space indentation where the file had 12 — so an
 *     unapplied mutation is reported APPLY-FAILED, never SURVIVED.
 *  3. Non-unique patterns are rejected, so a mutation cannot silently hit a
 *     different line than intended.
 *  4. Vitest 4 has no `--reporter=basic`; the exit code is what is trusted here.
 *
 * Usage: bun packages/renderer/src/views/account/__tests__/mutation-check.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '../../../../../..');
const DIR = 'packages/renderer/src/views/account';

interface Mutation {
  name: string;
  file: string;
  find: string;
  replace: string;
  /** A neutral mutation must survive; a real one must be killed. */
  neutral?: boolean;
  /**
   * A mutation proven by measurement to produce identical behaviour. Expected
   * to survive, and its survival is not a coverage gap. Must carry the
   * measurement in a comment — "probably equivalent" is not a verdict.
   */
  equivalent?: boolean;
}

const MUTATIONS: Mutation[] = [
  // --- Control: must SURVIVE -------------------------------------------------
  {
    name: 'NEUTRAL: reword a comment',
    file: `${DIR}/DemoNotice.tsx`,
    find: ' * Honest "not functional" banner for the account views.',
    replace: ' * Banner marking the account views as not functional.',
    neutral: true,
  },

  // --- Real mutations: must be KILLED ---------------------------------------
  {
    name: 'DemoNotice: drop the role="status"',
    file: `${DIR}/DemoNotice.tsx`,
    find: '    role="status"',
    replace: '    role="note"',
  },
  {
    // EQUIVALENT MUTANT, measured — not a coverage gap.
    // lucide-react already emits aria-hidden="true" on every icon it renders.
    // Probed 2026-08-17 by rendering a bare `<Info className="w-5 h-5" />`:
    //   aria-hidden="true" was present with no such prop passed.
    // So removing the explicit prop leaves the DOM byte-identical and no test
    // can distinguish it. The explicit prop is kept in the source as intent,
    // and the suite's assertion on it is documented as pinning the rendered
    // result (lucide's default), not this file's own behaviour.
    name: 'DemoNotice: remove explicit aria-hidden (equivalent: lucide default)',
    file: `${DIR}/DemoNotice.tsx`,
    find: 'aria-hidden="true" />\n    <div className="flex-1">',
    replace: '/>\n    <div className="flex-1">',
    equivalent: true,
  },
  {
    name: 'DemoNotice: render `undefined` when no alternative is given',
    file: `${DIR}/DemoNotice.tsx`,
    find: "        {alternative ? ` ${alternative}` : ''}",
    replace: '        {` ${alternative}`}',
  },
  {
    name: 'DemoNotice: drop the feature name, leaving an unexplained banner',
    file: `${DIR}/DemoNotice.tsx`,
    find: '        Cortex has no {feature}. This screen is an unfinished interface, not a view of your',
    replace: '        This screen is an unfinished interface, not a view of your',
  },
  {
    name: 'BillingView: reinstate a fabricated paid invoice',
    file: `${DIR}/BillingView.tsx`,
    find: '          reason="No invoices exist. Cortex does not bill for usage, so there is nothing to list or download."',
    replace: '          reason="inv-001 — $29.00 — paid"',
  },
  {
    name: 'BillingView: reinstate a fabricated saved card',
    file: `${DIR}/BillingView.tsx`,
    find: '          reason="No payment methods can be stored. Cortex does not process payments and is not connected to a payment provider."',
    replace: '          reason="Mastercard •••• 5555"',
  },
  {
    name: 'BillingView: blank the usage reason (empty panel, no explanation)',
    file: `${DIR}/BillingView.tsx`,
    find: '          reason="There are no plans or quotas to report against. Cortex does not meter usage or enforce limits."',
    replace: '          reason=""',
  },
  {
    name: 'BillingView: drop the pointer to the real usage feature',
    file: `${DIR}/BillingView.tsx`,
    find: '          alternative="For real token and cost usage measured from your local sessions, use the Usage view under Agents."',
    replace: '',
  },
  {
    name: 'BillingView: stop rendering the reason inside the empty section',
    file: `${DIR}/BillingView.tsx`,
    find: '      <p className="text-sm text-text-secondary">{reason}</p>',
    replace: '      <p className="text-sm text-text-secondary" />',
  },
  {
    name: 'TeamView: reinstate a fabricated teammate',
    file: `${DIR}/TeamView.tsx`,
    find: '              There are no team members to show. Cortex has no accounts or sign-in, so it has',
    replace: '              John Doe (owner). Cortex has no accounts or sign-in, so it has',
  },
  {
    name: 'TeamView: claim permissions are enforced',
    file: `${DIR}/TeamView.tsx`,
    find: '              No permissions are enforced. Cortex runs locally with the privileges of the user',
    replace: '              Permissions are applied per role. Cortex runs locally with the privileges of the user',
  },
  {
    name: 'ProfileView: reinstate the invented signed-in identity',
    file: `${DIR}/ProfileView.tsx`,
    find: '                There is no profile to edit. Cortex runs locally and has no account system, so',
    replace: '                Signed in as John Doe (john.doe@example.com). Cortex has no account system, so',
  },
  {
    name: 'ProfileView: reinstate an input that discards its value',
    file: `${DIR}/ProfileView.tsx`,
    find: '            <h3 className="text-sm font-semibold text-text">Identity</h3>',
    replace:
      '            <h3 className="text-sm font-semibold text-text">Identity</h3>\n            <input type="text" placeholder="Full name" />',
  },
  {
    name: 'ProfileView: reinstate a Save button with no write path',
    file: `${DIR}/ProfileView.tsx`,
    find: '          <DemoNotice feature="accounts or sign-in" />',
    replace:
      '          <DemoNotice feature="accounts or sign-in" />\n          <button type="button">Save Changes</button>',
  },
  {
    name: 'ProfileView: stop pointing preferences at Settings',
    file: `${DIR}/ProfileView.tsx`,
    find: '                Theme, language, and keyboard shortcuts are configured in Settings, which is',
    replace: '                Theme, language, and keyboard shortcuts are configured elsewhere, which is',
  },
];

function runSuite(): boolean {
  const r = spawnSync(
    'bunx',
    ['vitest', 'run', `${DIR}/__tests__/account-views.test.tsx`],
    { cwd: ROOT, encoding: 'utf8' }
  );
  // Trust the exit code: 0 = suite green.
  return r.status === 0;
}

function main(): void {
  // Sanity: the suite must be green before any mutation, or every result is
  // "killed" for the wrong reason.
  if (!runSuite()) {
    console.error('BASELINE FAILED — suite is not green before mutating. Aborting.');
    process.exit(2);
  }
  console.log('baseline: green\n');

  const results: Array<{ name: string; verdict: string }> = [];

  for (const m of MUTATIONS) {
    const path = resolve(ROOT, m.file);
    const original = readFileSync(path, 'utf8');

    const occurrences = original.split(m.find).length - 1;
    if (occurrences !== 1) {
      results.push({
        name: m.name,
        verdict: `APPLY-FAILED (pattern found ${occurrences}x, need exactly 1)`,
      });
      continue;
    }

    const mutated = original.replace(m.find, m.replace);
    if (mutated === original) {
      results.push({ name: m.name, verdict: 'APPLY-FAILED (no byte changed)' });
      continue;
    }

    writeFileSync(path, mutated);
    let green: boolean;
    try {
      green = runSuite();
    } finally {
      writeFileSync(path, original);
    }

    const shouldSurvive = m.neutral === true || m.equivalent === true;
    const expected = shouldSurvive ? green : !green;
    const verdict = green ? 'SURVIVED' : 'KILLED';
    results.push({
      name: m.name,
      verdict: `${verdict} ${expected ? '(expected)' : '(UNEXPECTED)'}`,
    });
  }

  console.log('results:');
  for (const r of results) console.log(`  ${r.verdict.padEnd(28)} ${r.name}`);

  const bad = results.filter((r) => r.verdict.includes('UNEXPECTED') || r.verdict.includes('APPLY-FAILED'));
  console.log(`\n${results.length - bad.length}/${results.length} as expected`);
  if (bad.length > 0) process.exit(1);
}

main();
