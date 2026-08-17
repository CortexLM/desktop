/**
 * Verifies `better-sqlite3` actually loads in BOTH runtimes that use it.
 *
 * This exists because the failure mode is quiet. When the addon's ABI does not
 * match Electron's, the main process catches the error and logs it — the app
 * still boots, the window still opens, and E2E tests still pass. What breaks is
 * everything behind the database: chat history, notes and plans come up empty
 * with no visible error. A green E2E run is not evidence the database works.
 *
 * So this does not inspect files or trust a build tool's exit code — it opens a
 * real in-memory database and runs a statement, once under Node and once under
 * Electron. Exits non-zero if either fails.
 *
 * Run after `bun install` or an Electron upgrade; fix with
 * `bun run build:native-dual-abi`.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const PROBE = `
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY, label TEXT)');
  db.prepare('INSERT INTO probe (label) VALUES (?)').run('ok');
  const row = db.prepare('SELECT label FROM probe WHERE id = 1').get();
  if (!row || row.label !== 'ok') throw new Error('round-trip failed: ' + JSON.stringify(row));
  db.close();
  console.log('PROBE_OK abi=' + process.versions.modules);
`;

// packages/main is where better-sqlite3 is a declared dependency, so resolution
// must work from there — that is the path the real main process takes.
const cwd = join(process.cwd(), 'packages', 'main');

let failed = false;

function report(runtime: string, output: string) {
  const line = output.split('\n').find((l) => l.includes('PROBE_OK'));
  if (line) {
    console.log(`  ✓ ${runtime}: ${line.trim()}`);
  } else {
    failed = true;
    console.error(`  ✗ ${runtime}: probe did not report success`);
    console.error(output.trim().split('\n').slice(0, 8).map((l) => `      ${l}`).join('\n'));
  }
}

console.log('Verifying better-sqlite3 loads in both runtimes...\n');

// --- Node -------------------------------------------------------------------
try {
  report('Node   ', execFileSync('node', ['-e', PROBE], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
} catch (error: any) {
  failed = true;
  console.error('  ✗ Node   : failed to load');
  console.error(String(error.stderr || error.message).trim().split('\n').slice(0, 6).map((l) => `      ${l}`).join('\n'));
}

// --- Electron ---------------------------------------------------------------
// Runs in Electron's Node context via ELECTRON_RUN_AS_NODE, which uses the same
// ABI as the main process without needing a display.
try {
  const electronBin = join(process.cwd(), 'node_modules', '.bin', 'electron');
  report(
    'Electron',
    execFileSync(electronBin, ['-e', PROBE], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
  );
} catch (error: any) {
  failed = true;
  console.error('  ✗ Electron: failed to load');
  console.error(String(error.stderr || error.message).trim().split('\n').slice(0, 6).map((l) => `      ${l}`).join('\n'));
}

if (failed) {
  console.error('\n❌ better-sqlite3 does not load in every runtime.');
  console.error('   Run: bun run build:native-dual-abi');
  process.exit(1);
}

console.log('\n✅ better-sqlite3 loads under both Node and Electron.');
