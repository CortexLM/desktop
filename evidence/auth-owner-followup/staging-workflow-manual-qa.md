# Staging workflow implementation QA

Implementation-only acceptance. No workflow dispatch, upload, secret access, merge, commit or deployment. No updater claim. Eval/toolkit unavailable; caller evidence directory used. Local Node v24.21.0, Bun 1.4.2; workflow pins Node 22. Package probe used existing local application bundles, not a freshly verified staging-origin build.

## manualQa

### surfaceEvidence

| Scenario | Criterion | Surface | Exact invocation | Verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| S1 | Valid workflow and unchanged CI | CLI | `actionlint .github/workflows/publish-staging.yml` and `git diff --exit-code -- .github/workflows/ci.yml` | PASS | A1 |
| S2 | Typed, linted validation helper | CLI | `./node_modules/.bin/eslint scripts/staging-config.mjs tests/unit/staging-config.test.ts` and `./node_modules/.bin/tsc -p tsconfig.json` | PASS | A1 |
| S3 | Actual installers and supported generic feed | CLI/data | `bunx --no-install electron-builder --linux AppImage deb --x64 --publish never --config .staging-builder.json -c.directories.output=/tmp/cortex-staging-package-verified`; then `INPUT_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa node scripts/staging-config.mjs inventory /tmp/cortex-staging-package-verified` | PASS for generated files and hashes; background builder exit notification unavailable, no process-exit claim | A1, A2, A3 |
| S4 | Hosted CI approval/publication | GitHub Actions/R2 | Not invoked: caller forbids dispatch/upload | FAILURE: missing authorized hosted execution, approved destination mapping, environment reviewers and credentials | A4 |

### adversarialCases

| Scenario | Criterion | Class | Expected behavior | Verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| A5 | Fail closed configuration | Missing opt-in, bucket, origin; production destination; malformed SHA; HTTP/credential/path origin | Reject each input | PASS via `NODE_ENV=test bun run test -- tests/unit/staging-config.test.ts` | A1 |
| A6 | Artifact integrity | Tampering, missing installer, wrong SHA, path traversal | Reject before publication | PASS via same focused test invocation | A1 |
| A7 | Desktop GUI | Visual/theme/input | not_applicable: workflow/helper changes add no UI | N/A | A4 |
| A8 | Hosted main ancestry/CI | Off-main SHA or incomplete CI | Reject before packaging | FAILURE: live hosted negative dispatch intentionally not authorized | A4 |

### artifactRefs

| ID | Kind | Description | Path |
| --- | --- | --- | --- |
| A1 | CLI log | Successful real inventory verification, actionlint, eslint, types, two boundary tests, unchanged CI | `evidence/auth-owner-followup/staging-workflow-final-checks.log` |
| A2 | JSON | Actual installer and manifest SHA-512 inventory | `evidence/auth-owner-followup/staging-package-inventory.json` |
| A3 | YAML | Actual electron-builder feed with both installer URLs and hashes | `evidence/auth-owner-followup/staging-latest-linux.yml` |
| A4 | Report | Scope and unavailable hosted acceptance | `evidence/auth-owner-followup/staging-workflow-manual-qa.md` |

## Integration requirements

CI gate selects the latest main push run for exact input SHA using `/actions/workflows/ci.yml/runs?head_sha=...&branch=main&event=push`, verifies head SHA again, requires completed success plus all three exact job names from current ci.yml. `actions: read` is added only to verification; contents remains read-only. No PR check or similarly named foreign workflow qualifies. SHA must include the new helper and parent-owned staging build implementation. Older main commits lacking either are not publishable.

Publication requires repository variables `STAGING_FEED_ENABLED=true`, `STAGING_SOFTWARE_BUCKET=cortex-software-staging`, and `CORTEX_STAGING_API_ORIGIN` as a nonproduction HTTPS origin. Bucket name is an intentional exact allowlist, not an assertion the bucket exists or is approved. Owner must provision/approve isolated storage and map `https://software.cortex.foundation/staging/` to its `staging/` objects. Do not point that hostname at production storage without explicit routing isolation. Staging-only credentials must be bucket-scoped; string validation is not IAM.

Environment `staging` must have required reviewers and secrets `STAGING_R2_ACCESS_KEY_ID`, `STAGING_R2_SECRET_ACCESS_KEY`, `STAGING_CLOUDFLARE_ACCOUNT_ID`. Verification queries environment protection; permission/visibility refusal fails closed. Confirm the repository's GITHUB_TOKEN can read environment metadata before enabling publication. No production fallback exists.

Install/build jobs receive no publication secrets, persisted checkout credential or dependency cache. Publication uses fresh hosted runner, pinned artifact actions and runner-provided AWS CLI; no dependency install. Immutable SHA-named installers use conditional PutObject before mutable latest-linux.yml. Existing object refusal aborts rather than silently overwriting; a partially successful publication requires owner recovery before rerun. R2 conditional-write behavior and runner AWS CLI compatibility remain hosted acceptance prerequisites.

First package probe exposed target-specific `${arch}` names; implementation now uses literal x64 for this explicitly x64-only workflow. Actual manifest generation then exposed Bun isolated dependency resolution; helper resolves js-yaml from installed electron-builder rather than an undeclared root dependency. Final real inventory verification passes.

Parent owns AGENTS.md/docs updates, API-origin implementation, native staging smoke, normal commits/push. No full application rebuild or native smoke was performed by this worker because shared parent build outputs were not owned here. No claim that local test installers contain the newly configured origin.
