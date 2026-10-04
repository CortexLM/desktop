# Bot route ownership — retained Electron negative baseline

**Two intended failed cases, light/dark; six ownership assertions per case.** Both
reach the actual wrong-session write. Final run: **12 intended assertion failures**,
zero setup failures, retries, skips, flaky cases, page/console errors or renderer HTTP
requests. Started **2026-10-03 08:13:37.086 UTC**; runner41.227s, harness42.139s, exit1.

## Runtime and source pins

This run uses **unchanged `f5bf305` main/preload with the initial uncommitted fixed-hook
renderer**, while `BotPageLive` is still unkeyed. It is not a run of the original
`f5bf305` renderer: neither `f5bf305` nor documentary HEAD `1076c25` contains the new hook.

- [Exact test](source/bot-owner.spec.ts),145 lines, SHA-256
  `21af3392fad947945861063d93625d6115675f288ff43273568ea1fe4c50cdff`.
- [Unkeyed Bot source](source/bot.1076c25.tsx), extracted from Git `1076c25`, is
  byte-identical to `f5bf305` and the recorded run source. SHA-256
  `e721403221a1103b20752f91dffb4512ca021d629d57d3be3fd8153109105969`.
- [Initial candidate hook](../electron-initial/source/live.initial.ts), SHA-256
  `fde8193d44f8e943915b18a5b3dc074ef048dc1f37cd580f25db1f2bfab6ed34`.
  The [older committed hook](../baseline/source/live.f5bf305.ts) is separately retained.
- [Initial build manifest](../integrated/source-build-initial.json): all **90** members
  matched before/after this negative run, with no missing/unlisted members.
  [Renderer inputs](../integrated/renderer-inputs-initial.json):473 files, fingerprint
  `cc5192cbaaf1f5ac8e5b12ee00ac5b41089ff93d8fe1276eb22d2431a1c3afe2`.
- Main/preload and both source maps match the earlier
  [foundation build](../../remote-chat-foundation/integrated/build-final.json) and
  [application pin](../../remote-chat-foundation/integrated/application-pin.json).
  Main SHA-256: `f0fc4522cde726dd8b88dcbb56f4116ba93dc87e1e9e29163502d25e522512c7`.

[Provenance](provenance.json) records full revisions, Git blobs, source hashes, four
unchanged desktop members and hashed relative references. These are historical
run-manifest comparisons; retention does not inspect or rebuild current dist.

## Actual sequence and failures

The real IPC bridge creates two Bots. Beta already has a persisted turn; Alpha starts
empty. Sending Alpha's first request through its actual Composer creates/selects its
session. Clicking Beta changes the route/title.

Main's original `cortex:fetch` callback computes a real200 response for
`GET /api/bots/{beta}/sessions`. The test holds its return, preserving its exact body
and headers; other IPC and real SSE continue. **Each held response contains one Beta
session**, not fabricated rows. Both Bots/session identities are retained per case.

After release, a real health IPC plus a microtask/two animation frames fence the
observation. The test sends a follow-up through Beta's displayed Composer and reads
both persisted histories. Soft ownership assertions keep execution going through the
write proof; all failures still fail the test.

| Assertion, exact test line | Actual result in both themes |
| --- | --- |
|111, empty transcript while held| Alpha's user and assistant remain under Beta |
|116, Beta history after release| Alpha persists throughout the normal15-second assertion window |
|130, no transient Alpha history under Beta| DOM observer records the wrong history |
|131, Beta Composer request destination| Actual POST path names Alpha's exact session ID |
|132, Beta receives its follow-up| Beta remains `["Beta saved request"]` |
|133, Alpha unchanged| Alpha becomes `["Alpha first request", "Intended for Beta after navigation"]` |

Actual wrong POSTs:

```text
light /api/sessions/ses_01a100d372f700003d7ad7d7dd73d1b1/prompt
dark  /api/sessions/ses_01a100d3c32d00008aec3a457fdadbdb/prompt
```

