# Remote core lifetime/security review

**Changes required: two reproduced boundary failures.** Actual core + `RemoteSession` + SDK + native loopback HTTP; no fabricated client/epoch or privileged-plugin scenario.

## P1 — detach returns account data after synchronous logout

`packages/core/src/remote-sessions.ts:189-202` publishes the detached state at line 200, then returns `structuredClone(record.view)` without revalidating ownership. The bus is synchronous. A subscriber can sign out/clear the account during that notification; `clear()` removes the record and emits its removal, yet the outstanding `detach()` returns the old title, conversation ID and epoch afterward.

Reproduction: admit a turn titled `private original account title`; on its detached notification call the real `RemoteSession.clear()`. Observed `signedIn:false`, subsequent `get(id)` refused, but `detach(id)` returned that complete old view. A caller applying this returned snapshot after removal can restore stale account data to its own projection.

**Minimal fix:** add `this.guard(record.owner, record)` immediately before the final return, as `create()` and `history()` already do after notifications. Regression must expect `aborted`, no returned old view, for account loss during the detached callback.

## P2 — duplicate in-flight uploads create two remote files

`packages/core/src/remote-sessions.ts:149-162` checks `this.pending` but ignores `record.uploads` before starting another upload. Two calls with the same session, Blob and filename, while the first response is held, both reach authenticated `POST /v1/library`. Native fixture returned two distinct owned file IDs; both calls succeeded. The counter only prevents `prompt()`, so it does not prevent duplicate upload side effects or quota use.

**Minimal fix:** include `record.uploads` in the initial busy check (`this.pending || record.uploads`), retaining the existing synchronous increment/finally decrement. Regression should hold the first response, require the second call to reject `session_busy`, and observe one Library request. Sequential uploads remain supported.

## Reviewed boundaries without another identified blocker

- Core/main wiring uses one real `RemoteSession` for auth and Chat (`packages/desktop/src/main.ts:24-33`); connection selection supplies a normalized origin. Remote close runs before auth/storage shutdown (`packages/core/src/index.ts:111-116`).
- Core owner/record/attempt guards protect late catalogue/upload/history results and observer work. Admission reserves before host work; matching replay headers retain local user/assistant IDs. Definitive refusal releases; ambiguous admission keeps the original delivery. Every resume marks output partial.
- `clear()` removes public lookup state before abort/removal callbacks. Get/list/messages rebind and return clones. The detached return above is the missing post-callback guard.
- Only `{sessionID,epoch}` remote-tagged change/removal events enter the bus. No local storage/provider/tool/permission dependency in this service; plugin dispatcher still excludes remote source. No current production subscriber republishes these events locally.
- Projection/DTO semantics remain the separately assigned review. Public routes/renderer integration remain absent; this is internal-service review only.

## Evidence

Isolated Node **v22.23.3** run: **2 failed reproductions / 1 passing guard control**, exit 1. Control: synchronous logout at the initial `admitting` notification rejects `aborted`, posts **zero turns**, exposes no record. Existing 17-case receipt/source was reused, not rerun; it lacks both reproduced cases. Coordinator's actual-SDK integration test source was inspected.

Files under `/tmp/opencode/remote-core-security-review/`: `probes.test.ts`, `vitest.config.mjs`, `probes.log`, `probes.json`, `provenance.json`. Exact runnable check:

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/vitest/vitest.mjs run --config /tmp/opencode/remote-core-security-review/vitest.config.mjs
```

Source pins remained identical before/after the probe run and match the core delivery receipt:

| File | SHA-256 |
| --- | --- |
| `packages/core/src/remote-sessions.ts` | `8e3e53995063042b7174d639541b2b5b55675355bea51baa79a2c3ac378fe72a` |
| `packages/core/test/remote-sessions.test.ts` | `015283402921cc55e168b51e636abe444ad1fc9703cc4cd0883ce724fcfda120` |
| `packages/schema/src/index.ts` | `09fa14a9a35a9f1479c50ab841cacba9c6f2074e10e366e8bdf628b493e87161` |
| `packages/desktop/src/remote-chat.ts` | `733860681cb7d1681460d0b4820bd020f76c6d54aaa0ebd86afdbf7a22a1a725` |
| `packages/desktop/src/remote-session.ts` | `2394cd1f9cf8852808168b4bff48aadbc51d76202524dccdbe63b40723d063d6` |

Full wiring pins are in `provenance.json`. Only this report/isolated probes written. No repository edits, builds, full tests, Mac/CI operations or commits.
