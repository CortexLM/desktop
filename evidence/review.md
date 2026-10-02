# Existing automated review comments

PR #36, CodeQL comments from 2026-10-01. This is a bounded triage of those comments,
not a complete security audit or a claim that the latest CodeQL analysis passed.

| Comment | Disposition |
| --- | --- |
| 4161619797 — client trailing slash regex | Fixed: only the first slash in a run can begin the trailing match; preserves internal slashes without quadratic retries. Large-input regression in `packages/client/test/client.test.ts`. |
| 4161619833 — skill frontmatter regex | Fixed: the value starts with a non-whitespace character, or is empty. Removes overlapping whitespace backtracking. Malformed large-input regression in `packages/core/test/services.test.ts`. |
| 4161619811 — scheduler ID randomness | Follow-up uses Web Crypto for the common ID suffix; fixed-time uniqueness/order regression disables `Math.random`. IDs remain record identifiers, not auth tokens. |
| 4161619817 — prompt ID randomness | Same common ID change. Parameterized SQLite lookups and string contracts still accept older IDs. |
| 4161619828 — child session randomness | Same common ID change; child-session tests still pass. |
| 4161619841 — HTML extraction | Removed script/style blocks now become spaces, preventing word/tag-fragment concatenation. Regression checks stored output and subsequent model input. Still best-effort model text, never an HTML sanitizer. |
| 4161619856 / 4161619865 — test host prefix checks | Test fixture only; replaced with exact readiness URL equality. Suffix-host regressions reject both lookalike hosts. |

Targeted verification: 23 tests pass across client, services and sessions; typecheck and
lint pass with two pre-existing hooks warnings. No comments or checks were dismissed.

At `a205c6e`, the separate CodeQL comparison check failed on four remaining annotations.
At `eeabbf3`, CodeQL and both analysis jobs pass; the PR merge-ref alert query returns
zero open alerts. The follow-up removes patterns without suppression; 27 targeted tests,
typecheck and lint pass.
All eight existing comments received scoped replies; none was dismissed.
The final `2a9d1ad` CodeQL check also passes with zero open PR alerts.
