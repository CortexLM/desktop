# Saved raster preflight — corrected source acceptance
**APPROVED, source scope only.** Prior filename P2 resolved; no remaining blocking finding in the reviewed delta.
- `packages/app/src/screens/files/raster.ts`: 158 lines; SHA-256 `3aaacb7094d26554ebb1e61973e026a05a4067fe0f13714ebca4f2f26388ced7`.
- `packages/app/src/screens/files/raster.test.ts`: 134 lines; SHA-256 `619ec5fe7d970224ef1309e862c24130a01bfda18aa6a0c4656e54c6ba38f031`.
- Independently reversed the single regex edit and removed the single new assertion in memory: exact original `ee05e29a…` / `5c2f2891…` hashes recovered. No other source delta.
- `raster.ts:153` now uses `/^[ .]+/`; the unbounded suffix search is removed. `:155` retains trailing trimming after the 120-unit/60-code-point cap; filename output semantics are preserved.
- `raster.test.ts:132` adds ``rasterFilename(`a${" ".repeat(200_000)}b.png`, "image/png") === "a.png"`` inside the existing filename case. Test count remains **18**, with one additional regression assertion.
- Completed `/tmp/opencode/files-live/raster-corrected.log`: **18/18 passed**, one file, 229 ms test time/442 ms suite duration; Node 22 execution attribution supplied by coordinator. No rerun performed.
- Prior P2 was source-derived, not a measured/reproduced hang. Original review remains historical; this receipt establishes corrected-case completion, not a comparative performance benchmark.
- Raster/base64 policy unchanged: inclusive 50,000,000 decoded file bytes, 40,000,000 encoded pixels, positive dimensions ≤32,768; mandatory native decode and separate native displayed-dimension bounds remain caller-owned.
- Original bytes/embedded metadata remain preserved. No metadata sanitization or total IPC/cumulative-thumbnail/decoder-memory bound claimed.
- Acceptance covers corrected source and the supplied unit receipt, not current dist, E2E, runtime UI, native display or download completion.
- Only this report written; no application edits, new tests/builds, GUI, network, CI/Mac access or delegation.
