# Bounded remote-auth E2E handoff

Owned source: `tests/e2e/remote-auth.spec.ts`. Five cases registered; no runtime execution or build attempted. Other workers own app/core/main code.

## Canonical fixture contract

Fixture is a standalone Node HTTP server bound to a fresh loopback port. Tests select that origin through the actual `PUT /api/connection` route (`mode: selfhost`) before opening the live Login screen. Backend instance describes self-hosted Cortex-style auth; it is not a real Cortex Cloud account or deployed-backend proof.

Routes/response shapes read from the admitted SDK 0.3.1 / API-types 0.2.0 handoff and pinned canonical backend material:

- `POST /v1/auth/magic-auth`: `{email}`; 204 acceptance or RFC-problem refusal.
- `POST /v1/auth/magic-auth/verify`: `{email,code}`; `{status:"session",access_token}` plus main-only HttpOnly `cortex_rt` refresh cookie, or typed continuation.
- `verify_email` continuation: sanitized pending status only. No verification-submit fixture/handler; its trimmed nonempty 1–128-character code contract is covered by main-service tests, not a six-digit UI assumption.
- MFA enrollment: canonical pending token, challenge/factor IDs, QR and TOTP fields supplied to the real SDK; only sanitized status may reach IPC/UI.
- `/readyz`, `/v1/instance`, `/v1/registry/models`: bounded probe support if the UI checks the selected origin.
- Every unexpected fixture route becomes a failing fixture error; no broad fallback successful response.

The actual renderer, IPC engine route, main-process session owner and installed SDK parse every response. There is no IPC/route interception or synthetic engine state. Code-response barriers are real held HTTP responses, released in cleanup. No provider/catalogue network outside loopback (`CORTEX_CATALOG_URL=data:application/json,{}`).

## Cases

### 1. Email-code action safety — 960 light and dark

- Caller-provided `signedIn:true` in connection selection cannot establish sign-in.
- Real email-send refusal keeps address; neutral `auth.sendFailed`, no raw fixture detail.
- Resend makes one additional actual request.
- Six digits alone do not send; explicit Continue required.
- Wrong code keeps the six-digit draft editable and displays `auth.failed`.
- Two synchronous Continue clicks while HTTP verify is held produce exactly one new POST; field locked and `connection.signedIn` still false.
- Accepted session yields the signed-in heading, explicit process-lifetime/local-inference copy and sanitized state.
- Renderer reload keeps login in the same process.
- Open connection settings preserves self-host selection and exact loopback origin.
- Account Sign out clears auth; next email request carries no previous bearer/cookie.
- Use another address clears the pending candidate.
- Captures: refusal and signed-in at 960 in both themes.

### 2. Continuation secrecy and restart — 960 light and dark

- MFA enrollment cannot claim signed-in; unavailable continuation copy instead of an invented MFA screen.
- Use another address resets it.
- Email verification returns `verify_email`, remains signed out, shows the same unavailable continuation copy as MFA, exposes no six-digit input or pending token. Use another address resets it.
- A fresh normal magic-code request is held; the visible Cancel button remains enabled during verification. Cancel returns home and clears the candidate. Releasing the old HTTP handler cannot promote it; the test waits for that handler to finish and reasserts signed out. A subsequent normal email-code login succeeds with no old cookie/bearer.
- DOM, browser storage/cookies, IPC DTO and renderer network checks reject returned tokens/cookies/pending/challenge/QR/TOTP/raw-detail markers.
- Same engine directory **and same Electron profile** reopened after app close. A harmless renderer preference marker proves it is the same profile; connection origin persists, authentication does not.
- After shutdown, root engine files are scanned for fixture auth material; no persisted raw token/cookie expected.
- Fresh post-restart email request carries no old auth material; Cancel clears the candidate.
- Captures: unavailable MFA and unavailable email verification at 960 in both themes; normal email-code signed-in at 1440 light.

### 3. Mode/origin lifetime isolation — one case

- Sign in on origin A, switch to B: B receives neither A's cookie nor bearer.
- Hold B's verification response, change mode to local: pending IPC request must fail (not merely disappear); sanitized state/Connection remain signed out.
- Start fresh on A, hold verification, switch origin to B: pending request must fail; no late promotion.
- Next B request has no stale credentials; returning to A also starts clean.
- Race actions use direct actual IPC requests so tests await and assert the rejected old request deterministically. UI paths cover normal sign-in in the other four cases.

## Secrecy assertions and limits

`GET /api/connection/auth` must have exactly `status`, `signedIn`, optional `email`; response headers cannot contain `set-cookie`. Known fixture-private markers are checked against DOM, local/session storage, renderer cookies and response JSON. Renderer IndexedDB/cache inventories are empty in these isolated profiles; browser HTTP request list stays empty, proving remote auth transport is not browser-originated.

Fixture private markers are obvious nonproduction test values. Tests neither acquire nor log real credentials. Numeric email code is intentionally present in the user input; the prohibition concerns returned auth/continuation material, not the user's own typed code.

These checks establish the tested boundary, not a heap-forensics claim about every possible renderer object.

## Contract adjustment discovered during handoff

Current `RemoteSession.#logout` explicitly implements **device-local sign-out for Cortex-style sessions**, awaiting admitted server-revocation/refresh contracts. Tests therefore assert no `POST /v1/auth/logout`, immediate sanitized sign-out and no auth headers/cookie on the next email request. The original idea of verifying stored bearer/cookie on a remote logout was removed; requiring that request would invent unsupported product behavior.

Local-password login and direct MFA verification are typed host capabilities but are not the approved email-code UI path. No extra unapproved UI or test flow introduced.

