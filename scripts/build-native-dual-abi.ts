/**
 * Builds `better-sqlite3` for BOTH the Electron and Node ABIs.
 *
 * ## Why this exists
 *
 * `better-sqlite3` is a native addon, so its compiled `.node` file is locked to
 * one `NODE_MODULE_VERSION` (ABI). This repo loads it from two runtimes that do
 * not share an ABI:
 *
 *   - the Electron main process  → Electron 32 → ABI 128
 *   - the vitest suite (plain Node) → Node 24 → ABI 137
 *
 * A single build therefore breaks whichever runtime it was not built for. Both
 * failures are real and were both observed:
 *
 *   - built for Node, run under Electron → `app.whenReady()` logs
 *     "Database initialization failed ... requires NODE_MODULE_VERSION 128",
 *     and every DB-backed feature (chat history, notes, plans) silently
 *     degrades.
 *   - built for Electron, run under vitest → 185 database tests fail at
 *     `new Database()` with the mirror-image message.
 *
 * ## How it is resolved
 *
 * `bindings` (which better-sqlite3 uses to locate its addon) tries a list of
 * paths in order. The last entry is ABI-keyed:
 *
 *     lib/binding/node-v{process.versions.modules}-{platform}-{arch}/
 *
 * Building into that directory for each ABI lets each runtime resolve its own
 * binary from the same install. The catch is that `build/Release` is tried
 * first and would shadow both, so it is renamed aside rather than deleted —
 * keeping the artifact around for debugging while taking it out of the search
 * path.
 *
 * ## When to run this
 *
 * After any `bun install` that touches `better-sqlite3`, and after an Electron
 * major upgrade (which moves the target ABI). Verify with
 * `bun run verify:native-abi`.
 *
 * Note: `@electron/rebuild -f -w better-sqlite3` does NOT work here. It prints
 * "✔ Rebuild Complete" in under a second without touching the binary — the
 * package lives in Bun's content-addressed `node_modules/.bun/` store and is
 * only symlinked into `packages/main/node_modules`, which its dependency walk
 * does not follow. The success message is not evidence of a rebuild; check the
 * file's mtime.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

/** Electron's ABI, read from the installed Electron rather than hardcoded. */
function electronTarget(): { version: string; abi: string } {
  const version = String(
    JSON.parse(
      execFileSync('node', ['-p', 'JSON.stringify(require("electron/package.json"))'], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
    ).version
  );

  // Electron's ABI map ships with the module; fall back to a known table if the
  // helper is unavailable so this script fails loudly rather than guessing.
  const major = version.split('.')[0];
  const KNOWN: Record<string, string> = {
    '30': '123',
    '31': '125',
    '32': '128',
    '33': '130',
    '34': '132',
    '35': '133',
    '36': '135',
    '37': '137',
  };
  const abi = KNOWN[major];
  if (!abi) {
    throw new Error(
      `Unknown ABI for Electron ${version}. Add major ${major} to the KNOWN table in scripts/build-native-dual-abi.ts.`
    );
  }
  return { version, abi };
}

function moduleDir(): string {
  // Resolve through the symlink in packages/main so this keeps working if the
  // pinned version changes.
  const resolved = execFileSync(
    'node',
    ['-p', 'require("path").dirname(require.resolve("better-sqlite3/package.json"))'],
    { cwd: join(process.cwd(), 'packages', 'main'), encoding: 'utf8' }
  ).trim();
  if (!existsSync(resolved)) {
    throw new Error(`Could not locate better-sqlite3 (got: ${resolved})`);
  }
  return resolved;
}

function build(dir: string, abi: string, extraArgs: string[], label: string) {
  console.log(`\n▶ Building better-sqlite3 for ${label} (ABI ${abi})...`);
  execFileSync('npx', ['node-gyp', 'rebuild', '--release', '--arch=x64', ...extraArgs], {
    cwd: dir,
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const target = join(dir, 'lib', 'binding', `node-v${abi}-${process.platform}-x64`);
  mkdirSync(target, { recursive: true });
  copyFileSync(
    join(dir, 'build', 'Release', 'better_sqlite3.node'),
    join(target, 'better_sqlite3.node')
  );
  console.log(`  ✓ ${target}/better_sqlite3.node`);
}

const dir = moduleDir();
const electron = electronTarget();
const nodeAbi = process.versions.modules;

console.log(`better-sqlite3: ${dir}`);
console.log(`Targets: Electron ${electron.version} (ABI ${electron.abi}), Node ${process.version} (ABI ${nodeAbi})`);

if (electron.abi === nodeAbi) {
  console.log('\nElectron and Node share an ABI here — a single build serves both.');
}

build(dir, electron.abi, [`--target=${electron.version}`, '--dist-url=https://electronjs.org/headers'], 'Electron');
build(dir, nodeAbi, [], 'Node');

// build/Release is earlier in bindings' search order and would shadow both
// ABI-keyed builds. Move it aside instead of deleting it.
const releaseBinary = join(dir, 'build', 'Release', 'better_sqlite3.node');
if (existsSync(releaseBinary)) {
  renameSync(releaseBinary, `${releaseBinary}.disabled`);
  console.log('\n  ✓ Moved build/Release/better_sqlite3.node aside (it would shadow the ABI-keyed builds)');
}

console.log('\n✅ Dual-ABI build complete. Verify with: bun run verify:native-abi');
