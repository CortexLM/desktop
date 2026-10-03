# Initial integrated Electron receipt — audited

**97/97 cases passed; zero retries, skips, flaky results or unexpected failures.**
Run: **2026-10-03 06:30:33.561 UTC**, **261.449 seconds**, four Linux Electron workers.
This receipt belongs to the initial main/core integration, before subsequent independent
review corrections. It does not approve the changing worktree or remote Chat delivery.

## Verified counts

| Evidence | Count |
| --- | ---: |
| Registered cases / execution results | 97 / 97 |
| Registry render checks | 426 |
| PNG files in artifact directory | 242 |
| PNG attachments in raw report | 125 |
| Inline PNG attachments absent from filesystem | 4 |
| Unique filesystem PNG hashes | 119 |
| Unique PNG hashes including inline attachments | **123** |
| Contact sheets reviewed | 16, covering all 123 unique images |
| Full-size images reviewed | **19** |
| Selected originals | 18 references: eight locales, six English auth, four Approvals |
| New canonical PNG files | 2; 16 references reuse existing identical evidence |

The **426** figure comes from `screens.spec.ts`'s passing result and recorded stdout
`rendered 426 screen states`. That test attaches **no screenshots**. It checks rendered
content, themes, raw translation keys and page errors; this is not 426-image visual
acceptance. The screenshot inventory is independently enumerated and deduplicated.

## Source, build and historical boundary

- [Source pin](../integrated/source-core.json), SHA-256
  `0815c70b1f7169a0edbfd48ff12830e59aa2e64dd8fdb31b30b4c817f375f393`.
- [Build pin](../integrated/build-core.json), SHA-256
  `d5f414ca6d2dcd6ef11d93b3f1ef9d09304f797af3233ba25e9b5f56dab10082`.
- All **90 built members** matched the historical build manifest during this audit.
  The coordinator's [initial package receipt](../integrated/linux-package-initial.json)
  lists the same 90 hashes and ASAR
  `6e7c23bf44fc45c9eb2dc290343fe43d63a588ef9b8fd9e29782da869de3cba0`.
  This audit compares that receipt; it does not repeat packaging or ASAR extraction.
- Main bundle: `700c14956d913d50ab2213e8d75720520d3dbc76d10500a1777eb7a79a197a25`.
  Renderer entry: `61a3d091c7d554c5748dfddea1935041799da36760bb1a43a7c7c246421182f5`.
- Against frozen `7885736` inputs, **172 app**, **297 i18n**, **three client** inputs
  match. Of three schema inputs, `packages/schema/src/index.ts` differs. App source
  fidelity therefore does **not** imply a byte-identical renderer: its entry JS and
  HTML changed. The HTML difference is exactly the entrypoint filename; CSS and
  other renderer assets match. Across the 90 build members, 86 are unchanged;
  entry JS/HTML and main JS/map differ.
- Main/core source and tests began changing during the audit. Their observed new
  hashes are recorded in [provenance.json](provenance.json), separate from the run's
  source pin. Later corrections require their own build/runtime receipts.

## Auth locale regression

Case **64**, `Live sign-in copy stays readable across eight locales`, passed in
**38.318 seconds**. Pinned test SHA-256:
`7973cd05ffb32367de7afa8254e4d0002bd91a27b64df8fec645b44f24684062`.
The preceding six auth cases remain byte-identical to `7885736`. Reversing only the
coordinator's launch/teardown cleanup changes reproduces the prior test hash
`f6740a98f19f100c04603c7c09b1c2eb0f1d6e7ac40a33d734c6cd7b3bea7600`;
locale, geometry and focus assertions are unchanged.

Decoded `auth-locale-geometry` independently confirms:

- **48 primary states**: eight locales × both themes × refused code, signed in and
  unavailable enrollment.
- **80 measured states**, including 16 send refusals and 16 unavailable-option
  toasts. All seven new `auth.*` keys are exercised.
- **384 text measurements** readable within actual clipping bounds; settled
  opacities pass. Unclipped CSS line-box height is not mistaken for a glyph boundary.
