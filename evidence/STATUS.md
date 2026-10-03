# Acceptance status

PR: https://github.com/CortexLM/desktop/pull/36 (`goal/desktop-rewrite`, draft).
The full objective is **not complete**. Evidence below is scoped to implemented surfaces.
G3's corrected SDK 0.3.1/api-types 0.2.0 passes [scoped desktop admission](sdk-031-admission/README.md):
immutable pins and OTP/local-login/Library contracts verified, dependency intake `4fea24a` adopted.
Media-tail/screenshot defects reproduce; broader auth/identity/turn/history contracts remain
incomplete. The old 0.3.0 HOLD remains. [Bounded sign-in implementation](remote-auth-followup/README.md)
is uncommitted: 201 units plus one optional skip, 90 Electron cases/426 renders including six
controlled auth/read-barrier cases, lint/types/i18n and Linux package/smoke pass.
Real Cloud authentication and remote inference remain unproven.
Later [0.3.2/0.3.3 readback](sdk-next-readback/README.md) verifies consumer corrections;
final replacement admission remains pending the owner cleanup/source handoff.
The [live-recovery batch](live-recovery-followup/README.md) corrects approval-list recovery,
memory acceptance/races, terminal annotations, narrow model metadata and Work font readiness.
Local checks: 188 units plus one optional backend skip; lint/types/i18n zero findings;
83 Electron cases/426 renders, followed by eight passing memory cases after the final
return-navigation correction. Rebuilt Linux package/smoke and 90 member-byte checks pass.
Changed-revision CI `37088533094`: checks/Linux 83/83 pass; macOS 82/83 fails on
`Transition was skipped` in Work's renderer-error assertion. Mac packaging/smoke skipped;
The native-transition correction passes seven local Electron regressions and source review.
Updated [CI 37091082338](https://github.com/CortexLM/desktop/actions/runs/37091082338) passes
at recovery/transition `b0e6d78`; independent review verifies 84 cases/OS and 185 unique images.
[Installed recovery](mac/b0e6d78/README.md) passes twelve recovery/two Work cases but exposes
a preview-departure crash and unreachable long terminal output. Corrections pass 26 targeted
Electron cases after rebuild, lint/types/i18n and Linux package/smoke; updated CI/native pending.
failed native attempts remain retained. Pristine build matches all 90 installed members.
Earlier captures retain their pins; uncommitted sign-in is outside that CI/package.
[Final-head CI 37082159189](https://github.com/CortexLM/desktop/actions/runs/37082159189)
passes all three jobs at `6d96535`; application/package inputs match `f9aca44`.
The [current installed-Mac full sweep](mac/f9aca44/full/README.md) adds 426 native images
at 1024×686, fourteen light/dark menus and native window/navigation readbacks.
[Full fixed-clock comparison](current-full-followup/compare/README.md): 431 renders,
410 references, 21 gaps, mean 0.0379%, maximum 1.73%. Independent CI/comparison reviews verify
artifact/source/image bindings. Work's 1px gap is reproduced as font reflow/scroll anchoring;
its new correction is separate from those original images. Full native review is being consolidated.
The [Work conversion/Bot search batch](live-actions-followup/README.md) passes 178 Node 22 unit
tests plus one optional backend skip, an initial 69-case Electron suite/426 renders and twelve
final targeted cases after original-request text-fragment preservation. Lint/types/i18n and Linux
packaged smoke pass. Independent review found an enabled Create while the Bot list is unavailable;
the correction passes thirteen scoped cases plus rebuild/package/smoke. [CI 37080136101](https://github.com/CortexLM/desktop/actions/runs/37080136101)
passes all jobs at `f9aca44`; [artifact review](live-actions-followup/ci/README.md) and
[installed-Mac proof](mac/f9aca44/README.md) pass: 70 cases per OS and ten targeted native captures.
New 32-state comparison outliers (max 8.19%) are dominated by
uncontrolled clock-selected Work wallpaper; [review](live-actions-followup/compare-review.md)
preserves the original run and remaining residuals. Corrected editor comparison is 8/8, max 0.06%.
[Controlled Work rerun](live-actions-followup/compare-clock/README.md) fixes browser Date/timezone
explicitly: 16/16, computer/takeover 0.00–0.02%, remaining overall maximum 0.45%. Original capture
timezone is not attested; historical ambient outliers remain intact.
The [live-behavior correction](live-behavior-followup/README.md) wires Code model/reasoning choice
and truthful routine outcomes. CI 37074187552 passes 61/61 Electron cases on Linux/macOS,
426 renders and macOS package/smoke, but fails eight locale-render unit cases because their
mock browser environment lacks `localStorage`. The earlier 178-unit pass predates Code integration.
Test-only correction `ea1c54b` passes 178 units on Node 22; its CI checks/Linux pass before
macOS cancellation by documentary `93c1e78`. [Replacement CI 37076113707](https://github.com/CortexLM/desktop/actions/runs/37076113707)
passes all jobs; [independent artifact review](live-behavior-followup/ci-93c1e78/README.md) verifies
both 61-case reports, eleven images and the current package's identical ASAR.
[Installed-Mac proof](mac/d635fcf/README.md) passes on exact `d635fcf`: twelve native captures,
Code model/image refusal/recovery and routine outcomes, both themes at 960×640.
Earlier application `9d704ee` corrects the narrow provider key row;
[CI 37066222793](https://github.com/CortexLM/desktop/actions/runs/37066222793) passes, installed
normal-sidebar verification passes in both themes at 960×640.
[Independent review](mcp-followup/provider-layout/ci/README.md) verifies 52/52 per OS,
321 artifact members and 17 full-size images within its stated scope.
Earlier [CI 37063183382](https://github.com/CortexLM/desktop/actions/runs/37063183382) passes at
`de623fd` (application `ca08282`, serial macOS test harness). Installed credential proof is retained;
independent [artifact review](mcp-followup/ci-de623fd/README.md) passes. At `9d704ee`, the renderer
differs from `cc758a6` only in that row; the new live-behavior batch also changes Code and routines.

Installed `de623fd` verifies MCP encrypted persistence/decryption/removal and provider key
redaction, with native light/dark captures. It also exposed a minimum-width key-row overlap:
label/hint width zero with the sidebar shown. A [targeted layout correction](mcp-followup/provider-layout.md)
passes both-theme regressions and [installed correction proof](mac/9d704ee/README.md). Earlier credential
captures with the sidebar hidden do not establish minimum-width correction acceptance.

## Full-objective acceptance audit

| Requirement | Current disposition |
| --- | --- |
| Lint, types, units | Recovery local lint/types and 188 units plus one optional backend skip pass; changed-revision CI pending. Earlier green `6d96535` CI has 178 units. |
| Every design screen plus provider/image/reasoning flows | Partial: recovery local 83 cases/426 renders, eight final memory cases; earlier CI 70/70 per OS. Missing surfaces, broader live interactions and authenticated Cortex inference remain unproven. |
| Blacksmith macOS package/launch | Green `f9aca44` and `6d96535` CI; installed artifact remains the verified `f9aca44` package. Unsigned arm64 only. |
| Installed Mac, every screen/theme/native chrome/menu | Current `f9aca44`: 426 registered-state native captures at 1024×686, fourteen native menus, minimize/fullscreen/Gallery/Chat readbacks. Ten Work/Search captures at 960×640; twelve earlier Code/routine images remain pinned. Absent surfaces and exhaustive live/minimum-window acceptance remain open. |
| No unjustified reference gap | Unproven: original full run compares 410/431, mean 0.0379%, max 1.73%, 21 gaps. Final recovery scope 42/58, max 0.0638503%, sixteen Settings gaps; Done removes the 1px gap, retaining 236/240 mismatches. Earlier intermediate 13/235 frames and original wallpaper/scroll scores remain separate; new imports unauthorized. |
| Automated i18n audit | Recovery local: 63 files, 2,269 used keys, 3,398 English keys, zero findings. Shell annotations receive eight-locale runtime coverage; unverified legacy records remain verbatim. Exhaustive dynamic-copy coverage remains unproven. |

All six together, all live modes and all requested surfaces are **not complete**. Latest environment
check still has no `CORTEX_REAL_BASE_URL`, `CORTEX_REAL_API_KEY` or `CORTEX_TEST_BACKEND_URL`.

## Current MCP contract correction

Complete connection configuration moves from SQLite/API responses to main-only credentials;
public reads expose metadata only. Credential-file updates preserve the prior store on corrupt
input or failed write. Migration, pending lifecycle cancellation and redirect refusal have
deterministic regressions. The first full local run passes 169 units plus one optional backend
skip and 51 Electron cases/426 renders; independent review added three more lifecycle/redirect
regressions plus a later save/disable case, all reproduced and corrected. Updated units pass
**173 + one optional skip**,
targeted engine/provider UI and Linux packaged checks pass. [Evidence](mcp-followup/README.md).
Final scoped source review passes. [CI 37061251022](https://github.com/CortexLM/desktop/actions/runs/37061251022)
passes static checks and 51/51 Linux E2Es; macOS passes 50/51 including MCP, then navigation
stalls waiting for element stability. The next run at `de623fd` passes 51/51 per OS with macOS
serialized, including package/smoke; no assertion or timeout was relaxed. This does not establish
the earlier stalls' cause or erase those failed attempts.
The intervening documentation-only [CI 37057583278](https://github.com/CortexLM/desktop/actions/runs/37057583278)
failed one macOS screenshot capture at `keyboard.spec.ts:187` after fonts loaded (49/50).
Application/test inputs matched `f2754be`; trace review confirms capture timeout, cause unproven,
separate from the new MCP correction and its CI.

## Current admission correction

The engine now reserves a session before asynchronous admission, rejects concurrent prompts,
and honors abort/delete before persistence, including parent deletion and synchronous event
listeners. Image/PDF capability checks include replayed history when changing models.
Seven deterministic regressions failed before their respective corrections. Local **138 unit
tests pass**, one optional backend test skipped without its URL; lint/types/i18n pass.
[CI 37055151545](https://github.com/CortexLM/desktop/actions/runs/37055151545) at `f2754be` passes
**50/50 per Linux/macOS**, 426 registered renders, added history-refusal UI assertions in both
themes, unsigned macOS packaging/smoke and CodeQL. Linux packaged smoke also passes.
[Logs and regression evidence](admission-followup/README.md). Exact installed artifact adds
[two native Mac captures](mac/f2754be/README.md), refusal/recovery assertions, zero renderer errors.
Earlier native/frozen images retain their original package revisions.

## Retained application evidence

Frozen-source integration is pushed at `5ced8aa`. Local static checks and Linux packaged smoke
pass. The full Electron suite passes **40/40**, zero retries/flaky/skipped cases, including
**426 registered state renders**. [Follow-up evidence](frozen-followup/README.md).
[CI 37015801908](https://github.com/CortexLM/desktop/actions/runs/37015801908) passes on both
platforms, including the unsigned macOS package/smoke. [Installed Mac](mac/5ced8aa/README.md)
records 426 native captures, 14 menus and native actions. [Frozen comparison](compare-7b388e2d9674/README.md)
records 410 comparisons, mean 0.0517%, max 1.74%, 21 explicit reference gaps.
CI screenshot review found narrow Work-board overflow and refusal-toast occlusion. Their
subsequent responsive patch `5610ee9` passes **46/46** local Electron tests, 426 state renders,
static checks and Linux packaged smoke. [Responsive proof](responsive-followup/README.md);
[CI 37021275153](https://github.com/CortexLM/desktop/actions/runs/37021275153) passes.
The three outlier corrections are pushed at `dc7f529`: Work preview activity, Code instruction
typography and inactive sidebar dimming. [Fidelity proof](fidelity-followup/README.md) records
46/46 local Electron cases, all static checks, Linux package/smoke and 62 targeted frozen
comparisons. [CI 37024188829](https://github.com/CortexLM/desktop/actions/runs/37024188829)
found two responsive-test synchronization races: geometry sampled before native resize
settled, and a control evaluated while React replaced the previous hash route. Renderer-ready
waits preserve both layout assertions.
Test-only correction `8b90a8e` passes all eight responsive cases locally;
[CI 37025236580](https://github.com/CortexLM/desktop/actions/runs/37025236580) passes **46/46**
Electron cases per Linux/macOS, static checks, unsigned macOS packaging and launch smoke.
[Installed Mac correction proof](mac/8b90a8e/README.md): twelve native captures at 960×640,
both appearances, covering wrapped boards, preview activity, typography and refusal recovery.
Native capture pauses the Chat toast clock; CI recovery checks use real timers.
Final artifact review found further existing gaps: nested Work and wide-Chat toasts cover
composer controls, and never-admitted Work tasks claim Done. Their corrections are under
integrated verification at `41998a8`; the green run above does not establish those fixes. [Recovery follow-up](recovery-followup/README.md)
records dock anchoring, persisted completion and the new regression assertions.
[CI 37032922991](https://github.com/CortexLM/desktop/actions/runs/37032922991) passes 46/46
on Linux and 45/46 on macOS; the remaining failure is rapid keyboard Work navigation.
The separately authorized reduced-motion correction is pushed at `9924911`: CSS transitions
use 0s, animations retain 1ms. Twenty targeted Electron cases pass, including startup text
colors in both themes. Draft Code automation screens still await independent acceptance.
[CI 37035107514](https://github.com/CortexLM/desktop/actions/runs/37035107514) passes **47/47**
per Linux/macOS, zero retries/flaky/skips, static checks, macOS package/smoke. The earlier
rapid-selection failure remains under source investigation despite this passing run.
Navigation correction `cc758a6` passes **50/50** local Electron cases, 426 state renders,
static checks and Linux packaged smoke. Three held-transition regressions reproduce and fix
premature Work remount, discarded newer tab intent and a Back action overridden by a stale
timer. Each pre-fix failure is retained. [CI 37039827971](https://github.com/CortexLM/desktop/actions/runs/37039827971)
passes **50/50 per Linux/macOS**, zero retries/flaky/skips, checks and macOS packaging/smoke.
Independent artifact review inspected all 88 E2E images, 26 also full-resolution; no blocking
regression found within that scope. Final source comparison adds 32 captures / 30 references,
two explicit Home-menu gaps, maximum difference 0.45%.
[Installed Mac cc758a6](mac/cc758a6/README.md) adds eighteen native captures in both themes,
covering reduced-motion text, Work layout/activity and Chat/Code/Work refusal recovery.

The historical table below remains pinned to `0e63f87`; newer evidence is linked above.

## Previously verified correction batch — 0e63f87

The previously verified correction batch preserves drafts and image attachments across capability
refusals, pending/failed file reads and historical retries; removes nine identified runtime
copy leaks; strengthens static/accessibility audits; fixes configured-only self-host discovery
and validates origin/authentication metadata. Local verification: 131 unit passes (one optional
backend skip), 12 Electron E2Es, 426 state renders, types/lint/audit, Linux packaged smoke.
The discovery suite separately passes 44 stub cases plus one real-backend check. [CI 36997513479](https://github.com/CortexLM/desktop/actions/runs/36997513479)
passes all checks, 12 E2Es each on Linux/macOS, unsigned macOS package/smoke. [Logs and scoped
screenshots](followup/README.md). [Historical installed-Mac sweep](mac/0e63f87/README.md):
426 native captures, 14 menus, fullscreen/minimize and native Gallery navigation observations.

| Required proof | Evidence | Limits |
| --- | --- | --- |
| 1. Lint, types, units | [Green CI](https://github.com/CortexLM/desktop/actions/runs/36997513479), code `0e63f87`; [summary](followup/ci.json) | 131 unit tests pass; one optional backend test skipped without its URL; two existing hook warnings |
| 2. Electron E2E | 12 tests pass on Linux and macOS, no retries/flaky/skips; 426 preview renders, provider/composer flow, window/menus, navigation, preview startup, draft/file safety and small-window controls | CI inference endpoint is deterministic; every preview render is covered, not every interaction. Gallery follow-up adds bounded-frame and immediate-exit assertions |
| Real inference supplement | [Real provider](real-provider.json), [replay script](../scripts/verify-real-provider.mjs) | Earlier build: real GPT-6 Astra image response plus reasoning; test-only model alias; built IPC/engine path, not packaged UI. Current replay credentials absent |
| 3. macOS build/package/launch | Same green run, Blacksmith macOS 26, unsigned arm64, `SMOKE OK` | CI native screen capture failed; renderer screenshot inspected. Native chrome is verified separately on the remote Mac |
| 4. Remote Mac | [0e63f87: 426 native captures, 14 menus](mac/0e63f87/README.md), [install metadata](mac/0e63f87/install.json), [window actions](mac/0e63f87/window-actions.json), [Gallery](mac/0e63f87/gallery.json) | Clean unsigned install; both appearances inspected. Direct SSH launch failed native appearance/fullscreen; GUI LaunchServices relaunch passed. Preview rendering, not exhaustive live acceptance |
| 5. Design comparison | [Report](compare/README.md), [421 reference comparisons](compare/report.json), [retained side-by-side shots](compare/index.html) | Mean 0.04%, max 0.78%; ten Settings states lack reference shots; mascot review boards are not routed screens |
| 6. Copy audit | [Zero-finding run](followup/audit.log), [static regression](../tests/unit/audit-i18n.test.ts), [runtime regression](../tests/unit/runtime-copy.test.ts) | Local constants/map inputs, accessibility attributes and targeted eight-locale rendered copy checked; imported values/dynamic keys still lack complete dataflow proof |

## Missing inputs and unfinished work

- **Design input:** Space welcome/pages/sites/images/recents, standalone Scheduled tasks
  with suggestions, Plugins & skills installed/public/personal/MCP. The design owner has
  delivered complete combined candidate `3e99a045` / `45839`; approved source/state integration remains pending in
  `/root/cortex-ui/DESIGN-REQUESTS.md`.
  Latest Product handoff: all eight groups on 17 reviewed routes have scoped A/B confirmation.
  MCP detection remains bounded to recognized credential formats; empty registry blocks until
  explicit demo entry. PUBLIC A1–A5 is also double-confirmed. The
  [scoped closure readback](recovery-followup/scoped-design-closures.md) resolves the earlier
  disposition conflict; approved source/state imports and whole-page acceptance remain pending.
  The [local-contract map](recovery-followup/productivity-contract-map.md) identifies missing
  plugin/skill lifecycle, task consent/timezone and Space cover gaps. The MCP secret boundary is
  corrected and verified above; save-versus-connect semantics remain a separate integration question.
- **Additional design approval:** Providers, Connection, model capability picker and
  inline tool approval drafts now have an eight-route/94-variant Platform receipt. Read-only
  verification checks 396 capture hashes, 376 distinct passing views (372 initial plus four
  unchanged confirmations), 52 targeted groups and all three served build assets. At that
  readback, Platform sources matched later scoped corrective hashes, not the original receipt. Existing
  functional controls still need approved integration; prototype behavior is not API availability.
  The [eight-route contract map](recovery-followup/platform-contract-map.md) identifies historical
  attachment deletion as a desktop contract conflict. `b1b9130` now has double scoped retention/
  refusal confirmation; the combined candidate preserves its exact runtime bytes. Source/state
  import permission remains pending; A's collector negative/offline adjudication is preserved.
- **Reference revision:** 205 reference versus 213 app states reconciled to eight extra
  Settings variants. Source freeze `2026-10-02-7b388e2d9674` and Components scope delivered;
  Home A7-final/B7-final approve their verified/inherited scope. Integration and matching frozen
  screenshot coverage are recorded separately from the historical report.
  [Exact reconciliation and drift](compare/reference-status.md).
  Later corrective and integrated prototype receipts are source-bound separately; their
  116-route inventory is not the desktop app registry or whole-page acceptance. The iOS web
  freeze's 22 checks confirm three corrections, without native-iPhone certification.
  A [bounded correction crosswalk](recovery-followup/corrected-reference-map.md) records five
  candidate gaps in command-model handoff and preview prompt/task/specialist identity.
  All 63 historical design defects now have double scoped confirmation, including M02 on
  `5daa8d29`. This does not close the five desktop integration candidates. Earlier Studio
   `DESK-B-R01/R02` failures remain recorded; residual candidate `da5fd54b` now has independent
   scoped A/B confirmation for R01 cleanup and R02 Studio session-draft validation. Principal-store
   shape and external storage events remain outside that closure.
  Independent reconciliation confirms **85 scoped defect closures** across the four matrices;
   the quoted `10744dc` ledger already contained them. Attachment `b1b9130` is double scoped-confirmed;
   approved integration disposition remains pending. G4 Code options/worklog/full Bot-form requests remain
   distinct from these closures.
  iOS reviews of 38 new routes are assigned; no native acceptance follows.
- **Active remote integration:** cloud/self-host mode selection and probes exist; sessions still
  call locally configured providers. Remote auth, model selection and inference routing remain
  active, unfinished deliverables. [Current SDK handoff](recovery-followup/remote-integration-readback.md)
    at 3 October 00:32 UTC finds no new versioned pair; the PM heads retain their 15:05 scope.
  The [implementation sequence](../docs/connection-modes.md#active-remote-integration) covers
  main-only sessions, remote routing, exact-path proof and a revision-matched native package.
  A successful backend probe is not proof of a complete remote connection mode.
  Backend owner confirms no portable reasoning-off or Chat cancel operation. Remote effort/
  detach/reconnect and password/MFA drafts await independent design acceptance; regenerated SDK
  types remain requested. Legacy English session titles remain intact because
  default and user-authored titles were stored indistinguishably.
  G2's current immutable schema is `d6d46014` at backend `70a3056f` (422 operations);
  its five auth/upload body omissions are corrected. Desktop still awaits the SDK owner's
  regenerated package and runtime fixes before authenticated remote integration.
- **Interaction coverage:** several ported surfaces remain preview-only; projects, sign-in,
  billing, updater and file viewers do not become live features merely by rendering in the gallery.
  The [current product-surface audit](current-full-followup/completion-audit.md) also records
  unwired voice/research/image-generation, dedicated Code review/environment workflows,
  Work feeds and memory/preferences controls. Memory write recovery does not wire the
  separate memory-enable policy. Preview rendering and local tool execution do not establish
  those broader workflows.
- **Responsive acceptance:** the current full native sweep at 1024×686 (earlier 1024×685) and comparisons at 1440×900 do not
  prove every control usable at the 960×640 minimum. Targeted Code/Canvas/Work clipping
  regressions are fixed and pass at 960/1024×640 in both themes; exhaustive coverage remains open.
- **Release:** signing/notarization and Windows CI are not configured. Unsigned test builds
  work; public release readiness is not claimed.

The source rewrite, tests and evidence stay on the feature branch. No merge or main push.
