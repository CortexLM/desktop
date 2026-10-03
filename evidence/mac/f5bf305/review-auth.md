# Installed f5bf305 — independent auth evidence audit

**Bounded approval: six English native auth captures, 960×640, both themes.** All originals
reviewed full-size; archive, source, assertion and decoded-pixel checks pass. This is an
offline audit of the retained run, not a new Mac execution.

## Artifact and source binding

| Verified item | Result |
| --- | --- |
| Application Git pin | `f5bf305473db12fddfddcda890a01794f02f578f` |
| Documentary / artifact workflow pin | `1076c2584941cf054efffaf709a149b4195bc1c4` |
| Retained GitHub receipt | Artifact **11267761992**, run **37105137365**, **144,676,617 bytes**; [receipt](artifact.json) |
| Outer ZIP SHA-256 | `d3d05506cd42d69a5fa5214372cf4d55a700bfe6488a8a7b14001360e282f3f5` — recomputed, equals retained API digest |
| Inner ZIP SHA-256 | `7dc146e4ad02aaf877b70aef312ce61e13292b42f391d0b7583dc4c11f8f1565` — outer member equals retained `Cortex.zip` byte-for-byte |
| ASAR SHA-256 | `d34d6d8609045f56851a6004f5c7bb185108cd743732ff8b79d6e3689df7f14c` — ZIP member equals retained `app.asar`, installation and all capture identities |
| Embedded build members | **90/90** match [package receipt](package.json), frozen member receipt and actual `/tmp/opencode/build-remote-final` bytes; ASAR additionally contains its root `package.json` |
| Resources | **104 catalogs: 13 per locale × eight locales**, plus **one summarize skill**; all **105** ZIP resource bytes match application Git. No packaged fixture or `.source.json` resource. |
| Package inputs | **514/514** hashes match application Git and documentary Git; frozen/retained receipts agree |
| Main sourcemap | **32/32 physical workspace sources** match application/documentary Git; preload separately **1/1** |
| Embedded SDK | **16/16** sources match unmodified SDK **0.3.5** archive; **16/16** API-types sources match its **0.2.0** archive |

The SDK archive hash is `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8`;
API-types is `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877`.
Both current archives equal Git at **f5bf305** and **7885736**. Main's map has **980 entries**:
32 workspace, 16 SDK, 16 API-types, one synthetic `<define:import.meta.env>`, 915 other
dependencies. The synthetic entry is not a Git source. Nineteen other dependency entries
omit `sourcesContent`; no claim of Git/archive validation for those 915 dependencies.
No build reproduction or fresh GitHub/CI query was performed.

### Exact source drift and input selectors

- All **172 `packages/app` inputs** and **297 `packages/i18n` inputs** are unchanged from
  **7885736**. The 297 are not 297 runtime catalogs: **104 catalogs, 84 catalog source
  stamps, 56 preview fixtures, 49 fixture source stamps, three source files, one package file**.
- All **473 renderer inputs** match application Git. Only `packages/schema/src/index.ts`
  differs from the prior renderer input set. Comparator algorithm
  `sha256(sorted(path + ":" + fileSHA256).join("\n"))`, without a trailing newline,
  reproduces `5361c34082a62dfb944d47fc27b11695d3f9826870bb928f74670ba778cc3d9b`.
  The separately recorded NUL/newline algorithm reproduces
  `fb6220f8df77bdee09241fb2084417d3e3cc4924c8a1a4fbfa19200e09e96acb`.
- Main workspace drift: six modified sources — `packages/core/src/{bus,connection,index}.ts`,
  `packages/desktop/src/{main,remote-session}.ts`, `packages/schema/src/index.ts` — plus
  new `packages/core/src/remote-sessions.ts` and `packages/desktop/src/remote-chat.ts`.
  `packages/core/README.md` is the seventh modified shared input. These are main/core
  foundation changes; the pinned app/client/protocol/server have no remote-service caller.
- **514 versus prior 540 is a receipt-selection difference.** Precisely **29 prior-only
  records** remain present in current Git: **17 package test/support paths and 12 scripts**.
  Precisely **three current-only records** are the two new service files above and
  `skills/summarize/SKILL.md`. Thus `540 - 29 + 3 = 514`; no deleted-input claim.
  Exact path lists are retained in `/tmp/opencode/native-foundation-audit/sources.json`.
- The **21** documentary changes match [documentary-binding.json](documentary-binding.json),
  all under `docs/` or `evidence/`; all selected runtime inputs remain identical between
  application and artifact workflow pins. Audit comparisons use these fixed revisions.

## Six full-size captures

All six original PNG hashes match [manifest](auth/manifest.json) and
[retention receipt](auth/retained.json). Retained WebP hashes match independently;
decoded **RGBA bytes, including alpha, are exactly equal** to originals. All dimensions
are **960×640**, with six unique image hashes within this run. Contact sheet excluded
from acceptance.

