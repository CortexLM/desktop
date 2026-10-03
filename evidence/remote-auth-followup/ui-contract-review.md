# Auth UI / public contract source review

**Three P2 UI findings. No additional blocker found in the reviewed main-wiring/core/schema/protocol/client/server boundary.**

Scope: current auth changes in `account.tsx`, `settings.tsx`, desktop `main.ts`, schema/protocol/client/server, core connection/index and `packages/core/test/connection.test.ts`. Main `remote-session.ts`, its evolving tests and the new UI-test worker's files were not read. Findings are source-derived; no tests/build/runtime/Mac/CI or repository writes. Only this report written; no delegation.

## P2 — Initial Connection read can overwrite the user's new self-host draft

**Lines:** `packages/app/src/screens/system/settings.tsx:263-267,291,308-310`.

The form starts with `mode = local`, `busy = false`, and `pending.current = false` while `conn` is loading. The radios and self-host editing path remain enabled. Selecting self-host changes only local state; when the original GET eventually becomes ready, the synchronization effect overwrites both the selected mode and the entered URL with the earlier stored selection. The new mutation guard does not cover initial loading.

**Reliable reproduction:** hold the original real `GET /api/connection` response; select Self-hosted and enter a new origin; release the response. The typed origin disappears, or the entire self-host form closes if the saved selection was Local/Cloud. No accepted save authorized that replacement.

**Minimum fix:** gate live `choose`/`probe`, radios and URL editing until the initial connection snapshot is ready; preserve preview interaction. A guard only on the Sign in button does not protect the URL draft. This is a residual of the existing initial-sync pattern at the newly wired auth controls, not a core authentication issue.

## P2 — Valid normalized self-host origins cannot reach Sign in

**Lines:** `packages/app/src/screens/system/settings.tsx:263,278,313`; normalization in `packages/core/src/connection.ts:39-41`.

Core saves `new URL(c.url).origin`, but the UI compares that canonical string with only `url.trim().replace(/\/$/, "")`. Valid equivalent input such as `https://API.CORTEX.FOUNDATION:443/` saves as `https://api.cortex.foundation`; the Sign in button stays disabled. The post-save `conn.reload()` replaces ready data without changing `conn.state`, so the effect at line 263 does not normalize the local field afterward.

**Reliable reproduction:** wait for Connection settings to load, choose Self-hosted, enter a valid mixed-case/default-port origin, click Check. After accepted save/probe, Sign in remains disabled despite the entered URL selecting the saved origin. This also reproduces with an accessible local test host using uppercase `LOCALHOST`.

**Minimum fix:** compare the validated input's `new URL(...).origin` with the saved origin, or apply the accepted save's canonical URL directly to the guarded draft. Keep invalid/unsaved origins unable to launch sign-in.

## P2 — Cancel during initial auth-status loading skips host cancellation

**Lines:** `packages/app/src/screens/system/account.tsx:136,212`.

The explicit Cancel button calls `go("home")` whenever `auth` is still null; `submit` also refuses all actions without loaded auth. If the process already holds a pending challenge when Login remounts, cancelling before its status GET resolves performs no `action: cancel`. The pending candidate remains available on the next visit, even though the user explicitly cancelled it. The request-token cleanup only suppresses renderer updates; it does not cancel the host candidate.

**Reliable reproduction:** begin email sign-in to establish `code_sent`; leave and reopen Login with its initial auth GET held; click Cancel; release the GET; reopen Login. No cancel POST was issued, so the challenge remains instead of returning to the email step. The host's cancel implementation need not be inspected to establish this missing call.

**Minimum fix:** allow `action: cancel` without a loaded `auth` snapshot, then route the Cancel button through that handler. It already checks the selected connection and has a local-mode no-op, so it can cancel remote pending state without inventing a local auth request. Preserve the owner-token checks and leave only after accepted cancellation.

## Bounded passes

