# Saved Files — independent Electron test review
Verdict: correct two collector assumptions; tighten two proof gaps. The two observed failures do not establish a new Files application regression.
Reviewed `tests/e2e/files-live.spec.ts`: 290 lines, eight cases, SHA-256 `e28ddaece53de11cde6ed26581d085b2b002c2d3bf62ccb303f23e22938e327e` (previous checksum verified); all test line references below identify that source.
Authority: `/tmp/opencode/g1-files-live-delivery.md`, `g1-files-live-contract-review.md`, `g1-files-e2e-author.md`, AGENTS and all nine rules.
Source/supplied-artifact review only; only this report written. No test/build/app execution, codec probe, network, CI/Mac, commit or delegation.

## Supplied execution evidence
- `/tmp/opencode/files-live/initial-targeted.{json,log}` records six passes/two failures, zero retries/skips/flakes; twelve positive screenshot attachments are listed, not visually audited here.
- Passing cases: light/dark identity/formats/Fit/download/restart; read Retry; deletion/history/download fencing; decode/tuple/preview ownership; eight-locale dark geometry.
- Failure210 expects native-decode refusal; its error-context records ready PNG, 240 × 120, 1,101 bytes, Download. Coordinator reports original `Image.decode()` accepted this IDAT mutation; an independent codec probe remains coordinator-owned.
- Failure275 receives `Reasoner Large` instead of `No model` after provider PATCH. Earlier dirty/read/capability/submitting assertions were reached; no-model refusal and canceled-Open assertions were not.
- `/tmp/opencode/files-live/baseline.{json,log}` records eight failures against coordinator's frozen Activity `9ba8e59` build (`baseline-members.json`); this review does not reverify its 90 member hashes.
- Baseline first failures: identity2 at155 missing Open; unsafe203 card count2/8; Retry218 missing viewer; deletion229 missing held history; owner242 missing decode; drafts258 missing Open; locale287 missing image. These establish only reached negatives, not downstream behavior.
- Preserve `baseline.spec.ts`, original reports/traces and `e28…` attribution. Revised collectors require their own source pin/results; the initial run remains six/two.

## Complete source findings
1. **P2 — unproven unreadable fixture,178–182/210.** XOR of one IDAT byte with repaired CRC preserves framing but does not guarantee native rejection; the supplied ready state contradicts that assumption.
   Use one independently generated, structurally admissible fixture demonstrated to reject by original native `Image.decode()`. Retain the viewer invalid-state, absent-image and actual-decode assertions; verify the fixture's native failure without a forced rejection hook. No application CRC/codec expansion to satisfy this fixture.
   The current native-rejection tail and all-absent Upload assertion211 remain unverified by the initial run.
2. **P2 — nonexistent provider refresh,275.** `packages/core/src/provider.ts:57–78` persists settings without publishing; `packages/schema/src/index.ts:548–565` defines no provider event. `model-composer.tsx:24–35` cannot refresh through its `provider.` predicate here.
   Insert `await page.reload()` after the accepted disabling PATCH, before typing the new no-model draft. Prior FileReader restoration274 and accepted-send clearing272–273 make this setup reset appropriate; assert attachments are empty before reload so it cannot conceal failed file clearing. Keep all refusal/draft/Back assertions. Main-owned IPC cleanup survives renderer reload.
3. **P2 — pan checks can falsely pass,160/165.** Both only reject literal `"0px 0px"`; unchanged CSSOM values such as `"0px"`, `"none"` or `""` satisfy them. They never establish movement from the pre-action value.
   Capture the same element's translate/position before each key/drag, then require a changed value (or a numeric displacement on the intended axis). Supplied lifecycle passes retain their original weaker assertion scope.
4. **P3 — disabled restart premise is not asserted,153/170–173.** PATCH success and unchanged inference count do not detect a provider silently re-enabled on restart. Add an exact provider GET asserting `enabled: false` after relaunch; retain history equality and request-count checks.

## Helper and boundary review
- `call`18–24 uses real preload IPC, JSON-serializable arguments and correct 204 handling; browser callbacks use canvas/DOM APIs, while Buffer/fs stay in the test process.
- `save`53–59 admits records through real APIs, reads exact returned message IDs and waits for terminal assistant history. Completion may contain an inference error for intentionally unsafe inputs; it is admission evidence, not successful inference.
- `gate`82–103 matches method plus complete pathname/query, consumes one hold, runs the original handler before holding and preserves its reply. Sidebar lists cannot consume exact session/history holds. Failure injection exercises real protocol400 validation, not a forged outage or projection.
- `decoding`118–135 invokes the original decoder; only successful Blob completion is delayed. It records source assignment/revocation. Tests replace the complete tuple, compare the current src, release obsolete completion and require revocation; no fake decode success or engine event.
- `transitions`137–145 deliberately controls scheduling. Files ownership250 checks the retained `.content-top` node, actual preview/Back URLs and fresh history reads; it does not mistake the permanent enclosing `main` for the owner.
- `downloads`105–116 installs `will-download` before clicking, chooses only a profile-local deterministic path and records actual `done` state. Lifecycle168–169 waits for completed delivery and compares original WebP bytes; no fabricated download or default save dialog is required.
- FileReader261–268 pauses before native reading, resumes the original method, checks the real attachment afterward and restores before any proposed reload. Deferred prompt272 holds a genuine admitted reply; visible draft retention is not simulated.
- Cleanup restores main handlers, image/reader/navigation hooks and listeners, closes the current restarted owner/provider, removes its isolated profile. Unsafe path text is a route-validation fixture, not a filesystem read.

## URL and acceptance scope
- External-source190 is the controlled fake-provider loopback URL. `session.ts:510–512` converts it to URL; compatible model `supportedUrls` is empty (`openai-compatible-chat-language-model.ts:161–163`), so AI SDK prompt conversion attempts its download path rather than merely forwarding a URL string.
- Installed provider-utils5.0.53 validates before fetch (`fetch-with-validated-redirects.ts:161–175`); `validate-download-url.ts:74–79,133–134` rejects127/8. AI SDK `download.ts:39–43` supplies no trusted-origin exemption. Matching the configured provider origin does not bypass this guard; no public URL is present in this fixture.
- Request observer202–205 covers renderer navigation after admission, not main-process setup traffic. Its claim is appropriately limited to no renderer fetch/unsafe src/decode; the SDK source check above is separate evidence, not an executed network audit.
- Twelve planned/recorded positive shots cover four English lifecycle views and eight dark locale views. Geometry/localized labels do not establish glyph quality, translation fluency, native save-dialog UX, packaging, CI, macOS or full-product acceptance.
- Coordinator owns bounded fixture/setup corrections and source-bound execution. Application/raster review remains with its assigned owners; no further executor probes performed.
