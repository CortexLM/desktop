# 01 — Security

## 1.1 Provider keys stay in main

The renderer never holds, reads or logs a provider key. Keys are written through a
write-only route and stored by main.

- `PUT /api/providers/:id/key` sets a key, `DELETE` removes it. There is no route that
  returns a key (`packages/protocol/src/index.ts`).
- `ProviderConfig` (`packages/schema/src/index.ts`) carries `hasKey` and `keyHint` (last
  four characters) only.
- Main implements `Credentials` in `packages/desktop/src/credentials.ts`:
  `<dataDir>/credentials.json`, mode `0600`, each value encrypted with `safeStorage` when
  the OS keychain is available (`e:` prefix), base64 otherwise (`p:` prefix).
- `scripts/dev-api.ts` uses `memoryCredentials()`; keys vanish on exit.

**Bad** — a read route that ships the key to the UI:

```ts
"provider.key": r("get", "/api/providers/:id/key"),
```

**Good** — the UI only learns that a key exists:

```ts
return { providerID: id, enabled: c.enabled, hasKey: !!key, keyHint: key ? c.keyHint : undefined, baseURL: c.baseURL }
```

Cortex Cloud session material follows the same rule: `packages/desktop/src/remote-session.ts`
runs in main; only status, active `signedIn` and validated email cross to the renderer.
Native device pairs persist in a separate `remote-credentials.json`, OS-encrypted only:
Windows CurrentUser DPAPI or safeStorage with Linux `basic_text` refused. Pair replacement
is serialized and atomic; `/v1/me.id` must match before refresh commits. No SID or refresh
expiry is projected. Access-only web cookies/tokens/continuation secrets remain process-local. Origin/account
changes invalidate old clients and pending authentication; remote redirects are refused.
MCP connection material is also write-only: command, arguments, environment, URL and headers
are stored in main's separate `mcp-credentials.json`. Public `McpServer` exposes only name,
transport type, enabled/status, tool metadata and neutral errors. Do not spread `McpConfig`
into responses; arguments and URLs can contain credentials too.

## 1.2 The renderer is sandboxed

`packages/desktop/src/main.ts` creates the window with `sandbox: true`,
`contextIsolation: true`, `nodeIntegration: false`. Never loosen these to make a feature
work; move the feature into main.

- Navigation is locked to `cortex://app` (`will-navigate`); `window.open` is denied.
- External links: only `https://` URLs, via `shell.openExternal`.
- The `cortex` protocol handler refuses paths outside `packages/app/dist` (403).
- `cortex:fetch` routes only `/api/*` paths to the engine.
- CSP in `packages/app/index.html`: `default-src 'self'`, `connect-src 'self'`.
- Preload exposes plain-data functions only (`packages/desktop/src/preload.ts`). A new
  bridge function is a security review item.
- Bot calls (`cortex:call:*`): main validates every renderer payload (Bot UUID, exactly
  640-byte capture, numeric receipts, boolean mute) and never sends a ticket or bearer to
  the renderer. Data from the media socket is untrusted: a frame that does not decode
  ends the call, it never throws in main. See [`docs/bot-calls.md`](../docs/bot-calls.md).

**Bad**: `webPreferences: { contextIsolation: false }` or `--disable-web-security`.

## 1.3 No secrets in git

No keys, tokens, cookies, `.env` files or private URLs in commits, PR bodies, screenshots
or logs. Test keys are obvious placeholders (`sk-test-123456` in `tests/e2e/engine.spec.ts`).
If you committed one, rotate it first, then remove it.

Test hooks must not become production backdoors: `CORTEX_TEST_PROVIDER_BASEURL` is ignored
when `app.isPackaged`.

## 1.4 Local first, account optional

Local mode is the default and needs no account. Cortex Cloud and self-hosted are opt-in
connection modes (`docs/connection-modes.md`). A surface that needs a backend says so
honestly; it never shows a spinner that never resolves or a raw HTTP status.

## 1.5 Trust boundaries worth naming

- **Agent tools touch disk and run commands.** `bash`, `write`, `edit` and paths outside
  the session directory (`external_directory`) ask by default
  (`packages/core/src/permission.ts`). Do not add a tool path that skips `ctx.ask`.
- `bash` runs with the user's rights. There is no sandbox; do not claim one.
- Plugins run in-process with host privileges (`packages/core/src/plugin.ts`).
- Computer-use input actions always ask; "always" is never stored for them
  (`docs/computer-use.md`).
- Engine error `message` strings are for developers. They may be logged, never rendered.
- Logs are a public surface: no keys, no request bodies from authenticated calls.
