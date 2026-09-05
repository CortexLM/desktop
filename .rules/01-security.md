# 01 — Security

## 1.1 No tokens in the renderer

The renderer (`packages/app`) is a web page. On desktop it is loaded from
`file://`; on the web it is served to a browser. In both hosts it is the least
trusted process in the system. A session token, a device token, an SSH key, a
provider API key, or a device-flow `device_code` must never be readable from it.

Session material lives in the Electron main process, encrypted at rest through
`safeStorage` (`0o600` when no keyring is available), and is exchanged over the
`cortex:*` IPC channels defined in `packages/shared/src/types/ipc/cortex.ts`. On
the web, the sealed `wos-session` cookie is `HttpOnly` and is set by the service —
the page never reads it.

**Bad** — the token crosses into renderer-visible state, and `localStorage` is a
store any injected script can read:

```ts
// packages/app/src/state/cloud-host.ts
const { token } = await api.signIn(email, password);
localStorage.setItem('cortex.session', token);          // readable by any script
setSession({ token, user });                            // now in renderer memory
```

**Good** — the renderer learns *that* there is a session, never *what* it is:

```ts
// packages/app/src/state/cloud-host.ts
await api.signIn(email, password);   // service sets the HttpOnly cookie
const account = await api.me();      // { id, email, plan } — no credential
setSession({ account });
```

The same shape applies on desktop: `window.cortex.cortex.signIn()` resolves to an
account summary, and the token stays in
`packages/main/src/services/cortex-account-service.ts`.

Desktop Google/GitHub login is a one-shot transaction in main: `state` plus a
PKCE verifier. `parseAuthCallback` rejects a credential with no `state`. The
PKCE verifier is sent only on `GET /v1/auth/callback` from main.

Corollaries:

- A new preload namespace must be added to the exposure-surface test **on
  purpose**. If a channel would let the renderer read a credential, the channel
  is wrong, not the test.
- Settings → Providers is the only place API keys are entered. They go
  main → keychain and are never echoed into a signal, a log, or a test snapshot.
- **Code has no Secrets page**, so there is no renderer surface that collects a
  value to store (`06-product.md` § 6.2.1). Do not add one back under another
  name: a field asking the user to paste a token into the least-trusted process is
  the shape this rule exists to keep out.

## 1.2 No secrets in git

Nothing that authenticates anything goes into the repository. That includes
`.env` files, cookie jars, private tunnel URLs, provider keys, device tokens,
and screenshots that happen to have a key on screen.

`.env.example` holds placeholders only, and a placeholder must be obviously
fake.

**Bad**:

```bash
# .env.example
CORTEX_API_KEY=sk-live-9f3a2c8e41b7d05fa6c1
```

```ts
// packages/cortex-api/src/__tests__/fixtures.ts
export const SESSION = { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' };
```

**Good**:

```bash
# .env.example
# Optional. Set on your machine only; Settings in the app overrides this.
CORTEX_API_KEY=sk-…
```

```ts
// packages/cortex-api/src/__tests__/fixtures.ts
export const SESSION = { token: 'test-session-token' };
```

If you believe a secret has been committed, treat it as leaked: rotate it first,
then remove it. See [`SECURITY.md`](../SECURITY.md). Do not paste the value into
the issue you open about it.

The `security-audit` workflow runs a secret scan on every PR to `main`. A hit
there is a blocker, not a warning.

## 1.3 Guest vs signed-in

Anonymous use is a product requirement, not a degraded mode. Without an account
the app opens onto a usable workspace: on desktop, Chat with a local or BYO
provider, and Code Home, Sessions, Session detail and Settings all work —
including **This PC** sessions bound to a folder on this machine.

Account-gated surfaces — Automations, Review, Usage, cloud runtimes, SSH connect,
and leftover `/bot` create — are **shown and locked**, never hidden. A locked
row explains what an account buys. An empty list explains nothing and reads like
a bug. This PC is Cortex Code only; Bot computers are cloud farm boxes.

**Bad** — the guest cannot tell whether the feature is missing, broken, or paid:

```tsx
<Show when={session.account}>
  <AutomationsList items={automations()} />
</Show>
```

**Bad** — a guest is told they made a mistake:

```tsx
<HonestState kind="error" title="Unauthorized" body="401" />
```

**Good** — the surface stays visible and the lock is explained:

```tsx
<Show
  when={session.account}
  fallback={
    <HonestState
      kind="signed-out"
      title="Automations need a Cortex account"
      body="Automations run in the cloud on a schedule. Sign in to create one. Chat still works unsigned."
      action={{ label: 'Sign in', href: '/sign-in' }}
    />
  }
>
  <AutomationsList items={automations()} />
</Show>
```

Every gated screen needs a signed-out test (`08-testing.md`). A guest must never
reach a spinner that never resolves, and must never be shown a raw HTTP status.

## 1.4 Trust boundaries worth naming

- **The renderer cannot call the Cortex API directly on desktop.** Its origin is
  opaque, so every `fetch` to `api.cortex.foundation` fails CORS before it is
  sent. No header fixes this. Route it through main over `cortex:*`. Discovering
  this again and "fixing" it with a proxy or a disabled web-security flag is a
  security regression, not a fix.
- **Never disable `contextIsolation`, enable `nodeIntegration`, or pass
  `--disable-web-security`** to make something work. If a feature seems to need
  it, the feature belongs in main.
- **The harness touches disk, a PTY, and Git.** File writes and shell commands
  are gated by Allow / Always / Deny on the session and are never silent. Do not
  add a code path that performs either without a permission decision.
- **Web never runs the harness in the tab.** See `06-product.md`.
- Logs are a public surface. No keys, no tokens, no cookies, no full request
  bodies from authenticated calls.
