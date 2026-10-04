# Recent Bot outcomes in Work Activity

Application `9ba8e59fbec8c1f38f93ace25414d4a3489aede3` is pushed;
[CI 37145831654](https://github.com/CortexLM/desktop/actions/runs/37145831654) passes all
three jobs. [Independent artifact review](ci-9ba8e59/README.md) verifies 132 cases/426
render visits per OS, 364 images/24 full-size Activity targets and 112 locale measurements
per OS. Both complete CI suites execute the final strengthened behavior test.
[Later commit binding](production/application-pin.json) verifies all 517 tested inputs.
Original dirty-base `906987b` receipts remain; Memory's earlier tests/native package do
not establish this new behavior.
Documentary closure `d390cce` also passes [CI 37148540261](https://github.com/CortexLM/desktop/actions/runs/37148540261).
All 517 committed package inputs remain identical to `9ba8e59`; subsequent uncommitted
Files work is outside those receipts. [Documentary status](documentary-ci.json).

The previous live Activity screen always rendered its empty state. This bounded delivery
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
their source/receipt scopes. [Independent preview comparison](compare/README.md) accepts
22 references/zero gaps; maximum 0.037230% retains historical residuals. Activity event
text/icons/times and Done transcript regions match the frozen reference exactly.
[Independent local image audit](electron-local/README.md) accepts 185 unique images,
16 full-size Activity originals and all 517 source inputs/90 build members.
[Matching installed checks](../mac/9ba8e59/README.md) pass four native captures,
twenty targets, keyboard filters and exact Work links in both OS themes at 960×640.
Flow: 75.516 seconds; total with eleven cleanup checks: 78.716 seconds. Three local
fixture turns; original appearance restored and Mac lease released.
All sixteen Memory locale frames and sixteen auth-locale frames match `96df66c` exactly.
Native CI display capture still fails with unknown cause; installed captures remain a
separate proof. [Independent installed-native review](../mac/9ba8e59/native-audit/README.md)
accepts the bounded four-image scope. Its fixture uses existing mascot color/eye fallbacks;
custom appearance fidelity is not claimed by that run.

[External-owner readback](owner-readback/REPORT.md) at 19:24:38 UTC finds no new
SDK successor, backend contract/deployment handoff or five-state G1 import permission.
Public instance discovery remains 404; no listed Chat model declares both vision and
reasoning. Local delivery proceeds separately.

Implementation details and limits: [contract](implementation-contract.md),
[independent correction](contract-review.md), [copy review](copy-review.md),
[locale-test review](locale-test-review.md). The source contract's earlier last-message
proposal is superseded by the reviewed latest-finished-turn contract.
