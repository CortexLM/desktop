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
| Provider API keys | OS keychain via Electron main | Git, renderer, logs, `.env` committed to the repo |
| Cortex session | Main-process store, never logged | `packages/cortex-api` source, screenshots, issues |
| SSH / host keys | Server-side only | The client, the renderer, this repository |
| Paper MCP auth | Local `.env` / MCP config (gitignored) | Commits, docs, CI logs |
| R2 API token (production desktop feed) | GitHub Environment `production` secrets (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID`) | Git, renderer, repo-wide secrets, workflow logs, Environment `staging` |
| R2 API token (staging desktop feed) | GitHub Environment `staging` secrets (same names; token must not be able to write `cortex-releases`) | Git, renderer, Environment `production`, workflow logs |

`.env.example` is example-only. Values there are placeholders.

## Client rules

- The renderer origin is `file://` (desktop) or the Vite origin (web). It
  never calls provider APIs with a raw key.
- IPC is allowlisted in `packages/preload`. Do not add an open `invoke`.
- `nodeIntegration` stays off. `contextIsolation` and `sandbox` stay on.
- A new IPC channel that carries a secret needs a schema, a test that the
  value is not read back, and a mention in the PR.

## Dependency reports

GitHub Dependabot and `bun audit` / the `security-audit` workflow are the
routine path for library CVEs. Those are not a substitute for reporting a
product bug in Cortex itself.
