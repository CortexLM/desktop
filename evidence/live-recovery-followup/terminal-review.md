# Terminal localization — independent read-only review

**Bounded approval: no blocking defect found in the proposed terminal-localization batch.**

Reviewed current source/diff only:

- `packages/core/src/tool.ts`
- `packages/app/src/state/tool-label.ts`
- `packages/app/src/screens/code/code.tsx`
- Eight `packages/i18n/locales/<locale>/code.json` catalogs
- `tests/unit/runtime-copy.test.ts`
- `tests/e2e/terminal-copy.spec.ts`

## Findings

### Exact output boundary and legacy fallback

`tool.ts:177-178` records the retained UTF-16 length and omitted UTF-16 count using the same `length`/`slice` semantics as existing `truncate` (`tool.ts:44-45`). The stored `output` expression is unchanged. This introduces no additional truncation, newline rewriting, stderr reordering, Unicode normalization or surrogate-boundary change.

`tool-label.ts:10-14` requires a completed `bash` result, safe nonnegative integer boundary within `output.length`, safe nonnegative integer omitted count, supported exit type, and an **exact whole-suffix match**. It does not search/replace English-looking text inside stdout. `slice(0, outputLength)` stays verbatim. Extra trailing data or mismatched metadata falls back to the original string.

Legacy records lacking a verified boundary deliberately remain verbatim, including old English annotations. This is the documented compatibility limit, not a new data-loss defect.

### Errors and replay

`tool-label.ts:6` preserves existing masking for actual error states. Verified string-valued exit annotations become neutral localized tool-failure copy at line 17; raw symbolic error codes are not rendered through that new branch. Numeric exit zero/null add no annotation, matching the existing producer.

`code.tsx:274` changes display only. Persisted output remains the original core result; `session.ts:378` preserves metadata separately and `session.ts:488-494` replays the original `s.output`. The live SDK envelope gains boundary metadata, but its output text is unchanged. The unit test checks both tools-enabled and tools-disabled replay; E2E checks live tool-result text, stored output after reload, and the next turn's replay.

### Catalogs

All eight locales provide identical `{code}`/`{count}` placeholders and one/other count keys. French, Spanish, German and Brazilian Portuguese preserve the distinction between exit code and omitted text. Japanese, Simplified Chinese and Korean have corresponding neutral terminal wording. Languages using only `other` are covered by the translator's existing plural fallback. No vendor names, raw internal code labels or source-key leaks introduced.

### Tests and portability

- Unit cases exercise empty output, 49,999/50,000/50,001 boundaries, CRLF, stdout lookalikes, stderr, non-ASCII and a surrogate pair crossing the retained boundary; malformed metadata and trailing data remain verbatim.
- The shell fixture uses quoted `process.execPath` and a real `.cjs` file. `fs.writeSync` avoids an early `process.exit` pipe-flush race; `process.exitCode` permits normal shutdown.
- E2E uses a real Electron engine and permission flow, with the repository's supported fake model provider. `exit 7` and the quoted Node command are portable to the configured Linux/macOS Node 22 runners. The test runner's `process.execPath` is the host Node executable under the existing package-script shebang, not the Electron GUI executable.
- The E2E fixture's French locale is applied before renderer reload. Assertions compare terminal `textContent`, retaining CRLF rather than normalized text matching for the large-output check.
- App/fake-server cleanup is in `finally`; this batch adds no SQLite locks or persistent permission policies. Unit fixture directories are removed in `finally`.

## Verification boundary

No new concrete counterexample warranted the optional helper assertion. The coordinator-provided Node 22 unit result was not rerun. No source edits, own-memory review, builds, distribution replacements, Mac operations or CI runs performed.

Post-build Electron execution and Linux/macOS integration remain coordinator-owned. Approval concerns the reviewed code and test design; it is not a claim that the new E2E or packaged app already passed.
