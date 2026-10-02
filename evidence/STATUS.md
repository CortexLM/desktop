# Acceptance status

PR: https://github.com/CortexLM/desktop/pull/36 (`goal/desktop-rewrite`, draft).
The full objective is **not complete**. Evidence below is scoped to implemented surfaces.
Application CI and CodeQL pass at `2a9d1ad` (application code `7341cc7`), with zero open
PR CodeQL alerts. This validates the implemented scope, not the complete objective.

## Follow-up under verification

The current correction batch preserves drafts and image attachments across capability
refusals, pending/failed file reads and historical retries; removes nine identified runtime
copy leaks; strengthens static/accessibility audits; fixes configured-only self-host discovery
and validates origin/authentication metadata. Local verification: 131 unit passes (one optional
backend skip), 12 Electron E2Es, 426 state renders, types/lint/audit, Linux packaged smoke.
The real-backend discovery suite separately passes 45/45. Current macOS CI/native evidence
has not yet been refreshed for these changes. The older proof table below stays revision-pinned.

| Required proof | Evidence | Limits |
| --- | --- | --- |
| 1. Lint, types, units | [Green CI](https://github.com/CortexLM/desktop/actions/runs/36964561125), code `2a9d1ad`; [summary](ci/run-36964561125.json) | 65 unit tests pass; one optional backend test skipped without its URL; two existing hook warnings |
| 2. Electron E2E | 11 tests pass on Linux and macOS, no retries/flaky/skips; 426 preview renders, provider/composer flow, window/menus, navigation, preview startup and small-window controls | CI inference endpoint is deterministic; every preview render is covered, not every interaction. Gallery follow-up adds bounded-frame and immediate-exit assertions |
| Real inference supplement | [Real provider](real-provider.json), [replay script](../scripts/verify-real-provider.mjs) | Real GPT-6 Astra image response plus reasoning; test-only model alias; built IPC/engine path, not packaged UI |
| 3. macOS build/package/launch | Same green run, Blacksmith macOS 26, unsigned arm64, `SMOKE OK` | CI native screen capture failed; renderer screenshot inspected. Native chrome is verified separately on the remote Mac |
| 4. Remote Mac | [426 baseline captures and 14 menus](mac/README.md), [40 follow-up captures and corrected menus](mac/followup/README.md), [final Gallery check](mac/gallery/manifest.json) | Revisions/asar hashes recorded; follow-up clean install excludes obsolete raw fixtures. Full latest-tip sweep and signing not claimed |
| 5. Design comparison | [Report](compare/README.md), [421 reference comparisons](compare/report.json), [retained side-by-side shots](compare/index.html) | Mean 0.04%, max 0.78%; ten Settings states lack reference shots; mascot review boards are not routed screens |
| 6. Copy audit | [Zero-finding run](ci/audit.log), [audit regression test](../tests/unit/audit-i18n.test.ts) | Common static copy sinks checked, including local constants; runtime/imported values and dynamic keys are not a complete dataflow proof |

## Missing inputs and unfinished work

- **Design input:** Space welcome/pages/sites/images/recents, standalone Scheduled tasks
  with suggestions, Plugins & skills installed/public/personal/MCP. Requests remain
  unanswered in `/root/cortex-ui/DESIGN-REQUESTS.md`; no stand-in screens were added.
- **Additional design approval:** Providers, Connection, model capability picker and
  inline tool approval requests remain open. Existing functional controls need design review.
- **Connection behavior:** cloud/self-host mode selection and probes exist; sessions still
  call locally configured providers. Remote auth, model selection and inference routing are
  unfinished. A successful backend probe is not proof of a complete remote connection mode.
  Backend reasoning-off/cancel-turn contracts, regenerated SDK types and password/MFA designs
  have been requested from their owners. Legacy English session titles remain intact because
  default and user-authored titles were stored indistinguishably.
- **Interaction coverage:** several ported surfaces remain preview-only; projects, sign-in,
  billing, updater and file viewers do not become live features merely by rendering in the gallery.
- **Responsive acceptance:** native captures at 1024×685 and comparisons at 1440×900 do not
  prove every control usable at the 960×640 minimum. Targeted Code/Canvas/Work clipping
  regressions are fixed and pass at 960/1024×640 in both themes; exhaustive coverage remains open.
- **Release:** signing/notarization and Windows CI are not configured. Unsigned test builds
  work; public release readiness is not claimed.

The source rewrite, tests and evidence stay on the feature branch. No merge or main push.
