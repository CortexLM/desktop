# Independent offline package review — 99e3d04

**Passed.** Archive/source provenance only; installed/native behavior remains separate.
Application `99e3d04a8dab6b51b6cf23bcdae0365624492e0f`; retained artifact metadata binds run `37124432902`, artifact `11274389994`, **144,676,973 bytes**. No CI/API/network query performed.

- Outer SHA256: `4ab14b8e8657b1620a9306833ffc291b11823c3ca4e4d9888754653fe9b676e2`.
- Inner ZIP SHA256: `3ac93b98a28db6c5ca6eaf1b9f2e8df82e06b814a74411168804bc82316746a4`.
- ASAR SHA256: `f0b5f9ee60b8170d69bdd7bc04fa636a44f3360bc90082d41437097b1c902aae`.
- Outer ZIP contains exactly the supplied inner ZIP; inner CRC checks pass. Embedded ASAR equals supplied bytes.
- All **91 ASAR files / 92 integrity blocks** verified; contiguous payload, no unindexed bytes, links or unpacked entries. Exact **90 build members + root package.json**, matching the complete frozen build set.
- Root metadata matches Git after packaging removes scripts/devDependencies: `cortex-desktop` 0.2.0, main `packages/desktop/dist/main.cjs`; identical to both prior packages.
- Resources exactly match Git: **104 catalogs, 13 × eight locales, plus `skills/summarize/SKILL.md`**. No fixture/source-stamp files or extra locale/skill resources.
- All **514 package inputs** match Git. Versus `37c22c2`, exactly three renderer files changed, **+12/−10**: Settings +8/−7, nav +3/−2, shell +1/−1.
- Settings SHA256: `4f0b4f911195eb7e5a12dc22ff9e940f0cd67190ce9eb44ae7c99d6054c80461`.
- Nav SHA256: `876682aef675ef9e0b1c5a3a59a49b00acbb1da84a7897f0dc17efa287579315`.
- Shell SHA256: `880240350484738971849dbabdfe591cd90471afc08fa0ffca02ef6f78a6ae67`.
- Complete **473 renderer inputs** independently enumerated; fingerprint `474405faaf26dba6319cb1c139f0b32ef04adf2b7e600d6edee37f72b4fabf44`.
- Main/preload, both maps and the complete CSS set are byte-identical to `37c22c2` and `f5bf305`. Main's **32 workspace + 16 SDK + 16 api-types** embedded sources match Git/original archives; preload's one workspace source also matches. Vendor archives and dependency pins remain unchanged.
- Frozen Linux package receipt matches Mac; local Linux ASAR bytes match exactly. Supplied archives/manifests, frozen build files and watched dependencies remained unchanged during review.

Receipts: `/tmp/opencode/mac-99e3d04-review/{summary.json,integrity.json,source-hashes.json,appearance.diff,verify.py}`. Run: `python3 /tmp/opencode/mac-99e3d04-review/verify.py` (hash-pinned prior offline reader reused).
Audit UTC: `2026-10-03T13:13:10Z–13:13:17Z`. Only this report and assigned scratch files written; no application, tests, build or native session executed.
