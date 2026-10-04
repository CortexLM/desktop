# Remote Chat admission disposition — final interface

**Implemented, uncommitted.** Only `packages/desktop/src/remote-chat.ts` and its existing `packages/desktop/test/remote-chat.test.ts` changed in this batch. `remote-session.ts` needed no change.

## Authorized interface addition
```ts
export type MainRemoteDelivery = {
  readonly admissionState: "pending" | "refused" | "uncertain" | "admitted";
  readonly completion: Promise<MainRemoteResult>;
  detach(): void;
  resume(observer: MainRemoteObserver, signal?: AbortSignal): Promise<MainRemoteResult>;
};
```
This readonly getter is live on the frozen main-only delivery handle. It exposes recovery disposition from the private ledger; no credential, key, path, body, exception class or additional callback escapes. All other public signatures remain unchanged.

Priority is exact:
| Private state | Getter | Core meaning |
| --- | --- | --- |
| Validated admission IDs exist | `admitted` | Admission happened; use completion/terminal and history for delivery recovery. This wins even after ledger closure, detach, failed delivery or successful completion. |
| No admission, ledger closed | `refused` | Preflight or definitive pre-admission refusal released this reservation. After epoch validation, a fresh corrected send is safe; preserve the user's draft/files. |
| No admission/closure, attempt running | `pending` | Admission outcome is still in flight; wait for settlement. |
| No admission/closure, attempt stopped | `uncertain` | Retain the original handle for replay; a fresh key could duplicate an admitted backend turn. |

**This is not delivery success.** A terminal error or truncated answer can remain `admitted`. Check binding epoch/abort first, then inspect disposition after the current attempt settles. An invalidated handle may retain a historical/uncertain disposition; epoch removal owns that recovery. The getter does not trigger authentication, network or lifecycle changes.

Failed catalogue/model/capability preflight closes the unadmitted turn and reports `refused`. HTTP403/422/429 admission refusals likewise report `refused`, without parsing error messages or probing another turn. HTTP403 retains the coordinator's `provider_error` mapping and does not invalidate the binding.

Uploads are separate named operations and create no turn reservation. An upload refusal remains its own failure; an invalid/foreign attachment ID causes synchronous `turn()` rejection before a handle exists. No upload was moved inside `turn`.

## Focused proof
Native **Node22.23.3**, actual installed SDK, native HTTP loopback. Existing17 transport +8auth cases: **25 passed, zero failed/skipped**. No new test framework or additional registered cases; existing cases were strengthened.
- Frozen readonly property; `pending` before validated headers, `admitted` while streaming and after completion/closure.
- Disconnected/detached admitted handles remain `admitted`.
- Failed Cloud discovery/preflight, missing model/effort and definitive403/422/429 report `refused`; binding stays active.
- Held pre-header request detaches to `uncertain`; resumed5xx and missing metadata remain `uncertain`; each running replay reports `pending` until IDs exist.
- Valid IDs with later mismatched events, expired-stream error or history recovery retain `admitted`.
- Coordinator's corrected403 expectations and gapped history `version_index:3, version_count:1` assertion pass unchanged.

Strict workspace TypeScript and focused ESLint pass. Receipts: `/tmp/opencode/remote-chat-disposition/{focused,typecheck,lint}.json`; runtime detail: `tests.json`; final hashes/diff: `receipt.json`, `disposition.diff`.

Original auth test and `remote-session.ts` hashes retained. All90 frozen app/desktop dist files unchanged. No core, schema, renderer, `main.ts`, dependencies, build/E2E/Mac/CI/commit/push actions. Existing reports, security probes and coordinator `/tmp/remote-chat-integrated` evidence remain untouched. Concurrent core integration is outside this batch's proof.
