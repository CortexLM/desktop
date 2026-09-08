# Desktop auto-update feed

New packaged Cortex builds check **`https://software.cortex.foundation/latest/`** (generic
electron-builder / electron-updater provider). That URL is the only production
channel. It is set in `electron-builder.yml` (`publish.url`) and
`packages/main/src/update-policy.ts` (`DEFAULT_UPDATE_FEED_URL`). Do not add a
GitHub Releases provider for production.

## Path: tag → R2 → custom domain → app check

1. Push a version tag `v*.*.*`.
2. `Build and Release` (`.github/workflows/build.yml`) builds macOS, Windows,
   and Linux installers and uploads artifacts (yml, blockmap, dmg/zip/exe/
   AppImage/deb).
3. Job `publish-feed` runs only when the ref is a tag **and**
   `vars.PRODUCTION_DEPLOY_ENABLED == 'true'`, on GitHub Environment
   **`production`**.
4. It flattens those files and **rclone copy** (not sync — older versioned
   installers stay) to R2 bucket **`cortex-releases`**, objects at the bucket
   root for legacy clients and **`cortex-software/latest/`** for new clients,
   via `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`.
   rclone **v1.70.3** linux-amd64 is downloaded from `downloads.rclone.org`
   and installed only after `sha256sum -c --strict` matches the SHA-256
   pinned in `.github/actions/install-rclone/action.yml` (`RCLONE_SHA256`). A mismatch
   fails the job before unzip; the binary is never run.
5. Custom domain **`releases.cortex.foundation`** is bound to that bucket, so
   electron-updater fetches `/latest.yml`, `/latest-mac.yml`,
   `/latest-linux.yml` (and the installer each file names) at the host root.
6. A packaged app reads the feed embedded in `app-update.yml`; startup does
   not replace it. Only an explicit local test override calls `setFeedURL`.

This repo does not create the bucket or the DNS record. Bind
`releases.cortex.foundation` to R2 bucket `cortex-releases` (public bucket
access or an equivalent custom-domain setup). Bind
`software.cortex.foundation` to `cortex-software` for the `latest/` and
`staging/` prefixes. Terraform for CodeBuild runners lives in
`infra/codebuild-gha/`; it does not create R2 buckets.

## Why a dedicated bucket at the root

R2 custom domains attach to a **bucket**, not a key prefix. Uploading to
`cortex-software/desktop/` would serve
`https://releases.cortex.foundation/desktop/latest.yml`, which is not what
electron-updater requests. A second bucket **`cortex-releases`** with objects
at the root keeps `https://releases.cortex.foundation/latest.yml` aligned with
the generic `publish.url`. CLI or other software can use a different bucket;
this workflow does not write one.

## GitHub Environment `production`

Put credentials on the **production** environment so `staging.yml` cannot
read them. Restrict that environment to tags if the GitHub UI allows it.

### Secrets

| Name | Purpose |
| --- | --- |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `CLOUDFLARE_ACCOUNT_ID` | Account id in the R2 S3 endpoint |
| `MACOS_CERTIFICATE`, `MACOS_CERTIFICATE_PASSWORD` | Developer ID signing identity and password |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Built-in macOS notarization |
| `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` | Windows Authenticode identity and password |

No AWS access keys. No OIDC role for this job.

### Variables

| Name | Purpose |
| --- | --- |
| `PRODUCTION_DEPLOY_ENABLED` | Must be the string `true` or `publish-feed` is skipped |
| `PRODUCTION_RELEASES_BUCKET` | Optional. Defaults to `cortex-releases` |
| `PRODUCTION_SOFTWARE_BUCKET` | Optional bucket override, defaults to `cortex-software`; production always writes `latest/` |

The build job uses this environment too. macOS/Windows credentials are checked
before dependency installation, and packaging passes `forceCodeSigning=true`.
macOS notarization uses electron-builder 25.1.8's built-in integration and
default Electron entitlements. Windows update signature verification stays
enabled. Missing credentials fail the build instead of releasing unsigned
installers. Linux's SHA-512 feed checks are integrity checks, not an independent
publisher signature; a verified Linux signing policy is still a release gate.

## Staging

`staging.yml` builds artifacts on the `staging` environment and must not
upload to `cortex-releases` or `releases.cortex.foundation`. The staging
**update feed** is `https://software.cortex.foundation/staging/` (prefix
`staging/` on bucket `cortex-software`), published by
`.github/workflows/publish-staging.yml` from a main SHA. A local feed
override is `CORTEX_UPDATE_FEED_URL` (test hook only). Agent path:
[runbooks/desktop-staging-prod.md](./runbooks/desktop-staging-prod.md).

## Cache

Installers and blockmaps are uploaded with a long `Cache-Control`. Feed
metadata (`latest*.yml`, `RELEASES`) uses a short max-age so a new tag is
visible without waiting on a stale CDN object.
