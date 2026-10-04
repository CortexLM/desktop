# Local DPAPI bridge checks, 2026-10-04

Linux x64 executor. Actual Windows cryptography/ACLs were not executed.

Final targeted command:
`NODE_ENV=test bun run test -- packages/desktop/test/credentials.test.ts packages/desktop/test/windows-credentials.test.ts --reporter=dot`

Observed 16:47:56 result: 2 test files passed; 44 tests passed; duration 249 ms; exit 0.

Full unit command: `NODE_ENV=test bun run test -- --reporter=dot`.
Observed 16:46:28 result: 30 test files passed; 356 tests passed, 1 existing optional test skipped; duration 12.10 seconds; `FULL_UNIT_EXIT=0`. This preceded the final explicit PowerShell UTF-8 input-decoding line; targeted tests and static/build checks ran after that line.

Final static/build command:
`bun run typecheck && bun run lint && NODE_ENV=production bun run build:desktop`
Observed tsc and eslint clean, both esbuild bundles complete, `FINAL_STATIC_EXIT=0`.

Earlier `bun run audit:i18n`: 76 files, 2327 keys used, 3545 English keys, 0 problems; exit 0.

Initial new-test execution failed eight pipe-boundary cases because an ESM namespace export could not be spied upon. Changed child_process import to its mutable default object in source/test. All subsequent targeted runs passed. This was a test harness failure, not native execution.

LSP unavailable: `typescript-language-server` not installed. Repository strict `tsc` used instead. No new dependencies installed. No GUI, packaged smoke, E2E or Windows native verdict supplied by this child.

Existing credentials.test.ts edits present before this task were retained, including legacy-decryption preservation. The suite now explicitly selects the non-Windows format so its legacy prefix assertions remain applicable on Windows CI; POSIX-mode checks are conditional on the actual host filesystem. New Windows boundary suite covers provider and MCP stores, legacy e:/p: migration, OS refusal and atomic failures.
