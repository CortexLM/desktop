# Persistent saved Bot memory pause

Implementation in progress after documentary `74579d5`, which preserves application
`f82a648`. Projects' passing CI/native evidence does not establish this new behavior.

The source-only [contract audit](source-contract.md) found two ineffective controls:
Settings Privacy saves a renderer preference unused by inference; Memory resets its local
switch after remount. An actual `f82a648` Electron [baseline](baseline/receipt.json)
reproduces both: Privacy false is ignored by Memory, whose own false resets on reload.
The first collector used an incorrect exact accessible name; that selector failure remains
separate from the reproduced result. All 90 baseline build members matched `f82a648`.

The [implementation contract](implementation-contract.md) uses one strict persisted engine
setting, existing controls and absent-only legacy import. Pausing preserves manual notes
and existing history; only future admitted Bot context changes. Personal cross-Chat memory
and automatic learning remain absent. Seven live keys are translated across eight locales;
[copy review](copy-review.md) records author review and native-speaker review limits.

The initial production candidate passes lint/types/i18n, **260 units plus one optional
backend skip**, 14 targeted Electron cases and **124 full cases / 426 render visits**.
Eight locales cover 64 live text states. Linux package/smoke matches 90 build members,
516 inputs and renderer fingerprint
`30ec7f97fb1de75ba4dc66fa81a4dfba0e76cd16008bfa53600d7ca512b810fb`.

[Renderer review](initial-renderer-review.md) identified a further canceled-preview
navigation race outside those tests. A new case reproduces two failures: stranded loading
after GET, and a checked/disabled switch after an accepted false PUT. The single-hook
actual-boundary correction passes the unchanged case inside **21 targeted cases**,
including existing navigation and Memory safety checks. Both baseline failures remain in
[navigation evidence](navigation/summary.json); the earlier green candidate keeps its scope.

The corrected Linux package/smoke binds 90 members/516 inputs and renderer
`64a314be9950c61466f8beec1b1ef50aa7f5b60a7f67d67bc3deff805a5800ef`.
The coordinator inspected all 26 targeted-image contacts plus four full-size views;
[lossless images](targeted-images/index.json) retain exact pixel identity. Final full-suite,
**125/125 cases / 426 render visits**, passes in 293.095 seconds, zero retries/skips/flaky
outcomes. CI, independent image audit and matching installed checks remain pending.
