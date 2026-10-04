# Code model review — corrected final scope

Scope: HEAD `0257395d1a15d12a08de307ca75b132096dc973c` + current uncommitted Code batch.
Reviewed `packages/app/src/screens/chat/model-composer.tsx`, `screens/code/code.tsx`, `screens/code/parts.tsx`, and `tests/e2e/code-models.spec.ts`; screen paths share `packages/app/src/`.
Rechecked provider mutations, server routes, event schema, query lifecycle and engine refusal.
Previous `/tmp/opencode/code-model-review.md` preserved unchanged. This report supersedes its P2 and provider-refresh claims.

## Final finding disposition
**Previous P2 withdrawn. No production patch justified for it in this batch.**
The proposed reproduction incorrectly assumed provider mutation events existed.
- `packages/core/src/provider.ts:57-77`: provider mutations persist configuration/credentials; no bus publication.
- `packages/server/src/index.ts:83-87`: provider routes directly call those methods; no event emission.
- `packages/schema/src/index.ts:436-448`: event union contains no `provider.*` event.
- `model-composer.tsx:23-27,64-65`: Code's subscription predicate is dormant; Code exposes no reload action; `allowKeyless` stays true.
- `state/live.ts:21-27`: rerender alone does not refetch with unchanged dependencies.
Therefore disabling a provider while Code remains mounted keeps the existing catalog selection. Submission sends that same model; `provider.ts:93-99` rejects unavailable/unsupported configurations. The callback returns false, retaining draft/files.
`code-models.spec.ts:119-135` correctly distinguishes this engine refusal from the post-reload `No model` state; it does not prove provider-event refresh.

With no saved Home selection, remount/reload may choose the first current catalog model. This starts a fresh composer; no explicit selection or persisted session model has been replaced.
Explicit menu choices persist a nonempty key (`model-composer.tsx:28-32`). Reopened sessions supply their own model (`code.tsx:261`), overriding unrelated global preference. Strict selection blocks fallback for both.
The empty-selection fallback concern is an unproven hypothetical if future Code refresh wiring is added, not an established reachable defect today. No pinning patch/test requested now.

## Retained source conclusions
- Creation and follow-up both forward actual ModelRef, reasoning and file parts (`code.tsx:17-19,84-85,229-231`).
- Folder cancellation exits before creation; engine admission refusal returns false (`code.tsx:70-90`).
- Pending lock covers asynchronous callbacks; file reads block sends; draft/files clear only on true acceptance (`model-composer.tsx:80-101`).
- Session-id key plus ready-state composer mount initializes from the correct session (`code.tsx:121-125,215,261-262`). Successful session refetches keep the composer mounted; provider refetch was incorrectly claimed previously.
- Preview branches remain on the fixture composer. Chat keeps default key-only filtering and non-strict selection; Code options remain opt-in.
No additional concrete blocker established in this scoped source review.

## Verification limits / handoff
No delegation, source edits, test edits, builds, tests or GUI verification performed.
Existing test-source gaps: same-document session switching without reload; reasoning-enabled follow-up. These are coverage suggestions, not confirmed bugs.
Attachment/toast issue: independently reproduced and being fixed by the coordinator, per handoff; neither reproduced nor cleared here.
Runtime success, attachment/toast correction, visual fidelity and integrated verification remain coordinator-owned.
