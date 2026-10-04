# Independent CI receipt — 37080136101

**All three jobs SUCCESS verified.** [Run 37080136101](https://github.com/CortexLM/desktop/actions/runs/37080136101), attempt 1, completed 2026-10-03 00:09:22 UTC.
- Head `f9aca44476fcebd0699c09c9e3f7eebcd5151a2a`; all checkout logs and both E2E reports pin merge `133195d3603738846b1b555dae4bf3c9292df113`.
- GitHub head/merge trees equal `b8ba829d4685ae4f7e05105fc14da1ff9503ec23`; base parent `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d`.
- Recomputed **473-file** committed renderer fingerprint `5f709c11d836948142b65c5c2b4fe0582bddbfc19f76dbe15cf6d2146a6bcf0f`, matching corrected comparison provenance. All source/test/script pins use `git show f9aca44`; no current-working-tree claim.

## Results
| Job | Evidence |
|---|---|
| Checks `111078626355` | Lint/types pass; **178 unit passes + 1 optional backend skip**, 16 files; i18n **63 files / 2,267 used / 3,395 English / 0 problems** |
| Linux `111078626108` | **70/70**, 70 attempts, **426 renders**, 4 workers; zero retries/flaky/skips/errors |
| macOS `111078626232` | **70/70**, 70 attempts, **426 renders**, 1 worker; zero retries/flaky/skips/errors; unsigned arm64 package + smoke pass |
- Each platform ran six Work-conversion cases, three Search cases, four existing routine cases, two native chrome/menu cases and one reduced-motion case.
- Source Bot-list P2 recovery now has passing runtime coverage on both OSes: disabled Create during unavailable list/held retry, editable retained draft, correct Bot/context on accepted Create.
- Optional unit skip is gated by `CORTEX_TEST_BACKEND_URL`. Standalone i18n audit ran successfully. The 426 render/copy checks do not establish pixel fidelity.

## Actual image inspection
- Opened **19 current 960×640 macOS captures**: eleven Work conversion, two Search, six existing routine regressions; plus **1440×900 packaged smoke**. Full PNG hashes/member paths recorded in receipt; all 19 match their attachment and HTML-report copies byte-for-byte.
- Search: readable name/persona matches, accent highlighting, grouped Chat/Bot results, selected keyboard row in both themes.
- Work/editor: request and task-options visible; Bot B selected; source prompt retained. List failure shows disabled Create and localized Retry. Missing/file-dependent sources show neutral failure and disabled Create.
- Routine success/Running/Failed history rows fully painted; refusal feedback readable. Long names/table cells wrap; narrow name input clips horizontally. **No scoped visual blocker found.**
- Smoke image shows populated local empty-state shell, “No model”; log records `window: Cortex cortex://app/index.html` and `SMOKE OK`.
- **Native CI pixel limit retained:** `screencapture -x out/smoke-screen.png` failed “could not create image from display”; file absent. Chrome/menu API assertions pass; attach no native snapshots. Installed matching-artifact verification remains coordinator-owned.
- Sole actual `.ips` read: simulated **Setup Assistant**, **2026-03-16 08:32:43 -0700**, system executable. SHA-256 `384ea4db6324dc5b8ab6a0fd5a4594b620e76ec694e0f0bb75495595824f90dd`; historical system incident, no Cortex crash file.

## Package/member identity
- Reused supplied package; **144,905,920 bytes**, **697 ZIP entries**. ZIP SHA-256 `3e63619e9a16589e396eba1f7b2fb10c92010adfa42ad6d032a5ab7bfa21b9fe`.
- ASAR **28,191,344 bytes**, **91 files**, SHA-256 `23decdd0596b89e8e83284b62f6e7f0eb5314b081ccf178f7dde31c8ac04af77`.
- All **90 embedded build members** match `/tmp/opencode/live-actions-build-members.json` exactly (**88 excluding maps**); supplied manifest SHA-256 `1d70f57096b2757b33f01a32a787741164793f85f088e34ba8d5f4b44d3386f5`.
- API/upload-log outer digests: macOS `3ca78489dde269debdaba4b73d69bfe9249342e263459aec26d6135bd5d93e36`; Linux `80b40f13b05211c963449dc6b2cd928e9e0c8838713df0989857499dd616c913`; package wrapper `b56325cb665e197d5d9274f98f42cdedf97f664e3fad304fff5eb0686bbfa9d3`.

## Deliverables and limits
- `/tmp/opencode/live-actions-ci-review/receipt.json`: machine receipt, image hashes, source/job pins, exact outcomes and limits.
- SHA-pinned inventories cover **227 Linux files**, **231 macOS files**, every package ZIP/ASAR member, 473 source files; checksum list `/tmp/opencode/live-actions-ci-review/SHA256SUMS`.
- Read-only receipt assertions passed. No app tests/builds/Mac/owner actions; Linux artifact downloaded once, existing Mac/package reused.
- Earlier failed/canceled CI and negative source-review evidence remain separate. **Whole product objective incomplete:** remote integration, missing surfaces, full visual/native acceptance outside this receipt.
