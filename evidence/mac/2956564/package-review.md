# 2956564 — independent offline package audit

**Bounded approval: package/source provenance verified; no discrepancy found.**
- Application and retained API workflow head: `2956564fbe31f882014d74ff3a7f920e839fd634`.
- Artifact **11271217895**, workflow **37113961621**, **144,676,976 bytes**; recomputed outer size/digest match `/tmp/opencode/mac-2956564/artifact.json`.
- Outer ZIP SHA-256: `e985229999bc066da6d356c3aed32caeb96ce0593c6a33db37218b4b86405193`.
- Inner ZIP SHA-256: `f53412e11bcd1d3c9a74a7a3e078979ed5e904555e2becd62f9d09d417bb1636`; outer's sole `Cortex-0.2.0-arm64-mac.zip` member equals retained `Cortex.zip` bytes.
- ASAR SHA-256: `de7b30a5eedc416a1e1b35756e268fc7028f70908564e15b3ef4df9ec9c94d6e`; inner ZIP member equals retained ASAR and actual local Linux ASAR byte-for-byte.
- Complete ASAR file set: **90/90 build members + root package.json**, no extras/missing files; **91/91** entries carry passing file/block integrity. All 90 hashes and paths match package/member receipts and frozen `/tmp/opencode/build-terminal-state-final` files.
- Resources: exact **104 catalogs (13 × eight locales) + one summarize skill**; all **105** hashes match Git. Git-derived catalog set agrees; no locale fixtures or `.source.json` stamps, no extra locale/skill files.
- **514/514 package inputs** match Git `2956564`; same path set as `760c4a0`, **512 unchanged**. Only changed inputs: `packages/app/src/screens/chat/live-chat.tsx`, `packages/app/src/screens/code/code.tsx`.
- Final Chat SHA-256 `c70919bb1dd6167f1bd32c4618a11e59aa79df7a7c5484a9adbf7810b79e0a6e`; Code `51c76d03b98da536bc84d8e010a22115ca1df1d215df2723fab9224d0a1db225`.
- **473/473 renderer inputs** match the Git-derived file set and package-input subset. Sorted `path:SHA256` lines, no trailing newline, recompute fingerprint `e288e023805e998f276b224f10f63a5b448082d7a31174020b943f70815c028e`.
- Main/preload and both maps: **4/4 byte-identical to 760c4a0 and f5bf305**; root packaged metadata also identical. Existing main-process SDK/auth boundary has no package delta.
- Embedded maps: **32/32 main workspace + 1/1 preload sources** match all three Git revisions; **16/16 SDK + 16/16 API-types sources** equal original archive member bytes.
- Main map: **980 entries** = 32 workspace + 16 SDK + 16 API-types + one synthetic `<define:import.meta.env>` + 915 other dependencies. Synthetic/other dependency sources remain outside the scoped Git/archive comparison.
- SDK **0.3.5** archive SHA-256 `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8`; API-types **0.2.0** `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877`. Archive bytes, lockfile and desktop dependency manifest equal 760c4a0/f5bf305.
- Frozen Linux-package receipt matches revision, ASAR, all 90 members and 105 resources. All watched archives, metadata, input receipts, helper and frozen build hashes remained stable before/after.
- Offline verifier passed at **2026-10-03 10:00:00 UTC**: `PYTHONDONTWRITEBYTECODE=1 python3 /tmp/opencode/mac-2956564-review/verify.py`. Existing independent ASAR/hash readers reused.
- Compact `summary.json`, `source-hashes.json`, `integrity.json` and report receipt retained in `/tmp/opencode/mac-2956564-review/`; no full asset/archive copies.
- Scope: retained source/build pairing plus independent archive/Git checks, not build reproduction. No installed/native runtime or CI-image approval; no downloads/network, CI query, Mac, build/test, application edits, commit or delegation.
