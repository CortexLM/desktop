# Main-only RemoteSession implementation

**PASS — scoped implementation and Node 22 checks.** Terminal executor; no delegation. Only repository writes: new `packages/desktop/src/remote-session.ts`, new `packages/desktop/test/remote-session.test.ts`. Coordinator owns integration/docs/UI. No build, full suite, E2E, packaged/native launch or CI performed.

## Delivered interface

```ts
new RemoteSession(options?: { fetch?: typeof fetch })
state(origin: string): RemoteAuthState
authenticate(origin: string, input: RemoteAuthInput): Promise<RemoteAuthState>
clear(): void
```

`RemoteAuthInput` and `RemoteAuthState` use the coordinator's actual `@cortex/schema` contracts; no temporary duplicate types remain. Import `RemoteSession` directly from `./remote-session`. The fetch injection follows the existing probe test pattern; no client/token getter exists.

State is exactly `{ status, signedIn, email? }`. During pending replacement, `status`/`email` describe the candidate and `signedIn` describes the still-active verified session. Failed credentials preserve that active session. Wrong-code responses preserve `code_sent` for retry. Cancel discards only the candidate; logout removes active identity. `state()` returns fresh plain objects, makes no network request, clears old lifetimes on validated origin changes and expires local bearers against validated ISO `expires_at`.

## Boundaries

- Exact installed immutable SDK/API-types 0.3.1/0.2.0. Typed calls only: magic-auth send/verify, verify-email, MFA verify, local login/logout. Each response is zod-validated; exact successful HTTP statuses also checked. Unknown extra auth fields fail closed.
- Every candidate owns its own client, cookie jar and `AbortController`; promotion aborts the prior active lifetime. SDK `auth.signal` plus pinned-origin transport prevent late identity/cookie commits. Private bearer source supplies local logout; credentials never enter DTOs or logs.
- Origin repeats shared `ConnectionUrl` validation in main. Fetch uses `redirect: "error"`, `credentials: "omit"`, signal composition and a 10-second whole-body deadline. Redirects carrying cookies or bearer never contact the target.
- Auth bodies capped at 1 MiB, fully received before SDK parsing. Explicit reader cancellation closes native hanging responses. Malformed successful candidate responses discard that client because the SDK may otherwise already have adopted its token/cookies.
- Input failures, conflicting requests, HTTP refusal/rate-limit and transport/parser failures become neutral existing `CortexError` codes. HTTP status wins over an inconsistent problem-document status. Raw error text/cookies/challenge IDs never escape.
- Email-verification and MFA challenge material remains private. Enrollment exposes only its enum/email; QR/TOTP material is validated then discarded. Enrollment completion refuses until an approved presentation exists.
- **Cloud logout is local-device/process-only.** It discards the private client/jar and aborts its lifetime; it does not call the untyped Cloud logout endpoint or claim server-side revocation. A remote refresh-cookie session may remain valid until its server lifetime ends. Local logout calls the typed revocation endpoint and validates 204/void; local state remains cleared even if revocation fails.
- No auth persistence, refresh or decoded-JWT identity/expiry claims. Local expiry is enforced now. Cloud bearer expiry is not inferred from unverified claims; future authenticated operations must handle server 401. No turn/history/model/Library/password-signup/refresh route implementation.

## Checks actually executed

Runtime: `/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node` **v22.23.3**. Vitest **5.0.3**. Final full scoped run: **8/8 pass**, 2026-10-03 03:00:52 UTC start, 10.65 s duration.

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/vitest/vitest.mjs run packages/desktop/test/remote-session.test.ts
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2023 --lib ES2023,DOM,DOM.Iterable --module ESNext --moduleResolution Bundler --esModuleInterop --verbatimModuleSyntax --types node packages/desktop/src/remote-session.ts packages/desktop/test/remote-session.test.ts
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/eslint/bin/eslint.js packages/desktop/src/remote-session.ts packages/desktop/test/remote-session.test.ts
```

Scoped TypeScript and ESLint both exit 0. No upstream/global suite run.

Eight real-HTTP cases cover verified email-code success, SDK cookies/native auth-body adoption, prior-account retention/wrong-code retry, exact verify-email/MFA request bodies, enrollment secrecy, local expiry/revocation/refused logout, held native replies through cancel/logout/origin switch/clear and a new identity, duplicate rejection, actual 10-second incomplete-body timeout/socket closure, invalid origins/input, cookie/bearer redirect refusal, malformed/oversized auth responses, inconsistent error status and raw-error sanitization.

## Observed correction during implementation

Initial tests exposed test-fixture keep-alive races from closing every server connection between cases; teardown now closes connections after the suite. More importantly, Node 22 could abort a 10-second Fetch signal while leaving SDK/native body parsing unsettled. A standalone local-HTTP SDK reproduction confirmed this (short 200 ms abort settled; 10-second case did not settle within 15 seconds). Final guarded transport races the complete body against the deadline and explicitly cancels its reader. The regression asserts both rejection and server-side connection closure; final run passes. This is a bounded consumer transport fix, not an SDK vendor patch or broad upstream diagnosis.

Integration/native acceptance remains coordinator-owned. The service changes establish process-local authentication only, not remote inference or history availability.