- **144 real Tab stops**, five/two/two per locale/theme, all recorded reachable.
  Pinned assertions additionally require focus, enabled controls, localized copy,
  retained editable wrong code, exact main auth state and the private-state guard.
- The passing final assertions require **zero page/console/fixture errors and
  zero renderer HTTP requests**. Separate error arrays are not attached; this
  conclusion derives from the verified test source and passing result.

The fixture is real loopback HTTP processed by main's SDK and engine, with no UI
success substitution. Auth screenshots establish controlled-fixture behavior, not
a real Cloud account, remote model routing or inference acceptance.

## Visual review

All **123 unique images** were inspected in [sixteen contact sheets](contacts/).
They include light/dark recovery, Bot saves, Code diff/attachment behavior, composer
draft retention, interaction end states, keyboard focus, memory refusal, auth,
Approvals, routines, Search, terminal copy and providers. Some existing cases render
French intentionally; the contact set is not exclusively English.

**19 images** were also inspected full-size:

- Eight dark auth-locale refusals (`png-075`–`png-082`): English, French, Spanish,
  German, Japanese, Korean, Brazilian Portuguese, Simplified Chinese. Every capture
  shows six retained digits, complete error copy and focused Cancel; no tofu or
  new auth control overlap observed.
- Six English auth captures: refusal, signed in and unavailable enrollment,
  light/dark (`png-065`–`png-067`, `png-069`–`png-071`).
- Four Code Approvals captures (`png-083`–`png-086`), 960×640 / 1024×686,
  light/dark: two rows, descriptions below titles, controls separate and focused.
  All eight recorded rows pass below-title, text-box-fit and control-clearance
  predicates; the passing cases include real Tab and actionability checks.
- English initial-auth-read cancellation (`png-073`), to inspect its clipped
  decorative top logo. This is the inherited short-window email-form observation,
  not a blank screenshot or a newly demonstrated inaccessible control.

No blank image was found; every PNG decodes and each contact cell contains rendered
UI. Pending/empty/refusal states, modal dimming and stacked toasts remain identified
by their tests. Contact review does not prove every small label or control's full
geometry; only the scoped assertions and full-size review support those claims.

The earlier email-form **6px Cancel clipping** in FR/DE/JA, plus successful native
Tab scroll and Enter, remains in the [prior locale follow-up](../../sdk-035-admission/auth-locales/README.md#email-step-clipping-follow-up--retained-separately).
This run does not independently repeat that email-step reachability follow-up.
Its primary auth states remain fully readable; the auxiliary send-error probe
explicitly scrolls its target into view. No interactive clipping is waived.

### Bounded prior comparison

The eight current 960×640 dark locale images are **byte-identical**, with **zero
changed pixels**, to the matching prior Linux regression captures. Exact hashes,
canonical paths and comparison scope are in
[bounded-prior-comparison.json](bounded-prior-comparison.json).
No cross-platform/native pixel comparison or all-screen visual-equivalence claim.

## Retention and reproduction of this audit

- [summary.json](summary.json): normalized counts and limits.
- [cases.jsonl](cases.jsonl): one compact record per case, attachment hashes.
- [images.jsonl](images.jsonl): one record per unique PNG, all source aliases,
  contact location and any selected canonical path.
- [selected.json](selected.json): 18 selected originals, one canonical path per hash.
  Sixteen identical files already exist elsewhere in evidence; only two new PNGs
  are stored here. Historical raw reports retain their original inline payloads.
- [e2e.json.gz](e2e.json.gz), [e2e.log.gz](e2e.log.gz): lossless original files,
  deterministic gzip; decompressed SHA-256 values in `summary.json`. Geometry and
  all 34 JSON attachments remain available in the original report, without a
  second large geometry dump.
- [review.json](review.json): exact contact/full-size inventory and observations.
- `SHA256SUMS`: delivered-file integrity.

Audit-only work: no code edits, test execution, build, CI, Mac action or commit.
The passing integrated run and independent core/security correction reviews have
different source scopes; this initial receipt remains immutable history.
