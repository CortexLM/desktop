# Desktop auth contracts

Implemented sanitized local IPC auth contract and SDK-independent core host seam.

## Files

- `packages/schema/src/index.ts`: exports `RemoteAuthState` and `RemoteAuthInput` schemas/types.
- `packages/protocol/src/index.ts`: `connection.auth.get` / `connection.auth.submit`, GET/POST `/api/connection/auth`.
- `packages/client/src/index.ts`: `client.connection.auth.get()` / `.submit(input)`.
- `packages/server/src/index.ts`: handlers call `core.connection.auth()` / `.authenticate(body)`.
- `packages/core/src/connection.ts`: exported `RemoteAuth`, injected host, runtime parsing, origin normalization, signed-in derivation, accepted-selection cleanup.
- `packages/core/src/index.ts`: `CoreOptions.remoteAuth`, fourth ConnectionService constructor argument, host cleanup at start of `core.close()`.
- `packages/core/test/connection.test.ts`: five focused contract tests using a fake host and in-process server/client.

## Integration details

```ts
type RemoteAuth = {
  state(origin: string): RemoteAuthState
  authenticate(origin: string, input: RemoteAuthInput): Promise<RemoteAuthState>
  clear(): void
}
```

- `RemoteAuthState` exactly exposes `status`, `signedIn`, optional validated `email`. Extra host fields strip before IPC serialization. Pending statuses may retain `signedIn: true` for an existing active session.
- Actions: `email`, `code`, `local`, `verify_email`, `mfa`, `logout`, `cancel`. Email maximum 254; password 1–4096. OTP/MFA exactly six digits, including rejection of trailing newlines.
- `verify_email.code` trims, requires 1–128 characters. SDK 0.3.1 generated `VerifyEmailRequest` specifies trimmed nonempty strings rather than six digits (`packages/desktop/node_modules/@cortex/sdk/src/gen/types.gen.ts:258`).
- Both core and route validate inputs. Both auth reads/submits parse host output. Secrets never enter core storage/events.
- Connection `signedIn` comes only from current-origin host state; local and malformed/missing legacy origins do not call the host. Missing host reads signed-out, remote submits refuse `provider_unsupported`; local/invalid-origin submits refuse `invalid_request`.
- `set` validates, normalizes stored URL to `URL.origin`, persists, then calls `clear()` only for a changed mode or active origin. Invalid inputs and failed storage writes preserve host state. Same-origin host case/default port/trailing slash changes preserve it. `clear()` owns callback cancellation; tests exercise an aborting fake.
- Host owns logout/cancel semantics. No remote revocation or remote inference implemented or claimed.

## Verification

Node **v22.23.3** at `/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node`.

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/vitest/vitest.mjs run packages/core/test/connection.test.ts packages/core/test/services.test.ts packages/protocol/test/protocol.test.ts packages/client/test/client.test.ts packages/server/test/server.test.ts
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/typescript/bin/tsc -p tsconfig.json
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/eslint/bin/eslint.js packages/schema/src/index.ts packages/protocol/src/index.ts packages/client/src/index.ts packages/server/src/index.ts packages/core/src/connection.ts packages/core/src/index.ts packages/core/test/connection.test.ts
git diff --check
```

Results: **33 tests passed, five files**; typecheck passed; scoped lint passed; diff check passed. Tests run once. No repository build, E2E, CI or Mac verification performed. No docs, UI, main-service or vendor writes. Coordinator retains documentation and desktop integration ownership.
