# Saved text — locale copy delivery
Base HEAD: `f2c1bc828d2eb64fbe0792031c2e33de63c54957`.
English source SHA-256: `f17f623e6f6b31eb7872837480d24f72a877eed7a88650cbb2e040bb22cd0758`.
Derived delta: **22 `text.*` keys × seven locales = 154 added values**.
Only `packages/i18n/locales/{fr,es,de,ja,zh-Hans,pt-BR,ko}/files.json` edited, using patches.
All 290 existing values per locale remain UTF-8 byte-equal to HEAD; removing new lines reproduces each original file exactly.
JSON parses without duplicate keys; added key sets exactly match English; placeholder multiplicities match, including `{count}`.
Existing Chat terminology preserved; UTF-8/BOM labels retained; 5 MB and 50,000-line limits localized with literal numbers.
Very-long-line caveat translated plainly; no UTF-16 jargon, HTML capability claims or new vendor labels.
`NODE_ENV=test bun run test -- tests/unit/locales.test.ts` executed once: **9 tests / one file passed**, 520 ms.
Scoped `git diff --check` passed. English source unchanged during validation.
Author translation/source checks only; no independent native-speaker acceptance or runtime UI claim. No commit.

## Final SHA-256 — `packages/i18n/locales/<locale>/files.json`
| Locale | SHA-256 |
| --- | --- |
| fr | `04a130b66553a6eb9a10a3a422308e3ef6b4040b4292531c37dabef16a8dc20f` |
| es | `e255ebee043e55e118c5a288bac05c9cff9144ca5bc4ea81adff665ed41024e7` |
| de | `6bf9a7ce1147b5ebd60ebd83b0417f0c1b6f2f87a95e78516a3ed3b062d0e4a4` |
| ja | `d407c141a357b2983ed548ac477dc2de31db7a3d9586cd1d5e66fc78eb6d749a` |
| zh-Hans | `98269c28636b1b2f6647774385f09fb80bd19a354bfd260dd10638575b515d17` |
| pt-BR | `056bda648bd88fde1ce81e04de5d1138a08c3f9451954049e4d3b3225bdd3422` |
| ko | `71047b3a046ec01a570ad7730f55306e1d6a3889f93c36237a6974d50c3ee15b` |
