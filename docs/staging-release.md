# Desktop staging delivery

Only the coordinator orders merges and authorizes publication. No production
deployment is part of this workflow. Build verification does not prove live staging
availability, native acceptance, signing or automatic updates.
Authoritative coordination record: https://github.com/CortexLM/backend/issues/450
(an issue, not a producer pull request). Final acceptance includes installer/feed,
the actual staging API origin, isolated profile and packaged auth/Chat/Code/Bot
checks against the accepted staging backend. A test-origin build is insufficient.

## Operator configuration

Set repository variables before dispatch:

| Variable | Required value |
| --- | --- |
| `CORTEX_STAGING_API_ORIGIN` | Accepted non-production HTTPS origin without credentials/path/query/fragment |
| `STAGING_SOFTWARE_BUCKET` | `cortex-software-staging`, an isolated bucket provisioned and approved by the operator |
| `STAGING_FEED_ENABLED` | `true` only when publication is authorized; not required for build-only dispatch |

Configure the `staging` GitHub environment with required reviewers and these
**distinct environment secrets**, never copied from production:

- `STAGING_R2_ACCESS_KEY_ID`
- `STAGING_R2_SECRET_ACCESS_KEY`
- `STAGING_CLOUDFLARE_ACCOUNT_ID`

Restrict the R2 credential to the isolated staging bucket. Configure the serving
layer so `https://software.cortex.foundation/staging/` reads its `staging/` keys.
The fixed bucket name is an allowlist, not evidence that this mapping exists.
The workflow does not fall back to repository production secret names.

## Reachable API and credentials

Supply one canonical non-production HTTPS origin reachable from each actual test
device. DNS, routing/VPN, firewall and port access must work on that device, not
just on the coordinator host. A loopback tunnel terminates on the host running it;
`localhost` on Windows does not reach a Linux coordinator's tunnel. If private
access is required, provision the route on each device and retain the canonical
hostname for TLS. Do not disable certificate verification or substitute HTTP.

The server must present an unexpired certificate covering that hostname and a
complete chain trusted by the packaged Electron/Node transport. A browser success
alone does not prove that trust. Redirect-based access portals, browser-cookie-only
gates, injected Basic-auth URLs and unimplemented client-certificate authentication
are not supported substitutes for the SDK's authentication contract. Discovery,
auth, upload and streamed Chat endpoints must be reachable without redirects.

Provide a staging-only account with access to its email-code inbox or approved
supported continuation, and an eligible configured Chat model. Never place tokens,
passwords or email codes in repository variables, command logs or evidence. Record
the accepted backend/schema/SDK revisions, exact origin and device/platform with
sanitized auth, Chat, Code and Bot outcomes. Code/Bot local execution must not be
reported as remote backend acceptance: establish actual route/model attribution
for each surface, and report unsupported remote behavior rather than invent it.

No real staging origin or eligible account/model has yet been supplied to this
desktop session. Hosted artifact generation, installer download/hash readback,
feed availability and packaged real-backend acceptance remain open. The staging
workflow currently builds Linux x64 only; it establishes no Windows installer or
Windows acceptance. Review-comment authorization is separate from code push and
does not follow from this runbook.

Configuration inventory at this session's latest read: all three staging repository
variables and all three distinct staging secret names above are absent; the staging
environment has zero variables/secrets. Existing production-named or unqualified
repository credentials are not substitutes. Device selection remains pending in
the coordinator's current user session. Historical `c9e25ac0` staging evidence does
not validate the rewrite.

The base builder declares macOS x64/arm64 DMG/ZIP, Windows x64/ia32 NSIS plus x64
portable, and Linux x64/arm64 AppImage/deb. Those declarations are not successful
installer runs: current staging publication implements Linux x64 AppImage/deb only;
existing macOS CI builds an unsigned arm64 package. Windows has no CI acceptance.
Do not infer the user's selected device or claim other staging installer platforms.

## Build and publication gates

1. Coordinator integrates backend producers #446, #449, #447 in order and supplies
   the accepted deployed revision/origin. Web integration order is #448 then #445.
2. Complete desktop acceptance against that backend, including usable account and
   eligible image/reasoning model. Keep native Mac evidence separate from Linux.
3. Coordinator merges the accepted desktop revision. Existing `CI` must succeed on
   that exact main push SHA, including checks, Linux Electron and macOS packaging.
4. After checking current user/session authority, dispatch `publish-staging.yml`
   from main with the full lowercase SHA. Default `publish_feed=false` builds only.
5. Publishing additionally requires explicit `publish_feed=true`, enabled feed,
   configured environment reviewers and environment approval. Missing configuration
   or secrets fails; no successful skipped publication is presented as delivery.

The workflow uses Node 22, Bun 1.4.2, installed Electron and unsigned Linux x64
AppImage/deb targets. No storage credentials enter dependency installation/build.
An inventory verifies SHA-512 feed references and artifact identities before
the publishing job. Immutable installer uploads precede the mutable feed manifest;
existing installer objects are not overwritten. A partial upload must be inspected
by the operator before any retry. Hosted R2 conditional-write support remains a
staging acceptance check, not something established by local packaging.

## Local checks

```sh
CORTEX_RELEASE_CHANNEL=staging CORTEX_STAGING_API_ORIGIN=https://staging.example.test NODE_ENV=production bun run build
CORTEX_STAGING_API_ORIGIN=https://staging.example.test xvfb-run -a node scripts/verify-staging-build.mjs
NODE_ENV=production bun run build
```

The probe checks the actual Electron main-owned Cloud origin and isolated default
profile without authentication/inference requests. Runtime origin overrides must
not alter the compiled origin. It is not live backend acceptance. The final command
restores production-default artifacts; application startup still defaults to local.
Staging uses `Cortex-staging` user data unless an explicit native test-profile switch
is provided. Production defaults and production-only discovery fallback remain intact.
