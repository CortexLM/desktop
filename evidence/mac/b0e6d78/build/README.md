# Pristine b0e6d78 build — ready for Mac member comparison

**Build PASS.** Exact revision `b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874`;
tree `a9bffe5628d8bcbfa3de27df80ba81431fb588d6`;
parent `4fea24a804ee971009f94d36e2464988c58fafda`.

**Build root:** `/tmp/opencode/recovery-build-b0e6d78/source`
(canonical `/var/tmp/opencode/recovery-build-b0e6d78/source`; same directory).
Outputs: `packages/app/dist` and `packages/desktop/dist` beneath that root.

## Provenance

- `git archive` exported all revision-owned paths except `evidence/`: **598 files**. No working-tree source, dist or node_modules copied.
- Every extracted file matched its Git blob; all 598 remained byte-identical before/after installation and build. No unexpected source files outside dependency/build directories.
- Renderer fingerprint uses the pinned `scripts/compare-shots.mjs` source-path list and its exported `fingerprint()` function: **473 files**, SHA-256 `6c90fb3eb38af09db9566e68b33f441da4eea3dd367ccfec39c31d06419f8902`.
- `bun.lock`: Git blob `f2b4804db8078b487782640fb3bd177bbce490a3`; SHA-256 `8f5b7dcfbf8e7d3a82f8dfc2b9b8327498fd474836cd34c13bc629b456791d8b`.
- Source TAR: SHA-256 `610d56aa053f7932ad3665337a64f2e95bb948f730dca6b64dd19a9cb9c41026`.

## Installation and build

- Linux x86_64; **Bun 1.4.2**, **Node v22.23.3**. Node selected from the existing local runtime, matching the Node 22 CI line. Binary paths/hashes in `toolchain.json`.
- Frozen offline install, ignored lifecycle scripts, copyfile backend, private cache/HOME/temp directories. Cached package payloads copied into this scope; original cache untouched. No dependency downloads or Electron binary installation.
- Initial offline install failed because the cache-copy helper missed three hashed prerelease directory names. Exact existing versions were copied, then the same frozen offline install passed. Initial failure retained in `install.log` / `install.json`; correction in `cache-correction.json` / `install-cache-correction.json`.
- **51 direct dependency resolutions**, **8 workspaces**, **1,576 symlinks** verified; zero links resolve outside the isolated source root. All **140 installed SDK/API-types archive members** match the pinned tarballs byte-for-byte: SDK **0.3.1**, API-types **0.2.0**.
- `bun run build` ran once, exit **0**, `2026-10-03T03:07:35.774013Z`–`03:07:37.173699Z`. Vite 8.3.2, 863 transformed modules; esbuild 0.28.2 main/preload bundles. `build.log` and `build.json` retain command/environment/timing.
- Dependency-audit helper failures for ESM/declaration-only/root-subpath resolution are retained in `dependency-check-initial.json`; corrected audit passed. Post-build source-map helper initially assumed non-null embedded dependency source; corrected manifest retains 19 null dependency entries. These changed audit helpers only, never build inputs/outputs.

## Built-member manifest

**90 files, 28,321,866 bytes:** 86 app files plus main/preload and their two maps.
`build-members.json` uses the existing package comparator's `{path, bytes, sha256}` rows.
Manifest SHA-256: `118010f6c2491441cf27ef1e2448c6647ae824a75b4261b7f45d6eb23448120b`.
Sorted path/hash build fingerprint: `2493ced607a7f39ca9a6b4246e2c5405d6de873888019114e41f1f18f17f36dc`.

| Member | SHA-256 |
| --- | --- |
| `packages/app/dist/assets/index-DmHvuS1H.js` | `80648c7dcd1e1a4e0493ba086a466d2bc3ef4d87363a9688bfb56b7466a2e5ac` |
| `packages/app/dist/assets/index-Bo4UCD38.css` | `66b5535728e44c658157393b4350e21624c56597d27ed3a5887aaf6b50a2fca5` |
| `packages/desktop/dist/main.cjs` | `d12a69caab246f86c821844f19f4e417a26cb982aa262ff8f4611b1ca2b8bee0` |
| `packages/desktop/dist/preload.cjs` | `0c0dea24ae0345641c19ebc41af763ce8462f961a984fa530960a4b187831bb0` |

Desktop maps contain 978 source entries; all paths remain inside this build root or are
the bundler's virtual input. All 30 project-source entries match pinned Git-blob bytes.
Nineteen dependency entries contain no embedded source text; their absence remains explicit.

## Coordinator comparison

Set `ASAR` to the separately verified downloaded/installed `b0e6d78` package ASAR.
Run from the isolated root so the existing utility also resolves its dependencies there:

```bash
ROOT=/tmp/opencode/recovery-build-b0e6d78/source
cd "$ROOT"
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  /tmp/opencode/verify-recovery-package.mjs "$ASAR" \
  /tmp/opencode/recovery-build-b0e6d78/mac-member-comparison.json \
  b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874 "$ROOT"
```

Require its complete member list to equal `build-members.json` (**90**, including maps).
The utility's scope excludes packaged `package.json`, extra locales/skills and native
bundle metadata; those retain their separate package receipts.

## Retained files and limits

All receipts beneath `/tmp/opencode/recovery-build-b0e6d78/`: `source.json`,
`source-members.json`, `source-check-*.json`, `source-verification.json`,
`renderer-source.json`, `dependency-verification.json`, `desktop-map-inputs.json`,
`build-members.json`, `build-receipt.json`, logs and runnable audit helpers.
`BUILD-SHA256SUMS` covers all 90 build outputs; `SHA256SUMS` covers receipts, source TAR,
this report and build outputs.

Mac package/member equality **not yet checked**. No package, E2E, tests, CI watch or native
operations performed; no repository edits, commits or session/worktree changes.
Concurrent authentication implementation and its rebuilt dist are outside this pin.
