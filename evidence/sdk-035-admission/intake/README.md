# SDK0.3.5 authorized dependency intake

**PASS — applied, uncommitted.** Desktop now resolves `@cortex/sdk` **0.3.5** and `@cortex/api-types` **0.2.0** from its own installed dependencies. HEAD remains `ffc118a2e58df66f430f3078e00f6e931dd910cf`; coordinator owns the separate intake pin and AGENTS/docs updates.

## Four owned repository files
| File | Change / SHA-256 |
| --- | --- |
| `vendor/cortex-sdk-0.3.5.tgz` | Exact immutable source copy; `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8` |
| `packages/desktop/package.json` | SDK file reference0.3.1→0.3.5 only; `10cec19edd7ddd59fe5a52bf72abd98a3228f64647a6f5ceaf2583a95dbcc4dd` |
| `bun.lock` | SDK file reference and integrity only; `dada4e8c730bd0514dd0506c7ee7b453ac1f698bd509561a8ad43367b796f8a6` |
| `vendor/README.md` | Exact new source/schema/hashes, fixes, bounded acceptance, preserved historical failures; `ddd49a8742b61b14b436d8f20fcb8a754251b146c76d95b471a0be64823bd138` |

Owner source: `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31`; archive from `/root/cortex-goals/releases/sdk-0.3.5-5b7e9d1c3fa2/`. Source/destination SHA-256 verified before/after copy;164809bytes.

Existing peer archive retained byte-for-byte: `vendor/cortex-api-types-0.2.0.tgz`, SHA-256 `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877`. Exact optional peer remains0.2.0. No unrelated lock entry changed; frozen install left the lock identical.

Canonical schema remains screenshot-only successor blob `c8f6a7f0257858306a885c71202c13420f40725f`, distinct from earlier `d6d46014`. SDK upgrade does not supply precise legacy DTOs, durable account identity, complete history or remote prompt integration.

## Actual-root checks
Native **Node22.23.3**, Bun1.4.2, TypeScript5.9.3. Commands, exits, timing and logs: `/tmp/opencode/desktop-sdk-035-intake/logs/`.

| Check | Result |
| --- | --- |
| `bun install --ignore-scripts` | PASS; one SDK package installed |
| `bun install --frozen-lockfile --ignore-scripts` | PASS;543 installs/583packages checked, no changes |
| Installed/archive identity | PASS; SDK59 + API-types81 files byte-identical |
| Existing `remote.test.ts` + `remote-session.test.ts` via root Vitest | **52 passed, 1 skipped, 0 failed;53 total** |
| Root `tsc -p tsconfig.json` | PASS, strict workspace typecheck |
| Prior positive/negative public declaration fixtures against root-installed pair | PASS, `skipLibCheck:false`;17 SDK/16peer declaration files resolve inside root dependencies |
| Targeted ESLint: probe, main auth service, both existing test files | PASS |
| ESM resolution from actual main-service importer | PASS; SDK0.3.5/peer0.2.0, shared public error constructors, no isolated-readback module |
| Scoped `git diff --check` | PASS |

The53 cases comprise44 discovery passes + one optional real-backend skip + eight real main-auth service passes. Both repository test files and service sources remained unchanged; tests use native HTTP/Fetch with the actual root pair. `CORTEX_TEST_BACKEND_URL` is absent; skip establishes no real Cloud account/inference proof.

One diagnostic-only failure is retained: `createRequire.resolve('@cortex/sdk')` selected CommonJS against an ESM-import-only export and returned `ERR_PACKAGE_PATH_NOT_EXPORTED`. Corrected to `import.meta.resolve` with the actual desktop main importer; passed. No product/source adjustment.

## Preservation and handoff
- Previous0.2.0/0.1.0/0.3.1 archives, existing peer and0.3.4 failure receipts verified unchanged. SDK0.3.0 HOLD and0.3.1 negative media/screenshot evidence remain historical.
- No main service, probe, app or test edits. Existing coordinator-owned changes remain separate.
- No build, E2E, full tests, Mac, CI, commit or push. `ffc118a` + SDK0.3.1 native evidence remains tied to that earlier pair; new-pair native acceptance is separate.
- Receipt: `/tmp/opencode/desktop-sdk-035-intake/receipt.json`. Diff: `intake.diff`; package/lock identity: `lock-identity.json`; actual Node ESM paths: `resolution.json`; root declaration paths: `declaration-resolution.json`;53-case proof: `focused.json`.
- Pre-intake admission evidence remains `/tmp/opencode/desktop-sdk-035-readback/report.md` (35sources/16generated/102compiled/34runtime + isolated main8); this receipt adds actual-root installation and53-case proof.
