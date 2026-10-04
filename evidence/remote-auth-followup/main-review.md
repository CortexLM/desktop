# RemoteSession bounded security review

**APPROVE — scoped process-lifetime auth service. No blocking defect found.** Read-only source review; terminal executor, no delegation. Only this report was written. Existing eight unit-test passes are the implementation owner's evidence, not a rerun here. No tests, build, E2E, CI, Mac or UI review performed.

## Reviewed inputs

- `packages/desktop/src/remote-session.ts` — SHA-256 `26528dd439542a55bf06a6bee46125fea13dc3a4cbd91e6debecb617aad69051`.
- `packages/desktop/test/remote-session.test.ts` — SHA-256 `1f8ec02025c71e1a0154e846d6bc9a800e1a6f3e73a701d466fd350d5610d04e`.
- `/tmp/opencode/desktop-remote-session-implementation.md`.
- Frozen `RemoteAuthInput` / `RemoteAuthState` in `packages/schema/src/index.ts:375–390`.
- Installed `@cortex/sdk` **0.3.1**, `@cortex/api-types` **0.2.0**: generated auth contracts/methods plus actual exported `dist/client.js` auth/cookie implementation. SDK runtime SHA-256 `422dadf8b41cf7d652c165d38b21bb4ce2515502a84d295600716ec48c30ae27`.

## Findings

| Boundary | Readback |
| --- | --- |
| Typed calls | Only admitted magic-auth send/verify, verify-email, MFA verify, local login/logout. SDK returns 204/void for send/logout; 200 discriminated interactive auth, session-only MFA, local bearer/expiry. Service validators and status checks match those calls. No unknown Cloud logout/refresh/identity API substituted. |
| Input / output | Service revalidates the frozen action union. Six-digit OTP/MFA; bounded password/email and trimmed verification code. Public methods construct fresh `{status,signedIn,email?}` objects; private tokens, cookies, pending identifiers, enrollment QR/TOTP are never returned. Strict response schemas reject extra auth fields before promotion. |
| Origin / credentials | `state()` validates before changing origin. Per-candidate SDK client/jar/lifetime; no shared browser cookie store. Request and nonempty response URLs are same-origin; `redirect: "error"`, `credentials: "omit"`. SDK jar is simplistic, but these clients only reach fixed auth paths on their pinned origin. Active credentials never supply a replacement candidate. |
| Active vs candidate | Only fully validated session replies promote at lines 121–128. Candidate failures/cancel leave prior active identity intact. Pending status can truthfully retain `signedIn: true`; active expiry is checked separately. The test exercises this with native HTTP and the real SDK. |
| Malformed success after SDK adoption | SDK `dist/client.js:91–129` may adopt a string token/cookies before consumer validation. Service catch at lines 139–145 aborts/discards that candidate after any received 2xx/3xx failure. SDK abort checks plus private candidate ownership prevent late response cookies from reaching an active/new identity. Malformed pending replies containing an access token are included in existing tests. |
| Local expiry | Strict local reply requires Bearer and valid ISO expiry. Expired replies never promote; `state()` aborts/removes active local identity at expiry without a request. No unverified Cloud JWT parsing. Cloud process-only lifetime is an explicit bounded contract. |
| Cancel / clear / concurrency | Busy identity is set before awaited SDK work. Concurrent submissions refuse. Cancel invalidates only candidate; clear aborts busy/candidate/active. Completion checks lifetime before mutation. Catch/finally compare object identity, so a superseded operation cannot cancel/unlock its replacement. Invalid inputs/origins refuse before altering valid state. |
| Deferred local logout | Active identity is removed synchronously, then retained solely as the busy revocation identity. New submissions/duplicate logout refuse while it runs. Origin switch/clear abort it; a late completion checks its aborted lifetime before calling `state(oldOrigin)`. Identity-checked finally cannot clear newer busy work. Revocation failure still leaves local state signed out. Cloud logout stays device-local and performs no untyped revocation call. |
| Native whole-body deadline | Lines 172–212 race complete fetch/body consumption against a composed 10-second abort. Reader cancellation runs on abort/finally; body is capped at 1 MiB and detached before SDK parsing. A transport ignoring abort cannot pass the post-fetch/whole-body guards. The existing unfinished native 200-body case specifically checks timeout and socket closure. |
| Errors / persistence | All transport/SDK/schema exceptions become fixed neutral `CortexError` messages; response text/problem details never propagate. No console/logging, persistence or event write in the service. Password exists only in the submitted request; SDK/client/cookies remain private process memory. |

## Error constructor identity

`../../core/src/error` is the existing implementation, not a second class. Read-only `realpath` resolves the relative path, root workspace `@cortex/core/src/error.ts`, and desktop workspace path to the same `packages/core/src/error.ts`. The core public entry re-exports `./error`; esbuild bundles workspace modules with default realpath resolution. Protocol error mapping also uses validated error codes rather than requiring `instanceof`. No current class-identity blocker; the narrow import avoids loading unrelated core services in this isolated service test. The original reason for choosing it was not established by this review.

## Evidence limits

- Reviewed test source uses the installed real SDK and native local HTTP, with controlled response fixtures and transport holds; no replacement auth implementation.
- Existing held-reply test covers delayed **verification** during cancel/logout/origin switch/clear, including replacement sign-in. Local-logout success/failure is covered separately. A held **local logout reply followed by origin replacement** is not directly asserted; its control flow above was reviewed statically. This is a bounded coverage note, not an observed defect or requested scope expansion.
- Approval covers these service bytes and the frozen IPC auth contract. It establishes no hosted-account availability, remote inference, refresh/persistent login or native acceptance.
