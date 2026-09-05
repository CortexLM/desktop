# Desktop staging → production

Agent path for **Cortex Chat + Code** (this repo). Bot is a separate app.
Do not change `CortexLM/cortex`. Coordinate `CortexLM/backend` staging when
the live API contract changes.

## Agent checklist (copy-paste)

```
Desktop staging → prod (Chat+Code, no Bot). Do not touch CortexLM/cortex.

[ ] 1. If this change needs an API, land CortexLM/backend on staging first and
      set GitHub Environment `staging` vars VITE_CORTEX_API_BASE_URL and
      CORTEX_API_BASE_URL to that host. Local unit tests leave them unset.
[ ] 2. Land the desktop PR on main. Do not merge your own cloud-agent PR
      unless asked. Do not enable auto-merge.
[ ] 3. SHA=$(git rev-parse origin/main)   # full 40 hex chars
[ ] 4. gh workflow run publish-staging.yml -f sha=$SHA -f publish_feed=true --ref main
[ ] 5. Wait for Linux dist on CodeBuild (runs-on codebuild-cortex-gha-arm64-…
      or x64). Do not re-run electron dist on ubuntu-latest.
[ ] 6. Install from https://software.cortex.foundation/staging/ and test
      Chat + Code (empty / loading / error / signed-out as needed).
[ ] 7. After a green staging pass, promote prod by tagging that SHA:
      git tag vX.Y.Z $SHA && git push origin vX.Y.Z
      That builds mac + win + linux and writes the production feed.
[ ] 8. Do not copy staging/ onto the production bucket root. Do not aws sso login
      (device code). CodeBuild uses a GitHub App / CodeConnections connection;
      R2 uses Environment secrets; AWS from GHA uses OIDC.
```

## Update feed channels

R2 custom domains attach to a **bucket**, not a key prefix. Prefixes are
object keys under that host. Packaged production Electron still checks
**`https://releases.cortex.foundation/`** (bucket `cortex-releases`, objects at
the root) so already-shipped apps keep working. Staging is a second generic
feed, baked into staging installers only.

| Channel | Public URL | R2 objects | Who writes |
| --- | --- | --- | --- |
| **latest** (prod) | `https://releases.cortex.foundation/` | bucket `cortex-releases` at `/` (`/latest.yml`) | `build.yml` `publish-feed` on a `v*.*.*` tag |
| **latest** (named) | `https://software.cortex.foundation/latest/` | bucket `cortex-software` at `latest/` | same job, optional mirror when `PRODUCTION_SOFTWARE_BUCKET` is set |
| **staging** | `https://software.cortex.foundation/staging/` | bucket `cortex-software` at `staging/` | `publish-staging.yml` from a **main** SHA |

Constants: `DEFAULT_UPDATE_FEED_URL` and `STAGING_UPDATE_FEED_URL` in
`packages/main/src/update-policy.ts`. Production `electron-builder.yml`
`publish.url` stays the releases host. Staging dist passes
`-c.publish.url=https://software.cortex.foundation/staging/` so
`app-update.yml` in that build points at the staging prefix.

`CORTEX_UPDATE_FEED_URL` remains a local-feed test hook, not a third public
channel.

### Why two hosts

`releases.cortex.foundation` is bound to `cortex-releases` with objects at the
root, which is what electron-updater requests (`/latest.yml`). Putting
production files under `desktop/` or `latest/` on that host would 404 the
packaged app.

`software.cortex.foundation` is bound to `cortex-software`. Channel prefixes
`latest/` and `staging/` are then `/latest/latest.yml` and
`/staging/latest.yml`. Staging installers use the staging prefix. Production
installers do not.

Staging credentials live on GitHub Environment **`staging`**. Production
credentials stay on **`production`**. Staging must not be able to write
`cortex-releases` or the releases host.

## CodeBuild runners (long Electron dist)

Linux `electron-builder` is the long job. It must not use GitHub-hosted
`ubuntu-latest`.

Label (project name `cortex-gha-arm64` or `cortex-gha-x64`, same style as
backend `cortex-gha-*`):

```text
codebuild-cortex-gha-${arch}-${{ github.run_id }}-${{ github.run_attempt }}
```

`arch` is `arm64` unless repository variable `CODEBUILD_RUNNER_ARCH` is the
string `x64`. Dual-arch Linux installers (x64 + arm64 native addons) are
more reliable on the x64 project; set that variable if ARM cross-compile
fails.

macOS and Windows dist stay on `macos-latest` / `windows-latest` (signing and
notarization). Short jobs (unit tests, rclone publish) stay on
`ubuntu-latest`.

If the CodeBuild project is missing, the job queues until `timeout-minutes`
and fails. Create the projects with Terraform in `infra/codebuild-gha/` or
`scripts/create-codebuild-gha-runner.sh`. Use GitHub OIDC or an existing AWS
role in the environment. Do not run `aws sso login`.

## Publish staging from a main SHA

`.github/workflows/publish-staging.yml` is `workflow_dispatch` only:

- Input `sha` — full 40-character commit that **must be on `origin/main`**.
- Input `publish_feed` — upload to `software.cortex.foundation/staging/` after
  a green Linux dist (still gated on `vars.STAGING_FEED_ENABLED == 'true'`).

A push to the `staging` branch still runs `.github/workflows/staging.yml`
(web + unpacked Electron artifacts). That workflow does not write R2.

## Promote to production

Staging Linux is not a production feed. Promote by **tagging the same SHA**
so `build.yml` builds mac + win + linux and `publish-feed` writes
`cortex-releases` (and optionally `cortex-software/latest/`).

Gates: GitHub Environment `production`, `vars.PRODUCTION_DEPLOY_ENABLED == 'true'`,
version tag `v*.*.*`.

## GitHub variables and secrets

### Environment `staging`

| Name | Kind | Purpose |
| --- | --- | --- |
| `R2_ACCESS_KEY_ID` | secret | Token that can write **only** `cortex-software` (not `cortex-releases`) |
| `R2_SECRET_ACCESS_KEY` | secret | Matching secret |
| `CLOUDFLARE_ACCOUNT_ID` | secret | R2 S3 endpoint account id |
| `STAGING_FEED_ENABLED` | variable | Must be `true` or the staging feed upload is skipped |
| `STAGING_SOFTWARE_BUCKET` | variable | Optional. Defaults to `cortex-software` |
| `VITE_CORTEX_API_BASE_URL` | variable | Staging API for the web artifact / renderer build |
| `CORTEX_API_BASE_URL` | variable | Same host for Electron main |

### Environment `production`

See [releases.md](../releases.md). Extra optional variable:
`PRODUCTION_SOFTWARE_BUCKET` (default empty = skip the `latest/` mirror).

### Repository

| Name | Purpose |
| --- | --- |
| `CODEBUILD_RUNNER_ARCH` | `x64` to use `cortex-gha-x64`; any other value uses `arm64` |
