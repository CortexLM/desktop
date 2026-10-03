# Main model-discovery race — confirmed P2

**Two concrete failing regressions.** An older `binding.models()` response overwrites the private main catalogue after a newer response has already completed. A following image turn uses stale vision permission and reaches the actual SDK POST.

## Source and trigger
- `packages/desktop/src/remote-chat.ts:244–245,278–281`: each read clears `catalog`, then unconditionally assigns its result after awaiting HTTP.
- `remote-chat.ts:290–295`: fresh turns use that private catalogue to gate image capability, fetching only when it is absent.
- Core's `packages/core/src/remote-sessions.ts:118–126` correctly checks `catalogRead` **after** `owner.binding.models()` resolves. By that point main has already changed its independent cache; rejecting core's stale result cannot undo the main mutation.

Main SHA-256: `733860681cb7d1681460d0b4820bd020f76c6d54aaa0ebd86afdbf7a22a1a725`.
Session SHA-256: `2394cd1f9cf8852808168b4bff48aadbc51d76202524dccdbe63b40723d063d6`.
Core inspected SHA-256: `5d14e25bd6732b80c2139ac66c1e8de77b9d4240f11bc3deaf3b8d3462a6e559`.
HEAD at execution: `7a0b55288b584e1fe7a25eb435e609db6918550c`. Before/after source hashes match.

## Actual reproduction
Native **Node22.23.3**, actual installed SDK0.3.5/API-types0.2.0, `new RemoteSession()` with **default native Fetch**, loopback HTTP. No SDK/Fetch mock, no owner/backend credential request.

1. Complete fixture email-code sign-in. Load vision-capable model; upload the complete1×1 PNG to obtain an epoch-owned file ID.
2. Start an older model refresh. HTTP server sends an incomplete JSON body advertising `vision:true`; keep its final byte pending.
3. Start and finish a newer refresh, then release the older body's final byte.
4. Call `binding.turn` with the already-owned image and selected model/effort. Capture real `/v1/conversations/turns` request and admission callback.

| Newer refresh | Expected fresh turn | Observed |
| --- | --- | --- |
| Valid `vision:false` page | `model_no_image_input`, no turn POST | Older `vision:true` returns; **one image POST**, `admitted` |
| HTTP503, `provider_error` | Catalogue stays unavailable; fresh discovery or refusal, no turn POST | Older success revives cache; **one image POST**, `admitted`; no fresh discovery |

Each case made three model-list requests: seed, delayed old, newer. The failed-latest case should make a fourth preflight request with this implementation's existing lazy-refetch policy; it made none. Both admitted bodies contained the owned `attachment_ids`, selected `model_slug` and `reasoning_effort:"high"`.

This proves main's stale capability gate and latest-failure cache revival. It does **not** claim the current core renderer can bypass its own latest catalogue guard; the core/public UI path is inactive and was not invoked. The independent main cache must still honor the read ordering it exposes.

## Minimal correction recommendation — not applied
Mirror core's monotonic read guard inside the binding:
```ts
let catalogRead = 0;
// At models() entry, before any await:
const read = ++catalogRead;
catalog = undefined;
// After response validation/owner guard, before assigning or returning:
if (read !== catalogRead) throw aborted();
catalog = new Map(list.map((m) => [m.slug, m]));
```
Increment at read **start**, including reads that fail. Older success then cannot revive the catalogue after a newer failure. Reject superseded reads rather than merely returning stale data. No interface/callback/type change needed. Existing epoch guard remains independent.

## Negative evidence and rerun
- `/tmp/opencode/remote-model-race-review/probes.test.ts`: two expected-behavior assertions, both currently fail.
- `tests.json`, `probes.log`: **0passed/2failed**, process exit1,1.417s.
- `observations.json`: exact completion order, capability results, request paths, validated admission IDs and image POST bodies; fixture-only data, no real credentials.
- `command.json`, `provenance.json`: command/runtime/package resolution and stable source hashes.

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/vitest/vitest.mjs run --config /tmp/opencode/remote-model-race-review/vitest.config.mjs --configLoader runner
```

Only this report and its assigned temporary directory were written. No repository changes, broad tests, build, Mac, CI or lifecycle/security review duplication. All90 existing dist files hash-identical across the run. Coordinator owns any correction.
