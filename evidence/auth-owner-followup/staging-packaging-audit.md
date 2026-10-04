# Rewrite staging packaging audit

Historical pre-implementation audit below. The subsequent implementation restores a
rewrite-compatible workflow and compiled staging origin; current operator requirements
are in `docs/staging-release.md`. It uses **distinct** `STAGING_R2_ACCESS_KEY_ID`,
`STAGING_R2_SECRET_ACCESS_KEY`, `STAGING_CLOUDFLARE_ACCOUNT_ID` secrets, not the old
names below, and Ubuntu x64 rather than the old CodeBuild runner. No hosted delivery
or real backend acceptance has yet been established. Backend issue #450 is the
authoritative coordination record.

Coordinator constraint: backend staging precedes desktop acceptance/publication.
Producer order: backend #446, #449, #447; web #448, #445. Desktop performs no merge
or deployment. No production credentials are copied or used.

Producer head readback (all OPEN, none merged at inspection):

| Order | Backend repository PR | Head SHA |
| --- | --- | --- |
| Backend 1 | #446 | `3b3b5926f33309b12e949f4978e03795129df557` |
| Backend 2 | #449 | `e572eacad35db1174f93892266450899304f9168` |
| Backend 3 | #447 | `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31` |
| Web 1 | #448 | `70d5bda274be246e7076a506bbb60bfa85ed7d74` |
| Web 2 | #445 | `3d04a790b9b9b541e81a00c1c33e04d5af2de890` |

These are producer branch heads, not a deployed staging SHA. Desktop's vendored
SDK source matches #447 here. Coordinator must supply the accepted combined staging
revision and origin after the ordered integrations; desktop must not infer deployment
from a green producer branch.

## Observed incompatibilities

The default branch has `.github/workflows/publish-staging.yml`. PR #36 deletes it
and its local actions `linux-native-toolchain`, `publish-r2-feed`, `install-rclone`.
The default-branch workflow invokes the native-toolchain action before switching
to its requested main SHA, then invokes publishing actions from the workflow ref.
It cannot be assumed to survive merging the rewrite's deletions.

Its build passes `VITE_CORTEX_API_BASE_URL` and `CORTEX_API_BASE_URL`. The rewrite
does not read either variable: `packages/core/src/connection.ts` defines Cloud as
`https://api.cortex.foundation`. A supplied staging variable would therefore not
redirect Cloud. Local mode remains the default; staging acceptance can explicitly
select Self-hosted and enter the staging origin through existing Settings. A
dedicated staging-default artifact requires an explicit main-owned configuration
change and tests, not an undocumented renderer environment variable.

The rewrite has no auto-updater. Uploading an electron-builder feed cannot prove
automatic update consumption. Current local package smoke proves startup only.
The old workflow must be adapted to the rewrite's Bun 1.4.2/Node 22+ requirements,
Electron binary installation and actual installer targets before publication.

## Configuration inventory (names only)

GitHub repository variables list only `PRODUCTION_AWS_REGION` and
`PRODUCTION_AWS_ROLE_ARN`. Repository secret names include `CLOUDFLARE_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; their permissions are unknown and must
not be assumed staging-restricted. No values were retrieved.
The `staging` environment reports zero variables and zero secrets.

Required before enabling the existing publisher or its approved replacement:

- Accepted staging API HTTP(S) origin and exact deployed backend/schema/SDK revisions.
  No production-origin fallback is acceptable for a claimed staging validation.
- Explicit staging-only artifact configuration, or a documented manual Self-hosted
  setup with verification of the actual request origin.
- Repository `STAGING_FEED_ENABLED=true` only after acceptance; the old publisher
  also requires dispatch `publish_feed=true` and a full SHA already on main.
- Explicit `STAGING_SOFTWARE_BUCKET` and approved `staging/` destination serving
  `https://software.cortex.foundation/staging/`.
- Separately provisioned staging-environment `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID`. Credentials must be restricted to
  the approved staging storage scope; a destination string check alone is not IAM.
  Do not reuse repository credentials without verified scope. If prefix restriction
  is unavailable, use isolated staging storage or an equivalent enforced boundary.
- Validated runner selection (`CODEBUILD_RUNNER_ARCH` for the old CodeBuild job),
  supported architecture, matching installer/feed filenames and upload manifest.
- Account and eligible image/reasoning Chat model; uncontested native Mac access.

No workflow dispatch, feed upload, credential write, merge or deploy was performed.
