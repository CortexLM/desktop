# Provider availability toggle — negative baseline

Application `2956564fbe31f882014d74ff3a7f920e839fd634`; documentary HEAD at run
`10a57be97ee9e9f9ea0c761784279ec8744b70d3`. Actual Linux Electron, English light/dark,
960×640, Node 22.23.3/Xvfb. This packet records the unfixed behavior; no positive run.

## Result

- **Two failed cases, four intended draft-preservation assertions.** Setup and control assertions passed; no retries, skips or expected-failure annotation.
- Each theme saved dummy key A, typed replacement B, then separately disabled and enabled the provider. Both successful PATCH operations emptied the unsaved draft.
- Both toggles retained stored hint `1111`, `hasKey: true`, the requested enabled state. GET used the real IPC bridge; no credential-store decryption.
- Conditional refills occurred only after recording each loss. Explicit Save then returned PUT 200, changed the hint to `2222`, cleared the accepted draft.
- Per theme: exactly two PATCH 200 and two PUT 200; sanitized response fields only. Password type and absence of full fixture keys in visible text were asserted.
- Passive main-process HTTP-fetch observation began **after launch**: zero observed HTTP fetches during the interactions. Initial catalog configuration was a data URI; this is not a startup network audit.
- No page-error listener was installed; page-error absence is not established.

## Canonical evidence

- [Summary](summary.json), [raw report](final/report.json.gz), [raw log](final/log.txt.gz), [run command](final/run.json).
- Sanitized IPC/draft observations: [light](observations/light.json), [dark](observations/dark.json). No full key request bodies retained there.
- Final post-Disable captures: [light](images/light.webp), [dark](images/dark.webp). Full frames inspected: hint `1111`, empty input, disabled Save; success toast absent.
- [Exact executed test](source/provider-draft.spec.ts.gz): 129 lines; SHA256 `bf57e5cdb18d53f31572ec04ec7727130574a1c33cbdf9cc3b6fcb4733365c3a`.
- [Focused lint/types receipt](final/checks.json), [lint log](final/lint.log.gz), [types log](final/types.log.gz): both checks passed.
- [Before](bindings/before-hashes.json.gz) / [after](bindings/after-hashes.json.gz): identical **90 build members + 514 source/configuration inputs**, matched against the freeze and Git application pin. These are run-time receipts, not claims about later coordinator edits.
- Actual freeze: `/tmp/opencode/build-terminal-state-final`; the supplied `build-terminal-state-final90` spelling did not exist.
- [Historical attempts](history/README.md) remain separate. No HTML, trace archive, credential store or profile database duplicated here.

## Integrity

- [Index](index.json): canonical paths, source/retained byte hashes, sizes, transformation details, source and decoded RGBA hashes.
- Both PNGs converted to lossless WebP with no crop/resize. Decoded RGBA bytes match their originals exactly; PNG byte hashes remain indexed.
- Gzip files preserve exact original bytes on decompression, with deterministic zero timestamps. [SHA256SUMS](SHA256SUMS) covers every other retained file.
- Offline verifier: `python3 /tmp/opencode/provider-draft-retention/verify.py evidence/provider-draft-followup/toggle-baseline` (Pillow required); verifier/script hashes recorded in the index.
- Repository changes for this retention lot are confined to this directory. No application/test edit, build, CI, Mac or network/account operation.