- **Live OTP:** `account.tsx:116,178-197` uses the existing email/six-digit code UI, gates initial inputs, synchronously rejects repeated email/code submission, disables editing during submission and retains email/code on thrown failures. Only accepted responses clear the code (`:149`). Resend uses the same guarded email action; the fixture countdown remains preview-only.
- **Stale renderer callbacks:** `account.tsx:122-155` tracks load/submit ownership and invalidates on unmount. Email setup checks ownership after both awaits before advancing. Explicit cancel may supersede an in-flight request. The initial-load cancel exception is the finding above; backend cancellation/in-flight isolation remains main-service review scope.
- **Unsupported continuation:** pending verification/MFA states enter `unavailable`; no six-digit `verify_email` form or manufactured success/lockout/countdown is rendered live. Provider/SSO buttons use generic unavailable copy. `system.auth.sessionOnly` explicitly says sign-in ends when Cortex closes and chats still use local provider settings. `verifyEmail` copy is not referenced by this UI.
- **Public trust boundary:** schema `RemoteAuthInput` validates bounded email/password/OTP/nonempty verification-code bodies; protocol parses before calling the host, and core parses again. `RemoteAuthState.parse` strips unknown token/cookie/challenge/QR/secret fields on reads and writes. The reviewed UI renders localized generic errors, not returned raw messages.
- **Verified ownership seam:** `core/src/connection.ts:35,39,44,48-57` ignores renderer/persisted `signedIn`, obtains it only from the host for the validated selected origin, and clears the host only after an accepted mode/origin change. Equivalent origins are preserved. The separate `status`/`signedIn` fields intentionally permit a pending replacement candidate while an older active login remains; no narrowing to `status === signed_in` was introduced in the Connection metadata.
- **Main lifecycle:** `desktop/src/main.ts:30` constructs the owner in main and injects it into core. `core/src/index.ts:108` clears on close; selection remains the only connection document written by the new core methods. These seams do not establish the unfinished host implementation's correctness.
- **Tests read:** the five connection cases cover input/output sanitization, false renderer sign-in claims, independent pending/active state, malformed/local selection refusal, equivalent-origin retention and clear-after-accepted-write/close. They meaningfully exercise client/server/core through a fake host; they do not prove main-service verification or UI behavior. Coordinator-reported test success was not rerun.

## Reviewed SHA-256

```text
fb20e963e8eb593f12547ab98a2431ecc224d2286f612ad6a0c34a1d59056aa3  packages/app/src/screens/system/account.tsx
bede3ff4b8f0efd22e5905eaa7b422b1db6b2e830e1d4a770c312e9606efd5ac  packages/app/src/screens/system/settings.tsx
449c9737cc04f49d1c8a5b91901cf0821028feb59fec93169f76dfadb200d38d  packages/desktop/src/main.ts
e184483c0e9ad99eb99585282fb4e7d526df3851212fa197fc5bc66110e9236b  packages/schema/src/index.ts
8c91ead8ab678b0bfab39799bb03e0b4d60612632bfd5aa65f74bf8b21669e69  packages/protocol/src/index.ts
0faa61a96ffb009edd1fd6d321d38d805625eb385c9d912c7a184bc1467367e7  packages/client/src/index.ts
7585be3574f67ba1280e7f4f0e1423413b9d697be4e7423ac8ca3941aa783037  packages/server/src/index.ts
47eb2ba5d2ef920c067f2af881d506e97152cae246964d76d50681810cbf68d6  packages/core/src/connection.ts
45d4fd4b3639b7f51ad9b1e9bf7cc40f8a51411fb0bd7290f536457efd16c15a  packages/core/src/index.ts
1ecfe909a81d147aab811c5ffa0a25b56be7c877ed4ca698d3ae4f4377a19399  packages/core/test/connection.test.ts
```

## Closure review — all three P2s addressed

**Bounded source approval. This disposition supersedes the three open findings above. No additional blocking finding in the closure changes.**

- **Initial Connection loading:** `settings.tsx:263,266,276,292,309-311` now locks live mode/URL controls until the initial query is ready. Both mutation handlers enforce readiness independently of the rendered disabled state. Preview remains interactive. The delayed initial response cannot overwrite a user-entered live draft because editing cannot begin before resolution.
- **Canonical origin:** `settings.tsx:314` validates the trimmed URL before constructing it, then compares `new URL(...).origin` with the saved origin. Short-circuit evaluation prevents invalid URL construction. Case/default-port/trailing-slash equivalents match core normalization at `core/src/connection.ts:41`; different unsaved origins remain disabled.
- **Cancel before auth status:** `account.tsx:136-148,212` permits cancel without loaded auth and routes the explicit Cancel button through that path. A fresh ownership token supersedes the held status read; `:125,128` cannot later install its stale result or clear the newer busy state. Remote selection calls host cancellation; Local uses the explicit signed-out no-op. Navigation occurs only after accepted cancellation (`:149-151`). Pending-code Cancel remains usable.

Core connection seam hash is unchanged. Main-service correctness remains outside this review. No runtime checks, builds, source edits or broader audit; the three held-response regression executions remain coordinator-owned.

Closure-reviewed SHA-256:

```text
7d6946caefc5f0333267c41fb472d321a8f62358023933c7e2fcd2c6674f0a36  packages/app/src/screens/system/account.tsx
38384373b1c7a722bb4bdaed7de9396e6d83b6bdd1bfee85e5628c4bad1e4dac  packages/app/src/screens/system/settings.tsx
47eb2ba5d2ef920c067f2af881d506e97152cae246964d76d50681810cbf68d6  packages/core/src/connection.ts
```
