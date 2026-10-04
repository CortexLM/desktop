# Remote renderer integration in progress

## Current gate correction

The bounded gate `.omo/evidence/remote-chat-integration-gate.md` rejects binding 6:
ordinary deferred navigation did not unmount Login, leaving its callback owner valid.
Login now invalidates the renderer request synchronously on departure-entry changes,
refuses submits from an outgoing entry, and restores editability on returning to the
same entry without changing main authority. Types/lint/build pass; the existing 16
auth cases pass in 1.7 minutes at `/tmp/opencode/remote-auth-departure-regression`.
The new committed/deferred email/MFA matrix is running separately. Its initial
TypeScript failure used `Promise<unknown>` for a native transition completion;
the fixture now preserves the required `Promise<void>` contract. No gate closure
was claimed before execution. The four-case matrix passes in 9.6 seconds at
`/tmp/opencode/remote-auth-deferred-ownership-fixed`; the new delta gate
`.omo/evidence/auth-deferred-gate.md` approves G1-B6-01. Earlier full-run/package
results below precede this application delta. A fresh complete Electron regression
passes all 195 cases in 18.7 minutes at `/tmp/opencode/remote-chat-final-regression`.
The corrected build also passes `bun run pack` and the Linux smoke command with
`SMOKE OK`; this supersedes the earlier package check for local startup only.

`remote-chat.tsx` and Home/Chat dispatch are applied. Unprojected Home checks the
connection; project Home and existing untagged local Chat routes retain local
behavior. Explicit remote links require source, epoch and session ID. Remote
snapshots subscribe before reads and guard committed navigation ownership.

The first integrated renderer passes typecheck, lint and production build. These
checks alone do not establish behavior. All eight catalogs now contain 74 remote
keys with matching placeholders; visual translation review remains open.
Seven real-main/SDK Electron scenarios pass in 12.4 seconds at
`/tmp/opencode/remote-chat-draft-recovery`, covering admission, local isolation,
refusal, replay, canceled local/remote navigation with images and edited next drafts
after pre-admission detach/resume. Types, lint and the tested production build pass.
That run predates the sidebar/history integration below. Broader Electron/visual
coverage remains open.
No native or real-account acceptance is claimed.

Sidebar and History now display separate process-only remote lists. Links carry
source/epoch/id; local project membership, rename/delete and pins remain local.
The eight-case run at `/tmp/opencode/remote-chat-lists` passes in 15.6 seconds,
including keyboard History navigation and removal of remote rows/transcript after
logout. Types, lint and production build pass for that run.

The historical-image recovery action now creates a fresh owned record and transfers
the exact text, files and one-off choice through a destination-entry-bound handoff.
The old transcript remains unchanged. Follow-up review closed the first two losses
but found destination typing could race handoff hydration. Mutations and the textarea
now require a validated loaded state. The strengthened eight-case run at
`/tmp/opencode/remote-chat-held-destination` passes in 15.3 seconds with clean types
and lint. Its real main IPC wrapper holds destination reads unchanged, verifies the
disabled textarea and rejected synthetic mutation, then releases the response and
checks the exact transferred draft/files/one-off choice. Independent acceptance of
this correction is now approved in the bounded ownership review at
`.omo/evidence/remote-renderer-ownership-review.md`; visual/full regression remains separate.

The integrated run at `/tmp/opencode/remote-chat-integrated` passes 13 cases in
29.0 seconds, after clean types/lint/production build. It adds a real IPC delayed-list
test proving pre-logout bodies cannot restore removed rows in either list owner.
Four visual cases capture 12 English Home/transcript/History frames across light/dark
and 960x640/1280x900. Earlier visual runs are retained: the first collector counted
the shared composer's intentional 3px decorative surface as content overflow and
waited for a resize when the window already matched; later inspection found actual
fixed-height remote-note compression, then excessive intrinsic width. Scoped CSS
fixes now permit bounded multiline notes. The integrated run also removes the
misleading local-empty notice when remote History contains rows.
Geometry excludes only that pseudo-element during measurement and restores it
before hit testing and screenshots. Parent inspected all 12 pre-empty-notice-fix
frames at `/tmp/opencode/remote-chat-visual-bounded`; all four corrected History
captures at `/tmp/opencode/remote-chat-integrated` have also been inspected, confirming
the false empty-state notice is gone. Independent visual review is pending.
This is English/scoped coverage, not locale/native or
full-product visual acceptance.

