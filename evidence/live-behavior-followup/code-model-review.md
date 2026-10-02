# Code model review

Scope: HEAD `0257395d1a15d12a08de307ca75b132096dc973c` + current uncommitted batch.
Reviewed `screens/chat/model-composer.tsx`, `screens/code/code.tsx`, `screens/code/parts.tsx`, `tests/e2e/code-models.spec.ts`.
Source paths above are under `packages/app/src/`; traced `state/live.ts`, navigation/shell, Chat callers, engine admission and existing composer tests.
Read `AGENTS.md` and all nine `.rules` files. Source read-only; no builds/tests/GUI/Mac executed. Scheduler excluded.

## Finding — P2: implicit Home model is not pinned
`packages/app/src/screens/chat/model-composer.tsx:28-31` keeps `sel === ""` on a fresh install.
Even with `strictSelection`, `current` then continuously falls back to `models[0]`.
Reproduction: configure two providers; open Code with no `cortex.model`; retain a draft after folder cancellation; disable the displayed default provider through the bridge while Home remains mounted.
The provider event reload removes that model; the other provider becomes current automatically. Next submission uses the replacement without an explicit choice.
Explicit menu selections and reopened session selections are correctly protected; this hole affects the implicit default only.
Minimal patch: in strict mode, pin the first resolved default key into local selection state once; preserve that key across availability refreshes. Keep Chat's non-strict fallback unchanged.
Minimal test: fresh storage, two configured providers, displayed default, text + file draft; remove its availability; assert `No model`, retained draft/file, zero new prompt/provider requests until explicitly selecting a replacement.
No P0/P1 defect established by this review.

## Source evidence
- `code.tsx:17-19,78-90,229-231`: both prompt paths include the selected ModelRef, reasoning and file parts; creation uses the same ModelRef. Refusals return false.
- `code.tsx:70-85`: cancelled folder selection returns before session creation; selection/options captured for the submit survive the asynchronous dialog.
- `model-composer.tsx:80-101`: pending lock covers asynchronous no-model handling; file reads block submission; text/files clear only after a true admission result.
- `code.tsx:121-125,215,261-262`: session-id key remounts session state; composer mounts only after session data resolves, so initial model wins over global preference.
- `state/live.ts:18-27`: successful session/provider refetches retain ready state; routine refreshes do not remount the composer or erase draft state.
- `shell/shell.tsx:84,118` / `shell/nav.tsx:26-31`: committed route params supply the session key; new Home entries intentionally reset the composer.
- `code.tsx:26-59,129-181`: preview branches retain the fixture composer and preview navigation; no preview model-engine wiring added.
- `model-composer.tsx:22-32,59-65` / `chat/live-chat.tsx:59,87,255,336`: Chat retains key-only filtering, non-strict fallback and default test id; Code options are opt-in.
- `parts.tsx`: removed picker has no remaining Code references; latest unrelated session no longer selects the Code model.

## Coverage recommendations
- New E2E covers cross-provider creation/follow-up, creation reasoning=false, non-reasoning omission, folder cancellation, reload restoration, unavailable/unsupported refusal and explicit selections.
- `code-models.spec.ts` never attaches a file. Extend cancellation and actual engine-refusal cases with file retention plus accepted retry payload assertions.
- Session-switch loop (`:154-157`) reloads after every navigation. Add same-document A/B session switching without reload, distinct saved models and unrelated global preference; assert no draft/file/model leaks into B.
- Follow-up currently exercises a non-reasoning model only (`:101-113`). Add a reasoner follow-up with toggled reasoning to guard that separate callback path.

Limits: static evidence only. Runtime behavior, responsiveness, frozen-preview fidelity and integrated verification remain coordinator-owned.
