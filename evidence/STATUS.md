# Acceptance status

PR: https://github.com/CortexLM/desktop/pull/36 (`goal/desktop-rewrite`, draft).
The full objective is **not complete**. Evidence below is scoped to implemented surfaces.
Application CI and CodeQL pass at `8b90a8e`. This validates the implemented scope,
not the complete objective.

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
- **Additional design approval:** Providers, Connection, model capability picker and
  inline tool approval requests remain open. Existing functional controls need design review.
- **Reference revision:** 205 reference versus 213 app states reconciled to eight extra
  Settings variants. Source freeze `2026-10-02-7b388e2d9674` and Components scope delivered;
  Home A7-final/B7-final approve their verified/inherited scope. Integration and matching frozen
  screenshot coverage are recorded separately from the historical report.
  [Exact reconciliation and drift](compare/reference-status.md).
- **Connection behavior:** cloud/self-host mode selection and probes exist; sessions still
  call locally configured providers. Remote auth, model selection and inference routing are
  unfinished. A successful backend probe is not proof of a complete remote connection mode.
  Backend owner confirms no portable reasoning-off or Chat cancel operation. Remote effort/
  detach/reconnect and password/MFA drafts await independent design acceptance; regenerated SDK
  types remain requested. Legacy English session titles remain intact because
  default and user-authored titles were stored indistinguishably.
- **Interaction coverage:** several ported surfaces remain preview-only; projects, sign-in,
  billing, updater and file viewers do not become live features merely by rendering in the gallery.
- **Responsive acceptance:** the full native sweep at 1024×685 and comparisons at 1440×900 do not
  prove every control usable at the 960×640 minimum. Targeted Code/Canvas/Work clipping
  regressions are fixed and pass at 960/1024×640 in both themes; exhaustive coverage remains open.
- **Release:** signing/notarization and Windows CI are not configured. Unsigned test builds
  work; public release readiness is not claimed.

The source rewrite, tests and evidence stay on the feature branch. No merge or main push.