Integrated unit verification passes 316 tests with one optional skip across 27
files; the i18n audit passes. The complete 182-case Electron run is active at
`/tmp/opencode/remote-chat-full-regression` finished with 181 passes and one failure
in 20.3 minutes. The auth initial-read fixture held only the first connection reader;
the new sidebar could consume that barrier before Settings. Holding all matching
readers corrected its coverage. A subsequent fixture deadlock also held its independent
verification read; disarming new holds without releasing the form response corrected
that. The targeted auth case passes in 3.9 seconds at
`/tmp/opencode/remote-auth-read-owner-fixed`. A complete clean rerun remains required.

Four scroll cases pass in 20.0 seconds at `/tmp/opencode/remote-chat-scroll-reachability`.
Independent review inspected all 12 scroll captures and closed the reachability concern.
The remaining notice-contrast finding was measured from the existing CSS tokens:
3.28:1 light / 3.52:1 dark. The remote notice now uses existing `--t2`, yielding
6.16:1 / 6.06:1 against `--content`. Fresh rendered verification passes four cases
in 16.6 seconds at `/tmp/opencode/remote-chat-visual-contrast`; parent inspected the
minimum-window dark Home capture. A corrected full regression remains active at
`/tmp/opencode/remote-chat-full-corrected`. The next eight-locale/two-theme test patch
is prepared but deliberately unapplied until that run finishes, preserving its
test-source identity. No locale-render acceptance is claimed yet.

The matching Linux package passes `bun run pack` and
`xvfb-run -a node scripts/smoke.mjs linux` with `SMOKE OK` (Electron 44.5.1).
This confirms packaged startup, not installed-Mac or real-account behavior.

Coverage audit identified additional renderer scenarios before acceptance: expired
replay/history recovery, adverse model capabilities, missing recorded models,
one-off replay followed by an ordinary turn, invalid admission retention, removing
a new image without clearing image history, non-text parts and keyboard/continuation
navigation. Prepared patches remain unexecuted. The adverse registry fixture's all
false flags and zero token counts intentionally normalize to `unknown` in
`packages/desktop/src/remote-chat.ts`; its planned test explicitly checks the normalized
catalogue rather than inferring capability from the fixture's name.

The prepared continuation navigation cases distinguish renderer lifetime from main
authority: ordinary committed navigation invalidates the outgoing form callback,
but does not itself cancel a still-authorized main request. A returning form must
keep its own draft; submitting its stale revision must be refused before backend
HTTP and refresh from checked state. These cases are not yet applied or executed;
deferred, uncommitted departure remains a separate unproven boundary.

The corrected complete regression at `/tmp/opencode/remote-chat-full-corrected`
passes all 182 cases in 19.2 minutes, after clean types/lint. Its application build
matches the packaged smoke check. The later test-only locale addition passes its
16 locale/theme states in one case (19.2 seconds) at `/tmp/opencode/remote-chat-locales`;
all 16 originals were inspected in both themes, including visible CJK glyphs and
wrapped notes. This is not a comprehensive translation or glyph-coverage audit.
Two committed continuation-navigation cases pass in 5.4 seconds at
`/tmp/opencode/remote-auth-navigation`, preserving the distinction between stale
renderer callbacks and still-authorized main operations.

The adverse renderer suite passes 20 cases in one minute at
`/tmp/opencode/remote-chat-adverse`: explicit false/unknown vision, unavailable
configured entries, disappeared recorded model without fallback, invalid admission
retaining text/image/override, original one-off replay followed by ordinary recorded
model use, image-history refusal after draft-image removal, and keyboard focus/draft
retention. Types and lint pass. Two additional cases pass in 4.3 seconds at
`/tmp/opencode/remote-chat-history-parts`: expired replay recovers two actual known
messages without new generation, and real SDK reasoning/tool/disclosure/media frames
render only their sanitized projection. The combined 38-case Chat/auth run passes
in 2.6 minutes at `/tmp/opencode/remote-contracts-consolidated`. These are test-only additions after
the 182-case full run; the application build is unchanged.

The component retains the draft through upload/admission refusal and reader detach.
It does not persist drafts across arbitrary departure/remount. Existing new-chat
guard is component-local; historical-image refusal now has the explicit
draft-preserving new-chat handoff described above. Recovery reuses the existing
request, not the next draft. Source review found two additional draft-loss paths:
connection rechecks unmounted the existing composer, and Home resume navigated away
from an edited next draft. Both are corrected and covered by the seven-case run.

Prior adapter evidence remains separate: 316 units plus one optional skip, clean
types/lint/i18n and build before renderer changes. The 169-case Electron run predates
this renderer and must not be cited as its acceptance.