Coordinator correction applied: frozen six-digit OTP applies only to magic-code sign-in. `verify_email` has a distinct trimmed nonempty code contract (1–128 characters); absent approved continuation UI, both verification and MFA display `auth.continuationUnavailable`. The former verification-submit E2E and `VERIFY_PATH` handler were removed. Five-case count retained; the themed continuation cases now exercise UI Cancel during a held ordinary magic-code verification before their restart checks.

## Checks run / runtime gate

- Targeted ESLint: passed.
- `git diff --check -- tests/e2e/remote-auth.spec.ts`: passed.
- Playwright `--list --reporter=line`: five cases registered; no Electron launch.
- Full TypeScript check: **passed after the main-session owner corrected the local-session narrowing**. Earlier in-progress TS2339 at `remote-session.ts:99` was outside this test's scope and is resolved in the latest check.
- Runtime/build: **not run**, pending coordinator's new-build authorization.

Once the coordinator authorizes the new build, run only the five cases with distinct output and no retries, then inspect the requested captures. No runtime success is claimed before that run.

## Authorized initial-read follow-up — 2026-10-03 03:10 UTC

This supplement supersedes the earlier runtime gate. Coordinator supplied a passing five-case integrated run (`/tmp/opencode/remote-auth-e2e-first.log`, 5 passed in 10.9s), then authorized only one additional initial-read case against the existing stable dist. The file now registers **six cases**. This executor ran only the new case; no rebuild, application-source edits, Mac/CI run or commit.

### Sixth case: real initial-read barriers

`Initial connection and auth reads protect selection, canonical sign-in and cancellation`, `tests/e2e/remote-auth.spec.ts:319`:

1. Actual engine `PUT /api/connection` canonicalizes `https://API.CORTEX.FOUNDATION:443/` to `https://api.cortex.foundation`. Reload Settings with its initial real `GET /api/connection` response held: all mode controls are disabled. Direct click/Enter attempts cannot select Self-hosted, expose an editable URL or issue a mutation.
2. Release the unmodified response: the saved Self-hosted URL appears. Enter the equivalent uppercase/default-port URL; Sign in remains enabled and opens Login. The recorded bridge requests contain no probe or additional PUT. This stage never submits email to Cortex Cloud.
3. Select the controlled loopback backend; create a real `code_sent` candidate through IPC/SDK/HTTP. Reload Login, holding its initial real auth GET after it returned that candidate. The email field is disabled, Cancel is enabled. Clicking Cancel reaches main exactly once, returns home and clears the candidate even though the component has not received its auth state.
4. Release the stale `code_sent` response; reopen Login. Email is editable, no OTP screen returns, main remains exactly `{status:"signed_out",signedIn:false}`. Fixture records one email request and zero code requests. Existing secrecy/error assertions pass.

**Barrier qualification:** the test wraps Electron's registered `cortex:fetch` handler, calls the original handler first, then delays exactly one matching completed GET response. Status, headers and body are returned unchanged. Later direct IPC requests use the same original handler without delay. This is test-only response scheduling, not a fake engine response or authentication success. The earlier five cases use real held HTTP responses without this IPC response barrier.

### Verification and retained artifacts

- Targeted ESLint, full TypeScript, six-case registration and owned-file diff check: passed.
- Authorized Electron runtime: **1 passed**, one result, retry 0, no skips/flaky/errors/stdout/stderr; 2.701s case, 3.333s run. Runtime start: `2026-10-03T03:09:56.588Z`.
- Report: `/tmp/opencode/remote-auth-read-races/result.json`, SHA-256 `660a24a8a651aba53440a0cc1484be8a70a6b1cf664b4d3ca450ca0a5fc04b4c`.
- Log: `/tmp/opencode/remote-auth-read-races/runtime.log`, SHA-256 `ad99f2017f04adb789494a629ab9ef02428676d1d80906c2c973bf537ed1f1ab`.
- Three 960×640 light captures retained under `/tmp/opencode/remote-auth-read-races/artifacts/`; all three inspected at original resolution. Settings controls and Sign in are readable. Narrow cloud subtitle ellipsizes; the focused long URL scrolls horizontally. The post-cancel Login capture is vertically scrolled, clipping the top brand mark while keeping email, Get a code and Cancel visible. This is bounded behavior/render evidence, not full visual acceptance.
- One earlier command matched zero tests because its fully anchored `--grep` excluded Playwright's file-prefixed title. No Electron case ran. Negative setup report/log remain as `/tmp/opencode/remote-auth-read-races/report.json` and `run.log`; corrected selector ran the single case once with zero retries.
- `/tmp/opencode/remote-auth-read-races/before.json` records HEAD `b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874` and 95 SHA-256 pins covering built app/desktop files, relevant sources and existing evidence. Post-run verification found **no pinned file changed**. These are current-run pins, not reconstructed pins for the earlier five-case build.
- Existing `test-results/e2e.json` remains unchanged, SHA-256 `c2bff07b8d510d25bda99d3bdaae5c097ac9e12d518f7e7b905b8f1a08f9f47d`; a copy is retained as `/tmp/opencode/remote-auth-read-races/preserved-existing-e2e.json`. Its stats retain the separate five-pass result.

Reproduction command (use a new evidence directory to preserve this run):

```sh
NODE_ENV=test PLAYWRIGHT_JSON_OUTPUT_FILE=<new-evidence-dir>/result.json xvfb-run -a -s '-screen 0 1920x1080x24' node node_modules/@playwright/test/cli.js test tests/e2e/remote-auth.spec.ts --grep 'Initial connection and auth reads protect selection, canonical sign-in and cancellation' --workers=1 --retries=0 --reporter=list,json --output=<new-evidence-dir>/artifacts
```
