# Acceptance status

PR: https://github.com/CortexLM/desktop/pull/36 (`goal/desktop-rewrite`, draft).
The full objective is **not complete**. Evidence below is scoped to implemented surfaces.
Latest application CI and CodeQL pass at `f2754be`. This validates the implemented scope,
not the complete objective. Renderer source remains `cc758a6`.

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
  delivered documented drafts; independent approval and immutable integration delivery remain pending in
  `/root/cortex-ui/DESIGN-REQUESTS.md`.
  Latest Product handoff: all eight groups on 17 reviewed routes have scoped A/B confirmation.
  MCP detection remains bounded to recognized credential formats; empty registry blocks until
  explicit demo entry. PUBLIC A1–A5 is also double-confirmed. The
  [scoped closure readback](recovery-followup/scoped-design-closures.md) resolves the earlier
  disposition conflict; approved unified package and whole-page acceptance remain pending.
  The [local-contract map](recovery-followup/productivity-contract-map.md) identifies missing
  plugin/skill lifecycle, task consent/timezone, Space cover and MCP secret-handling contracts.
- **Additional design approval:** Providers, Connection, model capability picker and
  inline tool approval drafts now have an eight-route/94-variant Platform receipt. Read-only
  verification checks 396 capture hashes, 376 distinct passing views (372 initial plus four
  unchanged confirmations), 52 targeted groups and all three served build assets. At that
  readback, Platform sources matched later scoped corrective hashes, not the original receipt. Existing
  functional controls still need approved integration; prototype behavior is not API availability.
  The [eight-route contract map](recovery-followup/platform-contract-map.md) identifies historical
  attachment deletion as a desktop contract conflict. The 19:15 UTC owner-confirmed `b1b9130`
  retention/refusal candidate still awaits independent approval and final integration disposition.
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
   the quoted `10744dc` ledger already contained them. At the 19:15 UTC snapshot, attachment
   candidate `b1b9130` has owner-confirmed retention/refusal; independent approval and final
   integration disposition remain pending. G4 Code options/worklog/full Bot-form requests remain
   distinct from these closures.
  iOS reviews of 38 new routes are assigned; no native acceptance follows.
- **Active remote integration:** cloud/self-host mode selection and probes exist; sessions still
  call locally configured providers. Remote auth, model selection and inference routing remain
  active, unfinished deliverables. [Current SDK handoff](recovery-followup/remote-integration-readback.md)
   at 19:10–19:15 UTC finds no new versioned pair; the PM heads retain their 15:05 scope.
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
- **Responsive acceptance:** the full native sweep at 1024×685 and comparisons at 1440×900 do not
  prove every control usable at the 960×640 minimum. Targeted Code/Canvas/Work clipping
  regressions are fixed and pass at 960/1024×640 in both themes; exhaustive coverage remains open.
- **Release:** signing/notarization and Windows CI are not configured. Unsigned test builds
  work; public release readiness is not claimed.

The source rewrite, tests and evidence stay on the feature branch. No merge or main push.