| State | Light | Dark | Full-size observation |
| --- | --- | --- | --- |
| Wrong code | [capture](auth/remote-code-refused-light.webp) | [capture](auth/remote-code-refused-dark.webp) | Six retained zero digits, visible refusal copy, Continue/Resend/address/Cancel controls; no clipping |
| Signed in | [capture](auth/remote-signed-in-light.webp) | [capture](auth/remote-signed-in-dark.webp) | Readable process-lifetime/local-provider limitation; Continue and connection settings visible |
| MFA unavailable | [capture](auth/remote-mfa-unavailable-light.webp) | [capture](auth/remote-mfa-unavailable-dark.webp) | Honest unavailable heading/copy; address and Cancel controls visible; no factor/QR material |

Native chrome/traffic lights and shown sidebar are visible in all six. No obstructing
sheet, overlay, raw backend error or apparent credential leak. Visible addresses and codes
are explicit controlled fixtures. Manifest geometry records **40 element boxes** across
the six captures; all ready, opaque and unclipped. The actual script checks loaded fonts,
native appearance, no page overflow, enabled controls and center hit targets before/after
capture; transparent OTP input is checked through its six painted cells.

## Assertion source and fresh-run identity

Read the complete actual `/tmp/opencode/remote-auth-native.mjs` and loopback backend.
Both byte-match prior retained scripts, prior manifest/hash receipts and their copies
committed at the application pin:

- Native helper: `de1b96a4897d81f51ab6faf3f014835e41688a433959ccded8e302a41f77ae11`.
- Backend: `22b6d8cb958db2c7d749b737329f169894435d995ca67e6e929cd96eec79ee65`.
- Current manifest: `9b36564a9387b10b16a4f4608f659bffbd0e013d04fb87f7b4ad041ed40fdcb6`;
  original and retained copies are byte-identical.

**All six current PNG hashes and retained WebP bytes equal 7885736's auth images.** Pixel
identity is consistent with unchanged UI; it does not identify the installed artifact.
This run's retained binding is independently specific:

- **2026-10-03 07:21:58.859–07:24:40.322 UTC**, PID **52666**, native window **8396**.
- Fixture run **`75a4e3fc-33f9-456a-a944-c443df353866`**, started **07:21:41.488 UTC**,
  isolated `/private/tmp/opencode/desktop-remote-auth-f5bf305`.
- Actual script hashes `/Applications/Cortex.app/Contents/Resources/app.asar` before
  the run, at every capture and after completion, requiring **d34d6d86…**. It identifies
  the installed executable, matches CDP browser PID to the foreground native window,
  asserts one process/window and fresh isolated engine/renderer state.
- Prior receipt has PID **49500**, window **8349**, fixture run
  `7636aea1-9b54-4740-9b26-bdbc59cf361b`, ASAR **8bab83a0…**, start **05:05:51.848 UTC**.
  Fresh identity/assertion receipts, not reused pixel identity, establish current binding.

The **11 recorded checks** cover real auth IPC with renderer-supplied `signedIn` ignored;
wrong-code editability; one held request despite double-click; accepted sign-in; same-process
renderer reload; device-local Account sign-out; cancelled late replies; status-only unavailable
MFA enrollment/address reset/cancel. Both themes execute each auth scenario.

Fixture receipt: **6 email / 8 code / 8 finished code requests**, **2 wrong codes, 2 sessions,
2 enrollments, 2 aborted replies**, **0 logout/discovery/errors**, **10/10 private-material
inspections**; no held request remains. Inspection source checks sanitized public IPC/headers,
DOM, local/session storage, cookies, IndexedDB and caches against fixture-owned private values.
Manifest records **zero page errors, console errors, renderer HTTP requests or unexpected
dialogs**. Cleanup restores connection, releases held responses and restores English/dark
route state; this receipt does not establish helper shutdown or Mac lease release.

## Approval boundary

Approved evidence: **installed f5bf305 / SDK 0.3.5, six English auth captures and their scoped
controlled-loopback assertions**. No remaining blocker in that scope.

The packaged private remote Chat code is source-bound here; these auth actions do not execute
its core HTTP turn/history service. No installed-Mac private-core runtime, real Cloud account,
remote inference, process-restart persistence, server revocation or whole-product acceptance.
The **eight-locale native follow-up remains outside this reviewed batch**; packaged eight-locale
resource integrity is not proof of eight-locale native execution.

Offline verifier passed: `python3 /tmp/opencode/native-foundation-audit/verify.py`.
Receipts: that directory's `integrity.json`, `sources.json`, `images.json`, `auth.json`,
`additional-source-checks.json`, `summary.json`, `visual-review.json`.
Auditor-only initial counting assumptions/corrections remain recorded there. No Mac/SSH/GUI,
build, test suite, CI query, commit or delegation performed for this audit.
