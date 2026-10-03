# Recent Bot outcomes in Work Activity

Implementation in progress after documentary `906987b`, whose application inputs remain
`96df66c`. Memory's accepted tests/native package do not establish this new behavior.

The existing live Activity screen always renders its empty state. The bounded delivery
uses existing local session/Bot/history APIs and the incumbent timeline. It selects up to
40 recently updated root Bot conversations, then the last persisted finished assistant
turn from each. A later unfinished turn does not erase an earlier outcome. Completion,
failure and interruption describe those historical turns, not task fulfillment.

Bot identity is exact; absent metadata is unavailable, not evidence of deletion. Source
failures offer Retry. Rows open the existing task by session ID. No transcript text, tool
output or raw error message is part of the feed. Full Inbox and notification read/handled
lifecycles remain separate delivery work.

Seven live keys are authored across eight locales; existing values remain unchanged.
Locale parity passes all nine cases. A baseline on the exact `96df66c` production build fails at the
first missing scope label; later geometry/populated states were not reached. Review then
strengthened text geometry to include clipping inside descendant spans. That earlier
test source/failure stays distinct from the corrected test definition.

Six behavior cases fail on the previous production build: five at absent populated rows,
one at absent source-error recovery. Real engine fixtures reach persisted outcomes before
those row assertions. Later identity/restart/race assertions remain unexecuted in this
baseline. Its frozen test source and individual failure scopes are retained under `baseline/`.

The production renderer passes locale geometry and four initial behavior cases. Two
lifecycle cases initially fail because the test captures `innerText` then compares default
`textContent`; three explicit `useInnerText: true` options preserve exact comparison and
both cases pass. Independent review additionally strengthens unfiltered deletion checks
and tracks an Activity-owned header during canceled navigation; that case passes on the
same app bytes. Initial failed/less-complete test definitions stay retained.

Lint/types/i18n, 260 units plus one optional skip and Linux package/smoke pass. The frozen
candidate has 517 package inputs/90 build members, renderer fingerprint
`a4a815bac24ce5f509f813d06371b8a754908b4b472c3d786f1325dbed53b8df`.
Full regression passes **132 cases / 426 render visits** in 294.849 seconds, zero retries,
skips or flaky outcomes. Its archived `5740841a…` behavior-test version predates the two
stronger race assertions and exact-query hold. A separate final **6/6** pass in 7.286 seconds
binds those stronger tests (`d98c9205…`) to the same application. Locale geometry remains
`bfda7f43…`, with all 112 measurements passing.

[Renderer review](renderer-review.md) and [final test review](e2e-accepted.md) approve
their source/receipt scopes. Independent image/comparison audits, CI and matching native
verification remain pending. No final Activity acceptance claimed.

Implementation details and limits: [contract](implementation-contract.md),
[independent correction](contract-review.md), [copy review](copy-review.md),
[locale-test review](locale-test-review.md). The source contract's earlier last-message
proposal is superseded by the reviewed latest-finished-turn contract.
