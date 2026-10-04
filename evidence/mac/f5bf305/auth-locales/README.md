# Installed f5bf305 — eight-locale native authentication audit

**Scoped pass.** All **16 native wrong-code images** reviewed full-size and retained
RGBA-exactly. The recorded run passes **48 primary-state views, 352 text rows and
144 Tab targets** at **960×640**, eight locales, both themes. Signed-in and unavailable
enrollment have geometry/font/interaction records; this batch has **16 screenshots,
not 48**. Ready for coordinator integration.

## Receipt and artifact

| Item | Verified binding |
| --- | --- |
| Application | `f5bf305473db12fddfddcda890a01794f02f578f` |
| Documentary / artifact workflow revision | `1076c2584941cf054efffaf709a149b4195bc1c4` |
| Existing CI / artifact receipt | `37105137365` / `11267761992` |
| Installed ASAR | `d34d6d8609045f56851a6004f5c7bb185108cd743732ff8b79d6e3689df7f14c` |
| Executed harness | `25e6481613780096505e6b3970b36cc0290c1d1ac4a156aefa57829cb32faefe` |
| Original manifest | `ea1d51c5dbebc31995bddc7fcc6148b15b6a4c474e08fe5cae218c6dbb38c610`, **449,301 bytes**, retained unchanged |
| Recorded execution | **2026-10-03 07:46:57.171–07:54:35.712 UTC**, **458.541 seconds** |
| Native identity | PID **52666**, CGWindow **8396**, foreground; normal, non-minimized; 960×640 |
| Fixture identity | `75a4e3fc-33f9-456a-a944-c443df353866`, `/private/tmp/opencode/desktop-remote-auth-f5bf305` |

[Manifest](manifest.json), [run log](run.log), [summary](summary.json),
[provenance](provenance.json), [image index](index.md), [retention hashes](retained.json),
[48-view index](views.json), [checksums](SHA256SUMS).

Offline checks recompute the retained ASAR and **90/90 embedded members**, compare
each against the package receipt and actual frozen bytes, and validate **514 package
inputs / 473 renderer inputs** against the application Git revision. All **16 auth
catalogs** match pinned hashes, package ZIP resources and current source; auth TSX
also matches. The runtime manifest independently records those 17 source hashes and
the frozen-member receipt before/after. **32 main workspace sources** match embedded
source-map content; **16 embedded SDK modules** match SDK **0.3.5**.

All **172 app inputs and 297 i18n inputs** remain identical to `7885736`. At audit time,
`packages/app/src/state/live.ts` differs in the current worktree; these captures remain
bound to installed **f5bf305**, not that later hook change. The 473-input fingerprint
is `fb6220f8df77bdee09241fb2084417d3e3cc4924c8a1a4fbfa19200e09e96acb`.
The earlier [package audit](../review-auth.md) retains the outer/inner archive chain;
this review makes no fresh CI/network or build-reproduction claim.

## Assertions and real transport

Read the complete [executed harness](../scripts/native-auth-locales-final.mjs),
[fixture](../scripts/remote-auth-native-backend.mjs) and
[native capture helper](../scripts/capture-server.py). Harness hash equals the runtime
receipt. Wrong code and accepted code use localized UI; enrollment email setup and
logout use actual `window.cortex.request`. Main runs the installed SDK against
controlled Mac loopback HTTP. No engine/DOM response substitution or CSS/font override.

For each locale/theme: wrong-code, signed-in after renderer reload, then unavailable
enrollment after reload. Exact public auth DTOs and connection `signedIn` values agree.
The 48 records preserve **352 readable/fully opaque text rows**, **144 initial control
rectangles**, **144 ordered keyboard targets** and **112 text-node font records**.
Recorded initial and keyboard geometry agree exactly. Passing pinned assertions require
each real Tab target focused and enabled; focus/enabled booleans are not separately
serialized. Offline review checks recorded order/text/labels, bounds and overlap; it
does not re-execute hit testing or ancestor clipping.

Wrong-code order: **OTP input, Resend, Continue, alternate address, Cancel**.
Signed-in: **Continue, connection settings**. Enrollment unavailable: **alternate
address, Cancel**. The OTP input intentionally has opacity zero and no text ink;
its six painted zero cells plus editable input and keyboard/hit assertions establish
the visible/input behavior. Cell hit-test flags are false because the input overlays
them; these are not failed control records.

