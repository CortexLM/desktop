# Appearance theme — negative Electron baseline

**Two failed cases; 17 failed assertions: light-start 9, dark-start 8.**
Application `37c22c2fcff92fb76b10ffc97ec0643ac325d62f`; documentary HEAD
`6642d46467304cbe1181d0963d51c085ec09a0c4`. This packet preserves the unfixed run.

## Run and result

- Actual Linux Electron through the existing launch fixture; English, 960×640, both themes, reduced motion.
- Node 22.23.3/Xvfb; one worker; zero retries. Started `2026-10-03T12:22:52.284Z`; runner duration 19.624s; process exit 1.
- Each fresh profile completed nine observation stages, including reload. Page-error listeners recorded zero errors after fixture launch.
- Main radios had Tab indices `[0,0,0]`. ArrowRight/ArrowLeft changed neither selected/focused radio nor saved preference.
- Tab from Light incorrectly focused Dark; Tab from the final Dark card correctly reached Language. This accounts for the 9/8 split.
- Rail selection correctly updated HTML and storage; the mounted Appearance selection stayed stale in both directions.
- Rail System persisted `system`; HTML followed both emulated OS schemes. Appearance stayed stale until reload.
- Reload with the retained `theme=system` URL restored System in both groups, retained storage, resolved dark HTML.
- Fresh hash mismatch is a separate observation: main selected System while HTML/rail matched the requested theme and storage was null. No initial-mismatch assertion was executed.
- Pointer setup and control assertions passed. `CORTEX_RENDERER_URL` was removed, not set empty; catalog used `data:application/json,{}`. No API mock or custom event dispatch.

## Retained evidence

- [Summary with exact failures](summary.json), [readable normalized log](run.log), [original raw report](raw/results.json.gz), [original raw log](raw/run.log.gz), [run command/environment](run.json).
- [Light-start observations](observations/light.json), [dark-start observations](observations/dark.json); [original baseline report](raw/original-README.md.gz).
- [Exact executed test](appearance-theme.spec.ts): 93 lines, 6259 bytes; SHA-256 `2bff6928c640ef274363b00e3861027488fa1025d0087135a93ddbee061949ba`.
- [Original runner configuration](raw/playwright.config.ts); readable failure contexts [light](raw/error-context-light.md), [dark](raw/error-context-dark.md) normalize trailing whitespace only. Exact originals: [light gzip](raw/error-context-light.md.gz), [dark gzip](raw/error-context-dark.md.gz).
- [Dark rendered frame](images/dark.webp): stale Light card, rail Dark. [Light rendered frame](images/light.webp): stale Dark card, rail Light. Both full frames inspected.
- Exactly two original screenshot calls, one per case. Lossless WebP conversion preserves 960×640 decoded RGBA exactly; original PNG hashes remain in the index.

## Integrity scope

- [Before](integrity/before.json.gz) and [after](integrity/after.json.gz) are the original run-time receipts: **90/90 distribution members**, no extras, unchanged test hash. Retention did not reread current builds.
- Those receipts verify **512 non-Markdown inputs**, not all 514 frozen manifest entries. [Original verifier](integrity/original-verifier.py) excluded every path ending `.md`.
- The two exclusions are `packages/core/README.md` and `skills/summarize/SKILL.md`. The suffix filter was not a runtime-importance assessment; the skill is packaged. No match claim for those two comes from these receipts.
- [Coordinator source baseline](integrity/source-baseline.json) preserves five pre-fix file pins only; it does not expand the 512-input receipt.
- [Index](index.json) records source/retained byte hashes, sizes, transformations, original/decoded RGBA hashes and exact input scope.
- Every gzip roundtrip reproduces the original bytes; gzip timestamps are zero. Readable log/context normalization preserves content and line endings while removing trailing spaces/tabs; the log also shortens paths and strips ANSI. [SHA256SUMS](SHA256SUMS) covers every other retained file.
- Offline check: `python3 /tmp/opencode/appearance-theme-retention/verify.py evidence/appearance-theme-followup/baseline` (Pillow required).
- Focused ESLint and repository TypeScript exited 0 before the run, as recorded in the original report. This packet contains no fixed-application result.
