# Independent offline package review — 9ba8e59

**Approved for installation.** Exact archive/source admission passes; installed/native verification remains separate.
Application `9ba8e59fbec8c1f38f93ace25414d4a3489aede3`; retained metadata binds run `37145831654`, artifact `11282756070`, **144,694,495 bytes**. No CI/API/network query performed.

- Outer SHA256: `775ddd8f7979fda1149a33474f3eaa4d22ce61e859ea87dc16a0b3bab85cc700`.
- Inner ZIP SHA256: `d621a313d3a2b0beb1d17d27e8707943f4b5bdbb93c83df4f691f390612d6529`.
- ASAR SHA256: `22760335b8eef317c2c325cde1a7d4c09ecb888780226aaeb0e8ae4353a4bf26`.
- Both ZIP CRC checks pass. Outer ZIP contains exactly the supplied inner ZIP; embedded ASAR equals supplied bytes. All 697 inner entries are unique; 14 framework symlinks resolve inside the bundle to existing members.
- All **91 ASAR files / 92 integrity blocks** verified: contiguous offsets, complete payload, no gaps, overlaps, unindexed bytes, links or unpacked entries. Exact **90 frozen build members + root package.json**, independently enumerated against frozen files.
- Root metadata matches Git after packaging removes scripts/devDependencies: `cortex-desktop` 0.2.0, main `packages/desktop/dist/main.cjs`; byte-identical to `96df66c`.
- Resources exactly match Git: **104 catalogs, 13 × eight locales, plus `skills/summarize/SKILL.md`**. No fixture/source-stamp files or extra locale/skill resources.
- All **517 package inputs**, including the complete frozen source copy, match Git. Complete package and **475 renderer input** path sets independently enumerated. Only new path: `packages/app/src/screens/work/activity.tsx`.
- Renderer fingerprint: `a4a815bac24ce5f509f813d06371b8a754908b4b472c3d786f1325dbed53b8df` (`sha256` of sorted `path:sha256` rows joined with LF, no trailing LF).
- Relative to `96df66c`, exactly **12 package inputs differ**: Activity, desk, Work home and CSS **+176/−12**; eight Work catalogs add **56 keys**. All previous catalog values remain intact; English's +8/−1 textual diff includes formatting, not a prior-value change.
- **Main, preload and both maps remain byte-identical to `96df66c`.** Main's 33 workspace sources match Git; 16 SDK + 16 api-types sources match original vendor archives. Preload's one source matches Git; 915 other embedded dependencies, vendor archives and dependency pins remain unchanged.
- Production renderer `index-CvqF5wGz.js`: **2,483,021 bytes**, SHA256 `700fa84b40ddec7a8b3e65fb73db59281e24d118504c8c41955ac6e6b6dd7c73`. Production React `bundleType:0`/minified-error markers present; checked development/act diagnostics absent.
- CSS `index-4g_J2ofQ.css`: **206,547 bytes**, SHA256 `9d9dc52f85eade46c37195f05c01de58997a3a79070bce4bfa2361d8f686f1d5`.
- Local Linux ASAR bytes match Mac exactly. Rebound receipts identify `9ba8e59`; original committed receipts retain dirty base `906987b94c04c3c4566ecb33394584ff0e93074e` with identical member/input hashes. Watched files and both frozen trees remain stable before/after review.
- Native driver remains `82b24a9417597ab6c9ba6f0754b36b1fa2ef7dc723118e03037e3cc642f04ac5`; runbook remains `0e9149fa54cac725b0e310c3d4f4db70a836cce1bc5990d7aa60afa21821b30c`. Approved Activity/home/CSS source pins and nine English labels match this package's source. Matching package is now eligible for the separately approved bounded native plan; no collector execution claimed.

Machine receipt: [`package-review.json`](./package-review.json).
Scratch: `/tmp/opencode/activity-package-audit/{summary.json,integrity.json,source-hashes.json,verify.py}`.
Executed: `python3 /tmp/opencode/activity-package-audit/verify.py` (hash-pinned historical offline readers reused).
Audit UTC: `2026-10-03T19:13:54Z–19:14:01Z`. Only assigned reports/scratch written; no source edits, commits, builds, application tests, CI/network, Mac or lease actions. Earlier evidence retains its original scope.
