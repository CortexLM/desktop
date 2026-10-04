# Local handoff and remaining acceptance gates

The recovered objective is not complete. Local implementation is verified;
native and external acceptance remain open, not waived.
The goal is marked blocked. Unavailable remaining delivery work is dropped from
the active execution queue, not accepted or removed from the recovered objective.
Local verification and documentation are complete within the evidence scope below.

## Verified local increment

- Send with Enter, main-owned auth continuations, remote API/upload/one-off routing,
  remote Chat, separate process lists, history recovery and draft ownership.
- Final Electron regression: 195 passes in 18.7 minutes, retained at
  `/tmp/opencode/remote-chat-final-regression`.
- 316 unit passes plus one optional skip; types/lint/i18n pass. The last auth-only
  application correction also passes types/lint/build and the full Electron run.
- Latest Linux package starts successfully (`SMOKE OK`).
- Ownership, deferred-auth and bounded visual reviews retained under `.omo/evidence/`;
  16 localized originals inspected. These do not establish full design fidelity.
- `git diff --check` passes. No commit or push created in this resumption.

Observed artifact identity after verification (not a retrospective source seal):

| Artifact | SHA-256 |
| --- | --- |
| `packages/desktop/dist/main.cjs` | `c669a93132a4395cbf9b35c55e14fc2e39b7cb03e61730859c1f4078c45a2c44` |
| `packages/desktop/dist/preload.cjs` | `0c0dea24ae0345641c19ebc41af763ce8462f961a984fa530960a4b187831bb0` |
| `dist/linux-unpacked/resources/app.asar` | `d1e1d948547bfacb68009cf2aa0a694070dc41847ba5835536df149ea20b0680` |

HEAD remains `9e4c4384664c2264b3564876259712da95ce82ed`; the tested changes are in
the working tree. Earlier inherited modifications and negative evidence are retained.

## Unfinished acceptance

1. Saved-text native Download on the historical Mac package: successful Save and
   exact original-byte readback remain unproven. The user confirms the Mac remains
   shared; no exclusive foreground window is available. See
   `evidence/mac/9e4c438/native-partial-status.md`.
2. Matching installed-Mac verification of the current application changes, and
   immutable CI/package admission for them, have not been performed.
3. Real remote account/inference acceptance is not supplied by controlled fixtures.
   Fresh public discovery still returns no vision-capable Chat model and no
   `/v1/instance` endpoint. See `current-cloud-prerequisites.md`.
   The user confirmed that no eligible test backend/account/model is available.
4. The recovered objective also names Space, standalone Scheduled and Plugins &
   skills. These are not delivered by remote Chat. Their design requests and local
   contract differences remain separately tracked in `/root/cortex-ui/DESIGN-REQUESTS.md`
   (G1 requests and productivity readback); the bounded remote adoption does not
   authorize those imports. Project Rename/Archive also retains its separate request.

Publishing is likewise unfinished. A local PR-body draft exists at
`pr-handoff-draft.md`. The coordinator explicitly authorized normal commits/pushes,
then required backend staging before desktop acceptance/publication. That sequencing
gate now controls publication; it is no longer an authorization gap. Desktop must
not merge or deploy. The original PR remains separate from unpublished edits.

Publication review found that ordinary staging would omit ignored dependencies of
the historical raw-evidence manifests/verifiers. Defer that raw evidence partition,
preserving all files locally, until its complete sanitized packet has an immutable
external location or a separately approved complete publication set. Do not force-add
the evidence tree or publish partial checksum manifests. Source commits require their
new source/test files and curated documentation, not the entire historical packet.

Both external prerequisites have now been answered explicitly: the Mac remains
shared and no eligible real-inference environment is available. Neither is an
unanswered question or a pending automated result. The remaining acceptance work
cannot be replaced with additional local fixture runs.

Resume native work only with uncontested foreground access and matching package
identity. Resume real image/reasoning verification with an eligible backend/model
and usable account. Local green tests cannot substitute for either acceptance gate.
