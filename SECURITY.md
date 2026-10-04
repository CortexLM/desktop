# Security policy

## Report a vulnerability

Email **security@cortex.foundation** (or open a **private** GitHub security
advisory on this repository if email is unreachable).

Include:

- a description of the issue and its impact;
- steps to reproduce on a clean checkout;
- affected version / commit.

Do **not** file a public issue for a vulnerability. Do **not** attach
`.env` files, keychain dumps, cookies, session tokens, or customer data.

We will acknowledge the report and work on a fix before any public
disclosure.

## What this project stores

| Secret | Where it lives | Where it must not live |
| --- | --- | --- |
| Provider API keys | Electron main: `<dataDir>/credentials.json`, mode `0600`, encrypted with `safeStorage` when the OS keychain is available | Git, the renderer, logs, screenshots, issues |
| Cortex Cloud / self-hosted session | Electron main only (`packages/desktop/src/remote.ts`) | The renderer, logs, this repository |

There is no `.env.example`; no secret is needed to build or test.

## Client rules

- The renderer is served from `cortex://app`, sandboxed, with `contextIsolation` on and `nodeIntegration` off.
  It never sees a provider key: `PUT /api/providers/:id/key` is write-only and `ProviderConfig` carries only `hasKey` and `keyHint`.
- The preload bridge (`packages/desktop/src/preload.ts`) exposes plain-data methods only; main routes `cortex:fetch` to `/api/*` and nothing else.
- Navigation is locked to `cortex://app`; only `https://` URLs open externally.
- A new IPC channel that carries a secret needs a test that the value is not read back, and a mention in the PR.

## Dependency reports

GitHub Dependabot and `bun audit` are the routine path for library CVEs. Those are not a substitute for reporting a
product bug in Cortex itself.
