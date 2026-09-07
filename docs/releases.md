# Desktop auto-update feed

Packaged Cortex checks **`https://releases.cortex.foundation/`** (generic
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
   root, via `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`.
   rclone **v1.70.3** linux-amd64 is downloaded from `downloads.rclone.org`
   and installed only after `sha256sum -c --strict` matches the SHA-256
   pinned in `.github/workflows/build.yml` (`RCLONE_SHA256`). A mismatch
   fails the job before unzip; the binary is never run.
5. Custom domain **`releases.cortex.foundation`** is bound to that bucket, so
   electron-updater fetches `/latest.yml`, `/latest-mac.yml`,
   `/latest-linux.yml` (and the installer each file names) at the host root.
6. A packaged app calls `setFeedURL({ provider: 'generic', url })` with
   `https://releases.cortex.foundation/` and downloads from that origin.

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

No AWS access keys. No OIDC role for this job.

### Variables

| Name | Purpose |
| --- | --- |
| `PRODUCTION_DEPLOY_ENABLED` | Must be the string `true` or `publish-feed` is skipped |
| `PRODUCTION_RELEASES_BUCKET` | Optional. Defaults to `cortex-releases` |
| `PRODUCTION_SOFTWARE_BUCKET` | Optional. Defaults to `cortex-software`. The same job always copies the feed to `<bucket>/latest/` (`software.cortex.foundation/latest/`) |

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
