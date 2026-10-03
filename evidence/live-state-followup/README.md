# Transcript history reconciliation

Base application: `f5bf305473db12fddfddcda890a01794f02f578f`.

Four deterministic Electron regressions reproduce two live defects in both themes:
a late stored-history response erases a newer completed turn, and the same response
restores a transcript after its session was deleted. The test delays an already-computed
real IPC response; provider HTTP, engine storage and SSE continue normally.
[Negative baseline](baseline/README.md) retains all four intended failures, exact test/source
pins, eight RGBA-identical before/after images and observed SSE/DOM traces.

`packages/app/src/state/live.ts` now merges snapshot/live messages and parts by ID,
preserves completed values, and invalidates pending reads on deletion. Atomic session
ownership prevents old messages/status being returned for a newly selected session.
Full part updates recover earlier live-only tokens after a midstream mount.

The initial corrected build passes all four formerly failing cases with zero retries/skips
(12.7 seconds), typecheck and lint. The full run passes **101 Electron cases**, zero retries,
skips or flaky results; **245 units plus one optional backend skip**, i18n and Linux
package/smoke pass. All 90 packaged members match the recorded initial correction build.
[Independent source review](review/README.md) approves the hook's reconciliation under
current local producer guarantees. It separately reproduces an existing Bot route-owner
defect: Alpha's selected session survives navigation to Beta and receives Beta's next
prompt. The live Bot page is now keyed by route owner, resetting its local session and
query state. Its two permanent regressions now pass on the final rebuilt application.
The [permanent Bot regression](bot-owner-baseline/README.md) independently fails in both themes: twelve ownership
assertions retain Alpha's content and the actual wrong-session write. Setup failures remain
separate; all original assertions stay in the corrected test run.
[Positive artifact review](electron-initial/README.md) verifies all 101 results, the unchanged
four-case regression, real DOM/SSE traces, 129 images across contact sheets and 22 full-size
views. Eight locale auth images remain pixel-identical to the earlier final Linux receipt.
This renderer delta is separate from the installed `f5bf305` remote-foundation artifact.
The accompanying Linux font-provisioning/test change has its own
[negative glyph evidence](../linux-glyph-followup/README.md); it changes no application font assets.
Its locale case passes locally with real glyph checks; the next CI must establish the
provisioned runner's raster/font-inventory result and readable full-size captures.

[Scoped frozen comparison](compare-initial/README.md) covers 22 renders/22 references,
zero gaps, 66 full-size originals reviewed. Maximum residual is 7,945/5,184,000 pixels
(0.15326003086419754%), preserving existing copy/mascot/timer/scroll provenance. It covers
the initial hook build; the later Bot key affects only live-page lifetime.

Final combined source passes lint/typecheck, i18n (65 files/2,272 used keys/3,405 English
keys/zero findings) and 245 units plus one optional backend skip. The rebuilt **103-case
Electron suite** passes with zero retries/skips/flaky results, including the six unchanged
negative regressions. Linux package/smoke passes; all 90 ASAR members match the final build.
[Bot owner-key review](bot-owner-review.md) approves its explicit route-ID scope.
Final image review and new-revision CI/native checks remain separate gates.
