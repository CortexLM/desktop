# Provider draft integration — independent source approval

**Approved: actual production diff exactly matches the three-line proposal; no blocker found.** Base application `2956564fbe31f882014d74ff3a7f920e839fd634`; documentary HEAD `10a57be97ee9e9f9ea0c761784279ec8744b70d3`.
- Exact reconstruction from baseline verifies only `settings.tsx:221,224,237`: `clearKey = true`, functional conditional clearing, Enable PATCH passes `false`. `git diff <base> -- packages` names only this file; no untracked package files, CSS/catalog/engine/protocol changes.
- Captured `key` remains the invocation render's **raw** draft; PUT still sends `key.trim()`. Success clears only equal current contents; different pending edits survive. Rejections bypass clearing. Equality guards contents, not edit-history identity.
- Accepted Remove retains its previous clearing behavior for an unchanged captured draft; newer edits survive. `ProviderDetail key={current.id}` still isolates provider ownership. Existing native credential writes and sanitized metadata responses are unchanged.
- `AGENTS.md` now correctly says **“unchanged captured draft”**, not submitted replacement: DELETE submits no replacement key. `docs/providers.md` and `docs/testing.md` agree. No additional wording change needed.
- Existing Switch concurrency/lack of a `run()` busy guard remains a scope qualification; no request-serialization claim or extra refactor.

| Verified file | SHA-256 |
| --- | --- |
| `packages/app/src/screens/system/settings.tsx` | `b859cf9785ada768307e77a2546c02b80576b1491187b6ffa944c1673432eed6` |
| `tests/e2e/provider-draft.spec.ts` | `bf57e5cdb18d53f31572ec04ec7727130574a1c33cbdf9cc3b6fcb4733365c3a` |
| `tests/e2e/provider-key-pending.spec.ts` | `bcafa61de982af883954f648123c06370021b0dab8c8aca5003a2ec06d3d7477` |

- Both tests equal their retained final-negative source snapshots byte-for-byte. Original **four cases/eight assertion failures** become four ordinary passes, unchanged assertions.
- Existing `targeted.json`: **4/4**, **18.487127s**, start `2026-10-03T10:54:30.448Z`, one worker, one attempt each, zero retries/skips/flaky/unexpected/errors. Report SHA-256 `9bebf47b3b59a34cdd1c34f134168c68ed8a93fc871134cf094a316889539c0c`.
- Toggle attachments: B survives disable/enable, A hint1111 persists, neither recovery refill runs; explicit Save persists2222 and clears. Exact observed non-GET sequence: PUT/PATCH/PATCH/PUT. HTTP observation starts **after launch/probe installation**; zero observed calls is not an all-process-lifetime claim.
- Pending test invokes the original main IPC handler before holding completed PUT/DELETE replies. Independent GETs prove the credential write/removal already occurred. Release returns the original response; assertions compare held/delivered **status, headers and body string** by value, not a manufactured success or reference-identity check. New C/D drafts remain while stored states independently show2222/absent.
- Retained positives also prove ordinary Save clearing, **4097-character PUT rejected400/`invalid_request`** with input/hint4444 intact, then ordinary DELETE200 clearing unchanged input. Refusal proof is real protocol validation, not a credential-store I/O-failure simulation. Response/list shapes stay sanitized; pending-case page/console and renderer-HTTP errors are empty.
- Source pins stable from `10:56:10Z` through `10:58:47Z`. Approval covers actual source plus the retained targeted report; no full111-suite, new CI/native or visual acceptance inferred.

Sole write: this report. No app/test/build execution, repository edits, Mac/CI/network operations, commit or delegation.
