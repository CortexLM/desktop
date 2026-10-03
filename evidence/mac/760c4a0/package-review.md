# 760c4a0 — independent offline package audit

**Bounded approval: package/source provenance verified; no discrepancy found.**
- Application and retained API workflow head: `760c4a046ce454bc8b0ab2fd85c941fec321c3ea`.
- Artifact **11269856853**, workflow **37110253688**, **144,676,546 bytes**; local metadata equals [retained receipt](artifact.json).
- Outer ZIP SHA-256: `257fb7b54e362efae0a7c053183955fd6362228338c0a203874778d4b3d5e1df`; recomputed digest/size equal API receipt.
- Inner ZIP SHA-256: `18ea195504813772757cbf11e6c0a239cbaad3d671a1e67ba197ae9fcf0fc6c7`; outer member equals retained `Cortex.zip` bytes.
- ASAR SHA-256: `bbd6dbddd5103e63d076f0edfd8afe245da1c5b858fc4883d9bd06cc70bcfc0a`; ZIP member equals retained ASAR and frozen Linux-package receipt.
- Complete ASAR set: **90/90 build members + root package.json**, no extras/missing entries; member/block integrity passes, all 90 equal frozen `/tmp/opencode/build-live-state-final` bytes and both [member](members.json)/[package](package.json) receipts.
- Resources: **104 catalogs, 13 × eight locales, plus one summarize skill**; exact set and all **105** hashes match Git. No locale fixtures or `.source.json` stamps packaged.
- **514/514 package inputs** match application Git; same path set as f5bf305, **512 unchanged**.
- **473/473 renderer inputs** match Git; comparator fingerprint recomputes `39a06106e8d3545e1131ed64dddf5c60013581ffb2f1465f5c67399892669609` using sorted `path:SHA256` lines without trailing newline.
- Only changed package inputs versus f5bf305: `packages/app/src/state/live.ts`, `packages/app/src/screens/bots/bot.tsx`; no unexplained drift.
- Main/preload and both maps: **4/4 byte-identical to f5bf305**; root packaged metadata also unchanged.
- Embedded maps: **32/32 main workspace + 1/1 preload sources** match Git; **16/16 SDK + 16/16 API-types sources** match immutable archives.
- Main map has **980 entries**: 32 workspace, 16 SDK, 16 API-types, one synthetic `<define:import.meta.env>`, 915 other dependencies. Synthetic/other dependencies are outside the scoped Git/archive-source claim.
- SDK **0.3.5** SHA-256 `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8`; API-types **0.2.0** `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877`. Both archives, lockfile and desktop dependency manifest unchanged from f5bf305; main-only SDK/auth boundary unchanged, no public remote-service caller introduced.
- Offline verifier passed: `PYTHONDONTWRITEBYTECODE=1 python3 /tmp/opencode/mac-760c4a0-review/verify.py`; exact hashes/maps/resources retained there in `summary.json`, `sources.json`, `integrity.json`. Existing independent ASAR/hash readers reused; no asset copies.
- Scope: frozen source/build receipts plus independent archive/Git checks, not build reproduction. No native runtime, installed state, secret-isolation runtime or CI-image approval; no network, Mac, build/test, CI query or commit performed.
