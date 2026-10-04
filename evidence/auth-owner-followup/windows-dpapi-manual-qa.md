# Windows DPAPI implementation handoff

Implementation complete locally; native Windows acceptance FAIL (blocked here: Linux host, no Windows machine tools). No Windows success inferred from mocks. Parent owns real host execution and crash/restart.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| credential-boundary | bounded pipes and atomic migration | Vitest, real filesystem with mocked OS boundary | `NODE_ENV=test bun run test -- packages/desktop/test/credentials.test.ts packages/desktop/test/windows-credentials.test.ts --reporter=dot` | PASS: 44 tests, 2 files | local-checks |
| native-crash | Windows CurrentUser durability | Windows Electron main | Parent must build and run fresh-profile save, abrupt termination, restart, decrypt | FAIL: missing Windows execution tools in child | native-blocker |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| atomic-failures | preserve old bytes | decrypt/protect/ACL/partial-write/fsync/rename refusal | Exact original bytes, no temporary residue | PASS: six unit scenarios using real filesystem, boundary faults | local-checks |
| pipe-failures | sanitize bridge failures | child failure/signal/error/malformed or excessive output | Fixed error, no child output or cause | PASS: six mocked child-result scenarios | local-checks |
| input-boundaries | bounded host invocation | oversized input/relative SystemRoot/wrong architecture | Refuse before spawning | PASS: mocked boundary | local-checks |
| native-policy | fail closed | actual denied PowerShell or DPAPI | No plaintext fallback, preserve original store | FAIL: missing Windows execution tools | native-blocker |
| visual-layout | no renderer change | responsive layout | not_applicable: only main-process storage changed | not_applicable | source |

### artifactRefs

| id | kind | description | path |
| --- | --- | --- | --- |
| local-checks | test receipt | Inspected command results, scope and limits | evidence/auth-owner-followup/windows-dpapi-local-checks.md |
| native-blocker | investigation | Existing native failure and host capability record; not successor acceptance | evidence/auth-owner-followup/windows-crash-key-blocker.md |
| source | source | Native pipe bridge | packages/desktop/src/windows-credentials.ts |

## Parent fixture API

No `main.ts` change required: its existing `fileCredentials` calls select the Windows backend automatically for both `credentials.json` and `mcp-credentials.json`. Consumer API unchanged.

Build: `bun run build:desktop`.

Main-only source fixture: import `fileCredentials` from `packages/desktop/src/credentials.ts` and pass Electron `safeStorage`. Call `store.set("test-provider", "test-key-123456")`; assert stored entry starts `d:`. Abruptly terminate the process after accepted set; restart same Windows user with same data directory; assert `store.get("test-provider") === "test-key-123456"`. Do not print values. Repeat using `mcp-credentials.json` and a synthetic JSON string with Unicode and a configuration larger than 2,560 bytes. Check `Get-Acl -LiteralPath <store>`: protected DACL, owner current SID, only current SID FullControl; check no `.tmp` residue. Exercise a Unicode directory name.

Legacy fixture: create a synthetic `e:` value using `safeStorage.encryptString("test-key-123456").toString("base64")` on a profile whose legacy encryption key is durably saved. Restart, call `get`, assert same plaintext internally and new `d:` prefix on disk. Also exercise synthetic `p:` migration. Broken legacy ciphertext must throw without modifying any bytes. Never use an actual credential as fixture.

Bridge API for standalone native checks: `windowsCredentials.protect(value)` returns base64 DPAPI ciphertext; `unprotect(ciphertext)` returns the original UTF-8 string; `restrict(path)` restricts an existing empty file. Native failures throw only `Credential protection unavailable`. Messages capped at 2 MiB; timeout 15 seconds. Static script requires PowerShell 5.1 x64 FullLanguage. Input uses UTF-8, protecting Unicode paths.

Documentation integration remains parent-owned under the assigned source/test-only ownership: update AGENTS.md, .rules/01-security.md and docs/providers.md/engine.md to describe Windows `d:` CurrentUser storage, migration and policy refusal. No commits or publication performed.