Those IDs map to Alpha in [case assertions](cases.jsonl). Expected Beta IDs, exact
barrier response, both full message histories, write path and all11 DOM observations
per theme are in compact [light](traces/light.json) / [dark](traces/dark.json) traces.
The parsed values exactly match the original inline attachments.

Real SSE fed the UI, but this regression did **not** record a per-event SSE ledger.
The retained traces establish DOM/IPC/storage behavior, not an invented event replay.
Provider model/fixture-key authorization checks passed for all three requests per case.

## Raw results and checks

- [Run command](run-command.json), [receipt](receipt.json), [summary](summary.json).
- Original [Playwright JSON](raw/results.json.gz) and [runner log](raw/run.log.gz)
  decompress byte-for-byte to the supplied originals.
- [Integrity receipt](raw/integrity.json.gz) retains the identical before/after bytes
  once. [Retention hashes](raw/retention.json) bind both original paths and verified
  gzip round-trips, including the preliminary failures below.
- [Scoped checks](checks/checks.json): ESLint and strict TypeScript pass. Whitespace
  check has no diagnostics; `git diff --no-index` exit1 denotes the added file.
- [Runner source](source/run.py) preserves the original negative harness; its input
  manifest deliberately pins this initial-correction build.

Node22.23.3, `NODE_ENV=test`, `CORTEX_RENDERER_URL` unset; actual Electron loads
`cortex://app`, uses native IPC and real SQLite/session producers with the existing
fixture HTTP provider. No fabricated history/events, arbitrary sleeps or expected-failure
annotation. Auxiliary Playwright trace/error-context paths and hashes are mapped in
[references](references.json); their originals remain at their recorded temporary paths.

## Full-size image review

All six canonical images remain **960×640 lossless WebP**. Each was decoded to RGBA
and compared byte-for-byte with its original PNG, then inspected individually at full
size. No resizing, color adjustment, masking or pixel tolerance in canonical images.

| Theme | Held | Released | After follow-up | Observation |
| --- | --- | --- | --- | --- |
|Light|[image](images/light-held.webp)|[image](images/light-released.webp)|[image](images/light-postsend.webp)| Beta title/placeholder displays Alpha's request; follow-up joins that wrong transcript |
|Dark|[image](images/dark-held.webp)|[image](images/dark-released.webp)|[image](images/dark-postsend.webp)| Same ownership contradiction |

[Image manifest](images.jsonl) records original/retained/RGBA hashes. Original six PNGs:
385,644 bytes; full-size WebPs:186,574 bytes. Automatic failure shots and attachment
duplicates map to the same canonical pixels through [references](references.json).
The [contact sheet](contact.webp), also inspected, is a labeled half-size navigation
derivative; resampling/lossy encoding are explicit in [contact metadata](contact.json).

These are **actual Linux Electron content captures**, not OS-window chrome, installed
Mac or cross-platform acceptance evidence.

## Preliminary setup failures, separate from intended counts

The initial attempt stopped both cases at HTTP400 because the fixture call omitted
the required empty JSON body for Bot session creation. The same initial source had
TS2339 because a helper named `history` shadowed browser history in the callback.

Retained [initial source](setup/bot-owner.spec.ts), [command](setup/run-command.json),
[raw report](setup/results.json.gz), [log](setup/run.log.gz),
[TypeScript diagnostic](setup/types.log.gz) and [check receipt](setup/checks.json).
These two setup failures are **not** counted among the two intended negative cases.
Final source passes checks and reaches the real wrong-write step in both themes.

The [earlier browser review](../review/README.md),
[original browser probe](../review/bot-owner.test.ts) and
[browser observations](../review/bot-owner-observation.json) remain separately scoped.

`SHA256SUMS` covers this retained package. Retention ran no application tests/builds,
Mac/CI actions or commits. Production and permanent test files were not edited;
the coordinator owns the later live-page key and unchanged-test positive run.
