# Deleted Chat — negative Electron baseline

**2 failed cases; 4 intended copy assertions; 0 setup failures.** English light/dark,
960×640. Both complete real history, delete through the actual IPC bridge, then reload
the deleted Chat. This receipt proves the pre-fix defect only.

| Case | Duration | Failures | Other asserted behavior |
| --- | --- | --- | --- |
| Light | 2.853s | Missing-page copy; forbidden retained-message claim | Pass |
| Dark | 2.874s | Missing-page copy; forbidden retained-message claim | Pass |

Each case returns real **404 `not_found`** for session and messages GETs. Stored
history existed before deletion; deleted transcript and session list are empty
afterward. No Retry button. Existing **New chat** opens Home with an empty editable
composer, no alert or recreated session. Exactly **one** controlled HTTP provider
request per case; `reasoner` model and dummy authorization assertions pass. Zero
captured page/console errors or renderer HTTP requests.

The only failures are test lines **55–56**, preserved in the raw report:

- Expected `shell.notFound.title/body`: **“Page not found” / “This link goes nowhere,
  or the page has moved.”** Actual: **“Something went wrong.” / “Your message is kept.
  Try again in a moment.”**
- That retained-message claim must be absent; it is present.

`expect.soft` lets recovery assertions finish; both copy assertions still fail.
No `test.fail`, skips, retries or weakened assertions. Playwright correctly reports
**2 unexpected failures**, exit **1**; “negative baseline reproduced” is not a green
suite. One executed attempt, no preliminary setup failure. Runner **7.110526s**;
case total **5.727s**. No corrected-build result is contained here.

## Exact provenance

- Application: `760c4a046ce454bc8b0ab2fd85c941fec321c3ea`.
- Documentary HEAD at execution: `72d2926b284760d96462cc931777761eedf9e3c1`.
- Started: `2026-10-03T09:25:12.377Z`; Linux Electron/Xvfb, Node `v22.23.3`.
- Executed [test snapshot](./source/chat-missing.spec.ts), SHA-256:
  `a9bdc8e86f3ede94f0b54dc6a5d8b45142a62b98ad9fd0af2515c96bddb3d994`.
- Original [Chat source](./source/live-chat.760c4a0.tsx), SHA-256:
  `2a1c72aed2b979797be67d6f37612726a7d086e7a902ab5423d8d9026dc299ab`.
- [Source pins](./source-pins.json) give the other original import hashes and immutable
  Git links. The retained snapshots come from the executed baseline, not current files.
- Frozen build: `/tmp/opencode/build-live-state-final`; historical before/after receipts
  match **all 90 members**, with identical source hashes. Those two byte-identical
  receipts share [one gzip](./raw/integrity.json.gz). Current source/dist was not read
  during retention; this is no attestation of a later build.

Exact command, working directory, environment and source pins:
[run-command.json](./run-command.json). `CORTEX_RENDERER_URL` was unset.

```sh
NODE_ENV=test TMPDIR=/tmp/opencode/chat-missing-regression/baseline/temp \
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/opencode/chat-missing-regression/baseline/results.json \
xvfb-run -a -s '-screen 0 1280x900x24' \
  /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  node_modules/@playwright/test/cli.js test tests/e2e/chat-missing.spec.ts \
  --workers=1 --retries=0 --reporter=list,json \
  --output=/tmp/opencode/chat-missing-regression/baseline/artifacts
```

## Retained evidence

- [Original report](./raw/results.json.gz), [original log](./raw/run.log.gz): exact
  gzip round-trips. [Retention receipt](./retention.json) records raw/compressed hashes.
- [Summary](./summary.json), [two case records](./cases.jsonl), complete parsed original
  attachments: [light](./evidence/light.json), [dark](./evidence/dark.json). Provider-count
  and recovery checks are corroborated by the executed hard assertions and absence of
  additional failures, not invented response fields.
- Incorrect-card captures: [light](./images/deleted-chat-light.webp),
  [dark](./images/deleted-chat-dark.webp). Both reviewed at full **960×640**; lossless WebP
  decoding is **RGBA-byte-identical** to the original named `deleted-chat-card` PNGs.
  [Image hashes](./images.jsonl) retain PNG, WebP and decoded-RGBA provenance.
- [Core count receipt](./core-counts.json): copied earlier read-only SQL results,
  **0 session/message/part rows**, 14 event rows per case. Databases, credentials and
  renderer profiles are excluded; no SQL was rerun during retention.
- [Reference map](./references.json) resolves original report attachments. Automatic
  failure screenshots show the later recovered Home; they and traces are omitted.
  The original report paths remain unchanged. Original temporary artifacts remain intact.
- [SHA256SUMS](./SHA256SUMS) covers every retained file except itself. Verify from this
  directory with `sha256sum -c SHA256SUMS`.

Scope: original English deleted-Chat behavior only. Retention runs no app, tests,
build, CI, Mac session or network; it supplies no corrected or all-locale acceptance.
