# Independent offline package review — f82a648

**Approved for installation.** Offline archive/source admission passes; installed/native
verification remains separate. Application `f82a64800c0fffd6ebaa99e571a8af0fa4307095`;
retained metadata binds run `37132419774`, artifact `11277523097`, **144,684,376 bytes**.
No CI/API/network query performed.

- Outer SHA256: `59ce110f29a436c1f8369231975d5477b28ffa9427d65b2702d04fe2ee150141`.
- Inner ZIP SHA256: `0ee37b1a202c7b900310ea7ad1b0b67ef68d58b0709c9581398679677af9e3fa`.
- ASAR SHA256: `a6d3c4f59d10b3d3fd16e7309441ebb6aff1dd670e11ff06a57362eca805f422`.
- Both ZIP CRC checks pass. Outer ZIP contains exactly the supplied inner ZIP; embedded ASAR equals supplied bytes. Inner ZIP has 697 unique entries; all 14 framework symlinks resolve inside the bundle to existing members.
- All **91 ASAR files / 92 integrity blocks** verified; contiguous offsets and complete payload, no gaps, overlaps, unindexed bytes, links or unpacked entries. Exact **90 frozen build members + root package.json**; independently enumerated frozen files match the complete archive set.
- Root metadata matches Git after packaging removes scripts/devDependencies: `cortex-desktop` 0.2.0, main `packages/desktop/dist/main.cjs`; byte-identical to `8e3fd79`.
- Resources exactly match Git: **104 catalogs, 13 × eight locales, plus `skills/summarize/SKILL.md`**. No fixture/source-stamp files or extra locale/skill resources.
- All **515 package inputs** match Git; complete package and **473 renderer input** path sets independently enumerated from the exact Git tree. Renderer fingerprint: `2230ff6f2deeee6b9d2b7eff21e96f152c193e15dfa824080721b3d1853d4464` (`sha256` of sorted `path:sha256` rows joined with LF, no trailing LF).
- Relative to `8e3fd79`, exactly **two package-input CSS files change, +4/−2**: `packages/app/src/kit/styles.css` +2/−2; `packages/app/src/screens/system/system.css` +2/−0. Two existing compiled rules change; two rules are added. Reversing those four exact rules restores the entire previous CSS byte-for-byte.
- Compiled CSS becomes `index-BI2hVXPN.css`, **205,538 bytes**, SHA256 `6531efe4f5e496773b489657e19d46ccc4b7e355cd39b5ea1cbd997b8de16e48`.
- Renderer JS becomes `index-ddbTF0D4.js` but remains **byte-identical** to prior `index-Cvqb1vYV.js`: **2,461,373 bytes**, SHA256 `e0527034c7c35a2ccf680bb750d156cf0511f4edc20ece0e21a1a453bf31309d`. Production React `bundleType:0` and minified-error markers present; checked development/act diagnostics absent.
- `index.html` changes only the two CSS/JS asset references. All **88 other same-path ASAR members**, including root metadata, main, preload and both maps, remain byte-identical to `8e3fd79`.
- Main's **33 workspace + 16 SDK + 16 api-types** embedded sources match Git/original vendor archives; preload's one workspace source matches Git. The unchanged main map retains 915 other dependency sources. Vendor archives and dependency pins remain unchanged.
- Local Linux ASAR bytes match Mac exactly. Rebound receipts identify `f82a648`; original committed receipts retain dirty base `8e3fd795b699c8ff07357544421d00f34dc2823c` with identical member/input hashes. Artifacts, receipts, frozen files and watched dependencies remained unchanged throughout review.

The archived `8e3fd79` package and long-input failures retain their original scope. This
audit verifies correction-package identity; it adds no CI, image, test or native execution claim.

Machine receipt: [`package-review.json`](./package-review.json).
Scratch: `/tmp/opencode/projects-mac-wrap-audit/{summary.json,integrity.json,source-hashes.json,verify.py}`.
Executed: `python3 /tmp/opencode/projects-mac-wrap-audit/verify.py` (hash-pinned historical offline readers reused).
Audit UTC: `2026-10-03T15:33:09Z–15:33:17Z`. Only assigned reports/scratch written;
no application source, commits, builds, application tests, network or Mac session executed.
