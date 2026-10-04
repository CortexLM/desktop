# Documentation-head macOS capture timeout — adjudication

Reviewed: **2026-10-02T20:40:06Z**. **Confirmed screenshot-operation timeout; root cause unproven. Run remains failed.**

## Provenance
- Run: https://github.com/CortexLM/desktop/actions/runs/37057583278 ; macOS job `111005973717`, completed `2026-10-02T20:02:46Z`.
- Head: `1e91a43fb2e88e4c4b721c70b521f5e83403e495`; report checkout: synthetic merge `d612a9e6904175174a8a6095cb481a83c93b60af`.
- GitHub commit API confirms merge parents: base `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d`, that head. Merge/head tree both `e55c7de030cd9ecb07510fd409f18567dcbc454f`.
- `f2754be` and `1e91a43` have identical `packages`, `tests`, `scripts`, dependency lock, root package, Playwright config and workflow inputs. Shared packages tree `3176b1951b6c5ef4f9592abc90797a0f10b4a0b5`; tests tree `6fc025c2190a9fb2c2eedd6c49b91e56206bda83`.
- Previous run `37055151545` remains separately green: its retained macOS report records this test passed in 14,218 ms, retry 0. That does not erase this failure.
- Supplied CI JSON: checks/Linux jobs successful; brief reports Linux 50/50. Downloaded macOS JSON: **49 expected, 1 unexpected, 0 skipped/flaky**, failed attempt retry 0; 426 state renders logged. macOS packaging/smoke **skipped**.
- Downloaded only failed-run artifact **`macos`, ID `11250180503`, 12,559,950 bytes**. Exact retained members: [macOS report](macos-e2e.json), [trace](trace.zip), [error context](error-context.md); [SHA-256 manifest](SHA256SUMS).
- Outer ZIP SHA-256 matches GitHub digest: `f2353734df952812c5f57101c85bc980670c9f43dd8f981e24d6ff13196ca65a`.
- Original trace member: `test-results/artifacts/keyboard-frozen-shell-moti-289d0-wins-and-hidden-menus-close/trace.zip`, retained as `trace.zip`, 11,221 bytes; SHA-256 `68cbe8b26321a509bbb2f287da266926a563c1ec24744f69ac59f5a51c6b4576`.
- `error-context.md` came from the same artifact directory; SHA-256 `37c5040b213321798e2433898977f54ea545b380c32c49207af18291af2d2f69`.
- Original `test-results/e2e.json`, retained as `macos-e2e.json`; SHA-256 `acbb1366c3ee535091d13f7ba470ec4da27747c856ff47a0a765dd41cc390e45`.
- Trace-embedded `keyboard.spec.ts` and `fixtures.ts` match `1e91a43` byte-for-byte. App/theme analysis uses that revision; newer MCP work is separate.

## Observed failure
- Test: `tests/e2e/keyboard.spec.ts:130`, “frozen shell motion settles, latest tab wins and hidden menus close”.
- Exact failed call, **187:16**: `await page.screenshot({ path: shot, animations: "disabled" });`; `shot = test.info().outputPath("frozen-theme-dark.png")`.
- Error: `TimeoutError: page.screenshot: Timeout 30000ms exceeded.` This is an operation timeout, not the 120,000 ms test deadline.
- Trace `pw:api@91`: monotonic `99257.696–129260.235`, **30,002.539 ms**. Trace-clock-derived UTC: `2026-10-02T20:00:54.960Z–20:01:24.962Z`.
- Call log reaches `taking page screenshot`, `disabled all CSS animations`, `waiting for fonts to load...`, **`fonts loaded`**. The recorded font wait completed; the subsequent blocked internal stage is not recorded.
- All **29 top-level preceding assertions passed**. Final three: line 182 `html[data-theme] === "dark"` (`expect@88`); line 183 `.system-moon` visible (`expect@89`); line 184 `.system-sun` hidden (`expect@90`, ended `20:00:54.959Z`).
- Earlier passed assertions: Work route/content/selected tab/focus (141–165), segmented indicator alignment `<1px` and no animations (145–150), expanded theme height `112` (171), Dark checked (173–174), theme-track animations `0` (175), System light theme/sun-visible/moon-hidden (178–180).
- Poll samples at 171 initially measured `40.59375`, `74.015625` before `112`; at 175 initially `1`, `1` before `0`. Parent polls passed; these retained intermediate negatives are not terminal assertion failures.
- No `frozen-theme-dark.png` or attachment was produced. Lines 188–224 were not reached: hidden-menu/focus-mode checks, second capture, approvals/reload/persistence and remaining navigation lack coverage from this attempt.
- Finally `app.close()` completed (`pw:api@92`, 7,334.197 ms); total test 50,556 ms. No terminal navigation/assertion error appears. Completion of teardown does not prove renderer responsiveness during capture.

