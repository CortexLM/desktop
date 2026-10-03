# Independent offline package review — 37c22c2

**Passed.** Archive/source provenance only; no installed-app or native-behavior claim.
Application `37c22c2fcff92fb76b10ffc97ec0643ac325d62f`; retained artifact metadata binds run `37118586276`, artifact `11272761294`, **144,676,511 bytes**. No CI/network query performed.

- Outer SHA256: `401e565fc214b2958e7115e82dd28beef7abe08c2635ce440c5664c87482ed69`.
- Inner ZIP SHA256: `216d6a52fe0ed3b3c3b2beddcfb75262f23ef8fdcdc9ec452a74f0d07c999395`.
- ASAR SHA256: `d1e6987ac728723b5c9b1132aa532fc63c3db55d863c9b264c48fdc631eea1f7`.
- Outer ZIP contains exactly the supplied inner ZIP. Inner CRC checks pass; embedded ASAR equals supplied bytes.
- All **91 ASAR files / 92 integrity blocks** verified; contiguous payload, no unindexed bytes, links or unpacked entries. Exact **90 build members + root package.json**, matching the complete frozen build set.
- Root metadata matches Git with packaging-only removal of scripts/devDependencies: `cortex-desktop` 0.2.0, main `packages/desktop/dist/main.cjs`; byte-identical to both prior packages.
- Resources exactly match Git: **104 catalogs, 13 × eight locales, plus `skills/summarize/SKILL.md`**. No fixture/source-stamp files or extra locale/skill resources.
- All **514 package inputs** match Git; comparison with `2956564` changes only `packages/app/src/screens/system/settings.tsx`, **three additions / three removals**.
- Settings SHA256: `b859cf9785ada768307e77a2546c02b80576b1491187b6ffa944c1673432eed6`.
- Complete **473 renderer inputs** independently enumerated; fingerprint `5538c5298dbad432d82cf18781b9f7e62b5a861311ad61c6fc518c0cdb6e1ae7`.
- Main/preload plus both maps are byte-identical to `2956564` and `f5bf305`. Main's **32 workspace + 16 SDK + 16 api-types** sources match Git/original tarballs; preload's one workspace source also matches. Both original vendor archives and dependency pins are unchanged.
- Frozen Linux receipt matches Mac; local Linux ASAR bytes also match exactly. Supplied archives, manifests, frozen build files and watched dependencies remained unchanged during review.

Receipts/verifier: `/tmp/opencode/mac-37c22c2-review/{summary.json,integrity.json,source-hashes.json,settings.diff,verify.py}`. Run: `python3 /tmp/opencode/mac-37c22c2-review/verify.py`.
Audit UTC: `2026-10-03T11:25:19Z–11:25:26Z`. This review changed only this report and its assigned scratch directory; native checks remain separate.
