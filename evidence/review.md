# Existing automated review comments

PR #36, CodeQL comments from 2026-10-01. This is a bounded triage of those comments,
not a complete security audit or a claim that the latest CodeQL analysis passed.

| Comment | Disposition |
| --- | --- |
| 4161619797 — client trailing slash regex | Fixed: only the first slash in a run can begin the trailing match; preserves internal slashes without quadratic retries. Large-input regression in `packages/client/test/client.test.ts`. |
| 4161619833 — skill frontmatter regex | Fixed: the value starts with a non-whitespace character, or is empty. Removes overlapping whitespace backtracking. Malformed large-input regression in `packages/core/test/services.test.ts`. |
| 4161619811 — scheduler ID randomness | Not an authentication token: `newId("session")` identifies a local SQLite conversation stored in task history. No authorization relies on unpredictability. |
| 4161619817 — prompt ID randomness | Same record ID, used for parameterized session/message lookups; sessions are listable through the same local API. No authentication role. |
| 4161619828 — child session randomness | Same record ID, returned with a child tool result for linking. No authorization role. |
| 4161619841 — HTML extraction | Best-effort text extraction for model context, not an HTML sanitizer. Tool output is persisted/model input; rendered replies use escaped React text children. A comment makes the ceiling explicit; no HTML safety claim. |
| 4161619856 / 4161619865 — test host prefix checks | Test fixture only; replaced with exact readiness URL equality. Suffix-host regressions reject both lookalike hosts. |

Targeted verification: 23 tests pass across client, services and sessions; typecheck and
lint pass with two pre-existing hooks warnings. No comments or checks were dismissed.

At `b56d2ad`, the separate CodeQL comparison check reports **neutral**: the main-branch
JavaScript/TypeScript default-setup configuration is absent from this PR comparison. This
does not establish zero open alerts. All eight existing comments received scoped replies.
