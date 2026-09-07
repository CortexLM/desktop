# Desktop production audit

**Marker: `DESKTOP_PARTIAL`**

Cortex desktop is Chat + Code only (no Bot in the switcher). This file
records completeness versus Paper Concept 03 and production readiness.
Backend deploy remains a HOLD on Oding’s lane; this repo does not ship the
control plane.

## Marker

`DESKTOP_PARTIAL`

Desktop code for Chat | Code, This PC, browser sign-in, GitHub App start,
legal links, packaging, and signed-update wiring is in this tree. Production
is not fully ready until the control plane and signing credentials exist.

### Blockers (names only)

Secrets (Environment `production` unless noted):

- `MACOS_CERTIFICATE`
- `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_ACCOUNT_ID`

Variables:

- `PRODUCTION_DEPLOY_ENABLED`
- `PRODUCTION_RELEASES_BUCKET`
- `PRODUCTION_SOFTWARE_BUCKET`
- `STAGING_FEED_ENABLED` (Environment `staging`)
- `STAGING_SOFTWARE_BUCKET` (Environment `staging`)
- `CODEBUILD_RUNNER_ARCH`

Backend HOLD (not a desktop secret; Oding’s lane):

- Allowlist `https://cortex.foundation/desktop/open` and `cortex://auth/callback`
- Serve the desktop bridge on the marketing origin
- `POST /v1/auth/login` (email) if that route is still missing
- AuthKit Apple and SSO connections
- `GET /v1/integrations/github/install` (GitHub App, no PAT)
- Public Privacy and Terms pages at `cortex.foundation`

## Already true

| Area | State |
| --- | --- |
| Shell switcher | Chat then Code. Bot is not a tab. `/bot` routes stay for the API client. |
| Paper routes | `packages/app/src/routes.ts` is asserted against `design/paper/screens.json`. |
| This PC | Desktop folder picker. No working-directory fallback. Web never offers it. |
| Guest use | Home / Sessions / Settings work unsigned. Cloud, SSH, Automations, Review, Usage are shown and locked. |
| No PAT field | Nothing in Code asks the user to paste a GitHub token. |
| No Secrets page | No `/code/secrets` route or Settings vault. |
| Google / GitHub / email | System browser + PKCE for Google and GitHub; email stays on the in-app form. |
| Device flow | `/sign-in/device` remains as a fallback. |
| Auto-update | Packaged apps check `https://releases.cortex.foundation/` (already-shipped). Staging is `https://software.cortex.foundation/staging/`. Production also mirrors `https://software.cortex.foundation/latest/`. |
| Packaging CI | `build.yml` mac / win / linux (Linux on CodeBuild). `publish-staging.yml` from a main SHA. |
| Tests | Unit, discovery, E2E welcome click-through, Paper route parity. |

## P0 — production blockers (this repo)

| ID | Finding | Action |
| --- | --- | --- |
| P0-1 | Sign-in offered GitHub, Google, and email only. Goal is Google, Apple, email, SSO, plus Privacy and Terms. | Add Apple and SSO browser-login buttons. Legal copy is real links to `cortex.foundation/privacy` and `/terms`, opened by main (the renderer never sends a URL). |
| P0-2 | Connect GitHub labelled “Install the Cortex GitHub app” but opened a local folder. | Start a GitHub App install in the system browser (`GET /v1/integrations/github/install`). Fail closed if the route is missing. Skip still means This PC / local repos. No PAT field. |
| P0-3 | Integrations → GitHub Connect was a no-op message. | Same GitHub App install as P0-2. |
| P0-4 | Sign-in and SSH could render `error.message` (vendor names, status codes). | Classify to product copy. |
| P0-5 | macOS notarization (`afterSign`) was commented out, so a tagged build could ship unsigned for Gatekeeper. | Enable `scripts/notarize.js`. It skips when Apple secrets are absent (local/CI) and notarizes when they are set. |
| P0-6 | `software.cortex.foundation/latest/` mirror ran only when `PRODUCTION_SOFTWARE_BUCKET` was set. | Always publish that prefix (default bucket `cortex-software`) so the software host is a first-class production channel. Already-shipped apps keep checking `releases.cortex.foundation`. |

## P1 — should ship before a public tag

| ID | Finding | Action |
| --- | --- | --- |
| P1-1 | Auth callback copy named only Google or GitHub. | Name the methods the screen actually offers. |
| P1-2 | Email failure copy named only Google or GitHub. | Include Apple and SSO. |
| P1-3 | GitHub onboarding step was hard-coded `done: false` with no install attempt. | Attempt the App install; keep `done` honest (still false until the service can say so). |
| P1-4 | Docs described GitHub connect as unavailable and the latest/ mirror as optional. | Update `AGENTS.md`, `docs/code.md`, `docs/releases.md`, `CONTRACT.md`. |
| P1-5 | Tests did not pin Apple/SSO, legal links, no-PAT, or GitHub App start. | Add them. |

## P2 — follow-up, not a tag blocker

| ID | Finding |
| --- | --- |
| P2-1 | Paper Sign In still draws GitHub + Google + email only. Apple and SSO are a product requirement beyond that artboard. Sync Paper when the board is updated. |
| P2-2 | Narrow 390 / 768 layouts are still desktop-first (`.rules/03-responsive.md`). |
| P2-3 | Auth card mark uses raw hex (`#1f4944`, `#f8f5ea`) instead of tokens. |
| P2-4 | Workspace setup accepts a name and then opens the folder picker (the folder already has a name). |
| P2-5 | Several product routes still surface `error.message` (Chat, automations, tickets). Same classify rule as P0-4, wider blast radius. |
| P2-6 | Device-flow `/auth/device/*` drift on some deployments. Desktop already maps `not_found` to honest copy. |
| P2-7 | Visual Paper parity is reporting-only (JPEG baselines). |
| P2-8 | Leftover `/bot` screens are not in this shell’s switcher; they stay for the API client and deep links. |
| P2-9 | Cutting already-shipped apps over from `releases.cortex.foundation` to `software.cortex.foundation/latest/` is a coordinated release, not a silent URL swap. |

## How to try it

Desktop: `bun run build && bun run start`

- `/welcome` → Get started → `/sign-in`: GitHub, Google, Apple, SSO, email, Privacy/Terms, continue without an account.
- `/code` unsigned: This PC starts after the folder picker. Cloud and SSH stay locked.
- `/sign-in/github` and Settings → Integrations → GitHub: Install opens the system browser, or an honest “not available yet”. No token field.
- Skip on Connect GitHub: local / This PC path.

Web: `bun run --filter @cortex-ide/app dev` — same renderer; This PC stays locked.

## Verification

See the pull request. Required: `bun run typecheck`, `npx eslint packages`, `bun run test`, `bun run test:discovery`.
