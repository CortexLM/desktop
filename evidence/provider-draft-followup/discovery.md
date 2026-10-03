# Next live behavior — one source-backed candidate

## Candidate: provider-enable preference discards an unsaved replacement key
- Scope: existing live Settings → Providers & models; local configuration write. No new surface, remote inference, memory-policy semantics or design import required.
- Static finding: `packages/app/src/screens/system/settings.tsx:219–225` owns the key draft and unconditionally calls `setKey("")` after **every** successful `run()` operation.
- Enabled control: `settings.tsx:236–237` calls that same helper for `api.providers.update(p.id, { enabled: x })`; the draft field remains present (`:229–235`). Thus changing provider availability clears an independently unsaved credential draft.
- API contract: `packages/protocol/src/index.ts:70–72` separates provider PATCH from key PUT/DELETE. `packages/core/src/provider.ts:72–77` updates only enabled/baseURL; credential writes occur separately at `:60–64`.
- Impact: replacement key B disappears without ever reaching the key-write endpoint. Persisted key A survives; this is unsaved-input loss, not demonstrated credential-store corruption.

## Smallest reproduction / regression fit
1. Using the existing local fixture catalog, save dummy key A for a supported provider; reopen its detail.
2. Type distinct dummy replacement key B into `provider-key-input`; do not press Save.
3. Toggle the provider's Enable switch; await the successful local PATCH and settings refresh.
4. Expected: enabled state changes, saved hint still identifies A, input still contains B. Source predicts: input becomes empty; B was never submitted.
- Add one Electron interaction case beside `tests/e2e/ui-flows.spec.ts:10–19`; reuse `saveKey()` and fixture launch. Assert B survives the toggle, then explicitly save B and assert its hint plus accepted draft clearing.
- Existing provider coverage at `ui-flows.spec.ts:19–100` checks key save/reload/removal/layout, not a populated draft during an enable-preference write.
- Smallest repair: prevent the enabled-preference success path from clearing `key`; preserve accepted key-save clearing. No new API or dependency.

## Evidence limits / exclusions
- Source-backed candidate, not runtime proof; no tests, app launch, build, CI, network or native checks performed.
- Read `AGENTS.md`, all `.rules/`, completion audit and bounded current source. Historical audit memory refusal/draft findings are superseded by current guarded writes (`bots/team.tsx:148–195`); not re-reported.
- General `cortex.pref.*` switches (`settings.tsx:21–42`) persist flags only. Memory enablement (`system/projects.tsx:255`) remains local component state; policy expansion is outside this proposed repair.
- Only this report written. Repository unchanged by this review.