The fixture starts with the six-English run's nonzero counters. Its receipt equals
the initial failed attempt's before/after receipt and this sweep's baseline exactly.
Per-sweep deltas, independently recomputed:

```text
email +32; code +48; finishedCode +48; wrongCode +16;
session +16; enrollment +16; inspections +48; inspectionsPassed +48;
logout +0; abortedReply +0; discovery +0; errors +0.
```

Total counters end at **38 emails / 56 codes / 18 sessions / 18 enrollments / 58
successful inspections**, including earlier English activity. No held replies remain;
fresh candidate requests remain credential-free. **Zero recorded page/console errors,
renderer HTTP requests and dialogs.** The 48 privacy inspections send transient public
IPC/DOM/storage observations to fixture-owned secret matching. Only sanitized auth DTOs
and `privateMaterialAbsent: true` persist; no token/cookie/HTML dumps. This proves the
scoped renderer-leak checks, not a new filesystem credential audit.

## Full-size review and retention

All 16 originals show native chrome/traffic lights, shown sidebar, retained six zeros,
localized refusal, clear controls and focused Cancel. No clipped primary copy or
overlapping controls observed. Japanese, Korean and Simplified Chinese glyphs are
legible in both themes. Recorded native fallbacks include **Hiragino Kaku Gothic ProN**,
**Apple SD Gothic Neo** and **蘋方-簡**, respectively.

`glyphCount > 0` alone cannot prove character coverage. Full-size pixel review supplies
that check for these 16 wrong-code states; the other 32 states have geometry/font records
only. The independently read [Linux CI Japanese/Korean/Chinese negatives](../../../remote-chat-foundation/ci-1076c25/README.md#locale-measurements-versus-visible-glyphs)
still show missing-glyph boxes. This Mac receipt neither erases that failure nor diagnoses
its cause. Translation quality and all uncaptured states are outside this visual approval.

Original PNGs total **1,180,551 bytes**; 16 lossless WebPs total **401,526 bytes**.
Dimensions and decoded **RGBA, including alpha and transparent-pixel RGB**, compare
exactly for every image. PNG/WebP/RGBA hashes are in [retained.json](retained.json).
No prior-six image matches exactly. Each English wrong-code image differs by **256
pixels**, confined to **(623,513)–(669,535)** (exclusive right/bottom) around the newly focused Cancel control.
Both earlier English originals were inspected; new pixels are retained rather than reused.
The two reduced [contact sheets](index.md) are navigation aids, not acceptance originals.

Captures use `screencapture -o -x -l <CGWindowID>`: native window pixels, no browser
screenshot fallback. Per-capture assertions recheck installed ASAR/process/profile and
window identity/theme before/after; all captures match the post-run PID/ASAR. The
CGWindow capture excludes other windows, including the coordinator-reported top-right
Tips notification. App-window pixels and viewport are unobstructed in retained readback;
this is not a claim that the OS had no notifications.

## Historical failure, correction and cleanup

The [initial attempt](../auth-locales-initial/manifest.json) remains failed, **10.229
seconds**, zero views/captures, zero fixture counter delta. Its hash identifies unsupported
`Browser.getWindowForTarget`, before the locale loop. The [correction review](../auth-locales-initial/review.md)
retains the original script. This successful receipt now establishes runtime execution of
the replacement AppleScript sizing and CG/AX state checks.

Original/corrected source comparison leaves locale loops, geometry, copy, overlap,
focus order, privacy and 48/144/16 acceptance unchanged. Unsupported Browser window
methods are replaced with native sizing/state checks; remaining edits add diagnostic
phases and redacted errors. No layout assertion was weakened to obtain this pass.

Script cleanup restores signed-out connection plus original route/locale/theme.
Coordinator [cleanup](../cleanup.json) and [closed-port receipt](../ports-closed.json)
record helper shutdown, ordinary dark launch and closed forwarding; the coordinator
reports the lease released. These are retained observations, not new Mac checks.

Audit executed only local evidence/hash/Git-object/pixel checks. No app/test rerun,
Mac/SSH/CDP/network access, delegation or commit. The terminal executor also authored
the harness; this is a second-pass source/evidence audit complementing coordinator
execution, **not an independent-author review**. Offline verifier/result and exact
harness diff: `/tmp/opencode/native-locales-final-audit/`.

Acceptance: **installed f5bf305, controlled-fixture authentication, 48 primary views,
16 native wrong-code images**. No real Cloud account, remote inference, private Chat
runtime, process-restart persistence or server-revocation acceptance.
