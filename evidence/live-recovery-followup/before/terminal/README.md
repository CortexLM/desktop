# Terminal copy: reproduced; minimal unapplied proposal

**P2 confirmed.** Real core `bash.execute`, real French `CodeSession` SSR: `exit 7` displays `[exit code 7]`; 50,017 ASCII stdout characters display `… [truncated 17 characters]`. Empty stdout/stderr on `exit 7` proves the notice is Cortex-authored.

## Execution evidence
- `/tmp/opencode/terminal-copy-repro/current/`: **4/4 pass** proving existing output/render behavior; JSON results, stdout/stderr fixture bytes, HTML and hashes retained.
- `negative/`: **2 failed / 2 passed**, exit 1. Failures assert English exit/truncation notices should be absent from French terminal. Full negative logs retained.
- `proposal/`: **11/11 pass**, **64 actual `CodeSession` SSR renders** (4 command records × new/legacy × 8 locales); proposal injected in memory, repository unmodified by this executor.
- Real cases: empty exit 7; 50,017-character stdout; CRLF/tab/HTML characters plus lookalike `[exit code 7]` / truncation text and stderr; multibyte stdout crossing the existing UTF-16 cutoff. One permission ask per execution. Proposed `output` equals original exactly; `toModelMessages` replay equals original with tools both enabled and disabled.
- Additional assertions: exit 0/null/7/−1/symbolic code; omitted counts 0/1/2; lengths 0/49,999/50,000/50,001; malformed/missing/inconsistent metadata; trailing user text; non-bash/error/pending states; placeholders across all eight catalogs. Synthetic symbolic exit coverage, not a real aborted-process test.
- Sources: `source-before.json` / `source-after.json`; reviewed producer, sink, schema, helper, test and eight catalogs remain hash-identical. Other agents' changes recorded separately. Node `v24.21.0`, Vitest `5.0.3`.

## Smallest edge-case-safe patch
- **Unapplied:** `/tmp/opencode/terminal-copy-repro/proposal.patch` — **11 files**; `git apply --check` passes. Three source files, eight existing `packages/i18n/locales/{en,fr,es,de,ja,zh-Hans,pt-BR,ko}/code.json` files. No new production module/dependency/schema/migration.
- `packages/core/src/tool.ts:177`: retain `output: truncate(out) + exit suffix` exactly. Add `metadata.outputLength = Math.min(out.length, MAX_OUTPUT)` and `metadata.truncated = Math.max(0, out.length - MAX_OUTPUT)` beside existing `exit`.
- Both numbers count **UTF-16 units**, matching existing `slice`, not bytes. `outputLength` is retained raw-output length; `truncated` is omitted count. No duplicate 50 KB payload. Existing stdout-then-stderr concatenation, UTF-8 decoding and cutoff behavior remain intact.
- `packages/app/src/state/tool-label.ts`: add the scoped `bashOutput(t, p)` formatter. Validate metadata types/bounds; compare `output.slice(outputLength)` with the exact metadata-derived English suffix; localize only that suffix. Return the complete original string on any mismatch. No searching/replacing arbitrary stdout.
- `packages/app/src/screens/code/code.tsx:11,274`: import/call formatter. This is the only direct live renderer `bash` output sink found; Chat/Work tool cards use titles. `chat/canvas.tsx` renders preview fixture output, not shell results.
- Model-facing English `output` remains exact, including truncation/exit notices. Immediate tool-return envelope gains two metadata numbers; persisted replay text remains byte-equivalent. No session/history rewrite.

## Catalog entries and legacy scope
- No reusable runtime exit/truncation catalog key exists. `terminal.exitCode` reuses each locale's existing `fixtures/code.json` → `terminal.fail[7][1]` wording with `1` replaced by `{code}`; copies into live catalogs, never imports preview fixtures in live mode.
- Add `terminal.truncated_one` / `_other` (`{count} character(s) omitted`) in all eight catalogs; exact candidate translations in `catalog-additions.json`. No translation API used; placeholder/render validation passed, native-language editorial review not claimed.
- French result: `[Commande terminée avec le code 7]` / `… [17 caractères omis]`. A command's own identical-looking English lines remain exact. Symbolic process codes use existing generic translated failure copy for the verified Cortex suffix.
- **Old persisted records deliberately stay verbatim**, including English notices, when length metadata is missing. `metadata.exit` alone cannot prove a truncation boundary. No regex migration or silent user-text removal; the `ponytail:` comment permits migration only with independently verified raw-output provenance.

## Integration after authorization
- Move focused cases into existing `tests/unit/runtime-copy.test.ts`: real producer/replay equality, new/legacy rendering for eight locales, lookalike data, truncation and malformed metadata. External executable fixture: `proposal.test.tsx`; existing mocks can be reused.
- Update `AGENTS.md` and `docs/i18n.md` with fresh-record localization and legacy verbatim scope. Those documentation/test integrations are not included in the runtime/catalog diff.
- Standalone formatter strict TypeScript check passed; patch dry-run passed. Application lint/typecheck/build/Electron/SQLite/IPC/native checks not run. SSR forces the terminal state using the existing unit-test mocking pattern.
- Repeat: `node /tmp/opencode/terminal-copy-repro/run.mjs current`, then `negative` (expected exit 1), then `proposal`. `python3 /tmp/opencode/terminal-copy-repro/verify.py` checks receipts and unchanged source hashes.
- Receipt bundle: `verification.json`, `SHA256SUMS`, `patch-files.json`, current/negative/proposal logs and HTML. No whole-product or packaged-UI acceptance claim.
