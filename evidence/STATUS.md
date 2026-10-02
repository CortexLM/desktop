# Acceptance status

PR: https://github.com/CortexLM/desktop/pull/36 (`goal/desktop-rewrite`, draft).
The full objective is **not complete**. Evidence below is scoped to implemented surfaces.
Application CI and CodeQL pass at `0e63f87`, with zero open
PR CodeQL alerts. This validates the implemented scope, not the complete objective.

## Latest correction batch

The current correction batch preserves drafts and image attachments across capability
refusals, pending/failed file reads and historical retries; removes nine identified runtime
copy leaks; strengthens static/accessibility audits; fixes configured-only self-host discovery
and validates origin/authentication metadata. Local verification: 131 unit passes (one optional
backend skip), 12 Electron E2Es, 426 state renders, types/lint/audit, Linux packaged smoke.
The discovery suite separately passes 44 stub cases plus one real-backend check. [CI 36997513479](https://github.com/CortexLM/desktop/actions/runs/36997513479)
passes all checks, 12 E2Es each on Linux/macOS, unsigned macOS package/smoke. [Logs and scoped
screenshots](followup/README.md). [Current installed-Mac sweep](mac/0e63f87/README.md):
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
  with suggestions, Plugins & skills installed/public/personal/MCP. Requests remain
  unanswered in `/root/cortex-ui/DESIGN-REQUESTS.md`; no stand-in screens were added.
- **Additional design approval:** Providers, Connection, model capability picker and
  inline tool approval requests remain open. Existing functional controls need design review.
- **Reference revision:** 205 reference versus 213 app states reconciled to eight extra
  Settings variants. Current Home/Components source differs from retained PNGs; source fingerprint,
  matching regenerated coverage and A6/B6 decisions remain pending. No reference page is approved.
  [Exact reconciliation and drift](compare/reference-status.md).
- **Connection behavior:** cloud/self-host mode selection and probes exist; sessions still
  call locally configured providers. Remote auth, model selection and inference routing are
  unfinished. A successful backend probe is not proof of a complete remote connection mode.
  Backend owner confirms no portable reasoning-off or Chat cancel operation. Remote effort/
  detach/reconnect controls need designs; regenerated SDK types and password/MFA designs remain
  requested. Legacy English session titles remain intact because
  default and user-authored titles were stored indistinguishably.
- **Interaction coverage:** several ported surfaces remain preview-only; projects, sign-in,
  billing, updater and file viewers do not become live features merely by rendering in the gallery.
- **Responsive acceptance:** current native captures at 1024×686 and comparisons at 1440×900 do not
  prove every control usable at the 960×640 minimum. Targeted Code/Canvas/Work clipping
  regressions are fixed and pass at 960/1024×640 in both themes; exhaustive coverage remains open.
- **Release:** signing/notarization and Windows CI are not configured. Unsigned test builds
  work; public release readiness is not claimed.

The source rewrite, tests and evidence stay on the feature branch. No merge or main push.
