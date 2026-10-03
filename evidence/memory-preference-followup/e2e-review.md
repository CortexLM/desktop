# Memory E2E source review

- Reviewed `tests/e2e/runtime-settings.spec.ts`: 218 lines, five registered cases.
- SHA-256: `47b4b17adc8222565e8513db3880cf49fdbdec1be35f743816662a77e7d03580`.
- Cross-read implementation contract, runtime-settings hook, App/Shell gate, Memory/Privacy/Bot controls, IPC, fixtures and fake provider.
- Source review only; no build, execution, network, CI or device use. No repository edits.

## Verdict

No confirmed blocking source defect in the five cases. Meaningful real-engine assertions; retain the proof boundaries below.

## Confirmed coverage

- Light/dark cases use real IPC, provider payloads, persistent engine/renderer directories and an actual Electron restart.
- Initial Amber/Violet sends use their UI composers; saved notes are independently identified, compared with complete IDs/timestamps, added while paused and retained after restart.
- Four provider requests per theme establish enabled injection, paused omission, resumed per-Bot injection and ordinary-Chat isolation; prior transcripts remain exactly equal.
- PUT delay precedes engine admission; refusal goes through real strict validation. Duplicate same-stack clicks require one PUT, disabled control and unchanged accepted value before refusal/Retry.
- GET delay follows real response creation. `hold` is consumed once; stale-read scenarios issue PUTs before waiting, so an inspection GET does not accidentally consume their hold.
- Later event refreshes complete before stale release; navigation changes the hook owner. Release waits for main-handler return, health IPC and two frames before final assertions.
- Preview coverage preserves the legacy key and checks no extra settings PUT. Existing engine settings win subsequent initialize-only import.
- Failed legacy import gates both Bot and Work screen controls; accepted Retry removes the key, permits a UI send and omits the saved note from its real system payload.
- Gate cleanup releases outstanding waits before handler restoration. Attached gate traffic contains settings bodies/responses, not provider credentials.
- Geometry selectors are globally scoped, but current Memory/Privacy captures have no matching Sidebar/offscreen cells; no concrete selector collision found.

## Proof boundaries

- Lines 127–132 send restored Violet and ordinary Chat through `call(.../prompt)` (real IPC), not UI composers. Thus two UI-composed sends plus two direct-IPC sends per theme; do not describe all four as UI sends.
- Lines 109–110 prove paused Forget pointer actionability/focus and Export enablement; they do not execute deletion or inspect a downloaded export. Existing safety/unit tests remain separate evidence.
- Frozen `f82a648` `/api/settings` 404 failures demonstrate absent API, not the earlier cosmetic-toggle/payload defect. Keep the separate scratch receipt for that claim.
- Source/test catalog imports do not change frozen dist. Fresh-build execution and screenshot inspection remain necessary before claiming current UI/visual acceptance.
- Existing acknowledged unit results were not rerun. Projects/native evidence remains revision-scoped.