## Theme/view-transition source and limits
- `packages/app/src/shell/shell.tsx:36–46`: explicit theme selection updates preference/hash, sets `html.dataset.vt="theme"`, starts a view transition; `.finished.finally(...)` clears the marker. Reduced motion skips it.
- Same file 53–56: subsequent System color-scheme changes call `setThemeState` directly; those media events do **not** start another view transition.
- `ThemeSwitch` 173–185 also creates 380 ms ring / 267 ms track animations. `packages/app/src/kit/styles.css:55–57` assigns theme transition pseudo-elements 140 ms; normal content transitions use 280 ms.
- `packages/app/src/App.tsx:19–29`: route changes can start view transitions; history replacements do not. The recorded route assertions had passed before theme checks.
- Test line 175 waits only for `.theme-track`, before the later System click. Lines 178–184 verify DOM theme/icon state, not `ViewTransition.finished`, all-page animation state or compositor readiness.
- Therefore an unsettled transition at capture is a **possible investigation lead only**. Source shows a synchronization gap, but neither active/stuck transition nor causation is demonstrated; no justified animation/wait/timeout patch follows.
- Trace ZIP contains only `test.trace`, two source files and the error-context attachment: **no browser-context trace, DOM snapshots, screenshot frames, network or CDP events**. Error context contains error/source only, no page snapshot. Failed-head fixture launches Electron manually without explicit context tracing.
- The artifact's sole crash file is a simulated **Setup Assistant** incident from `2026-03-16`; it supplies no diagnosis for this capture. Missing Cortex crash evidence is not proof of no crash/hang.

## Disposition
- **Preserve the negative:** `37057583278` remains failed, macOS 49/50, capture absent, later test steps unexecuted, packaging/smoke skipped. Prior/future green runs cannot retroactively satisfy it.
- **No source/test fix recommended:** evidence cannot distinguish post-font screenshot preparation, renderer/compositor capture, transition interaction or another blocked stage. No basis for an infrastructure/flakiness diagnosis.
- Remaining evidence needed: browser-context/protocol capture identifying the blocked screenshot stage and transition state at that point. This report authorizes no rerun, timeout increase, assertion weakening or transition disabling.
- Original inspection was read-only. Retention adds only this directory; no tests/builds, source/configuration changes, CI reruns, Mac access, PR/board actions or delegation performed.

## One-worker macOS change — read-only review, 2026-10-02T20:46:23Z
- Reviewed `playwright.config.ts` SHA-256 `51028726777b52efac366236a7828a53df99c5cdad6e678432d97b0959df1497`. `workers: Number(process.env.E2E_WORKERS ?? (process.platform === "darwin" ? 1 : 4))` limits default macOS scheduling to one worker; `fullyParallel: true` does not exceed that limit. Explicit `E2E_WORKERS` still overrides it.
- Scoped verdict: reasonable **intended native GUI ownership mitigation**, not a demonstrated cause/fix for this failure. It reduces overlap among this suite's tests; it cannot guarantee exclusive host GUI ownership. Timeouts, assertions and screenshot requirements are unchanged by this config diff.
- Wording correction for coordinator: config line 7, “parallel windows can suspend frame-based waits”, implies an established mechanism. Prefer: `// Default to one macOS GUI test at a time to limit foreground-app contention.`
- `docs/testing.md:135–138` should describe intent rather than “can stall frame-based click/capture waits”; explicitly call the probe **Linux-only**. The retained observation records 2/3/72 frames per 1.2s across hidden/throttling-override/shown phases, not a macOS stall reproduction.
- Probe source retains earlier recursive `requestAnimationFrame` loops across phases, so counts are not an isolated rate benchmark. It supports the narrow observation of hidden/shown frame availability only; it does not establish screenshot-stage blocking or causation in either CI run.
- `evidence/mcp-followup/README.md:51–55`: qualify “preventing separate Electron apps from competing” as “intended to reduce contention among this suite's Electron apps”; preserve its explicit unknown-cause/fresh-proof caveat. `AGENTS.md:108` accurately states the defaults.
- Verification: three retained artifact members match ZIP bytes and recorded SHA-256 values; outer digest matches the published value. Run `sha256sum -c SHA256SUMS` from this directory to verify retained files. The original negative remains unchanged.
