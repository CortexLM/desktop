# Independent offline package review — 8e3fd79

**Historical package identity verified.** Offline archive/source admission passes. The artifact is
archived, **not for installation**: the coordinator subsequently reproduced long-name/instruction
overflow at this revision (48-character unbroken name / 4,000-character unbroken instructions).
The correction requires its own matching package. This audit grants no long-input or native acceptance.
Application `8e3fd795b699c8ff07357544421d00f34dc2823c`; retained metadata binds run
`37130209247`, artifact `11277575575`, **144,684,259 bytes**. No CI/API/network query performed.

- Outer SHA256: `a5a4e90f376c2ec5fab38c879820e8988b72681854c78cb14a10bd7e641cb147`.
- Inner ZIP SHA256: `696ab8a1cdf1915068df371bc34ad82e70f5462a70ce5415d4af73d32de5f549`.
- ASAR SHA256: `5a92b306afc07184af30404d3d04ae596554ea9800bf31e3a0e3f2fd5c74d9ad`.
- Both ZIP CRC checks pass. Outer ZIP contains exactly the supplied inner ZIP; embedded ASAR equals supplied bytes. Inner ZIP has 697 unique entries; its 14 framework symlinks resolve within the bundle to existing members.
- All **91 ASAR files / 92 integrity blocks** verified; contiguous offsets, complete payload, no gaps, overlaps, unindexed bytes, links or unpacked entries. Exact **90 frozen build members + root package.json**; independently enumerated frozen files match the complete archive set.
- Root metadata matches Git after packaging removes scripts/devDependencies: `cortex-desktop` 0.2.0, main `packages/desktop/dist/main.cjs`; identical to the prior package.
- Resources exactly match Git: **104 catalogs, 13 × eight locales, plus `skills/summarize/SKILL.md`**. No fixture/source-stamp files or extra locale/skill resources.
- All **515 package inputs** match Git. Path sets independently enumerated from the Git tree; the previous 514-path set adds only `packages/core/src/project.ts`. New server/Electron test files are correctly outside this package-input set.
- Complete **473 renderer inputs** independently enumerated; fingerprint `6070fc3282e019c04a29f6a2a68f36f029c56e7813c4aecd84cba46f071a5bb4` (`sha256` of sorted `path:sha256` rows joined with LF, no trailing LF).
- Versus `99e3d04`, **14 runtime source files change, +424/−71**. The package-input README changes separately, +3/−1. Counts exclude tests and other documentation; per-file hashes/deltas are in `package-review.json`.
- **CSS, preload and preload map are byte-identical to `99e3d04`; main and main map change.** Main embeds **33 workspace + 16 SDK + 16 api-types** sources matching Git/original vendor archives, including the new Project service. Preload's one workspace source matches Git; 915 other embedded dependency sources, vendor archives and dependency pins are unchanged.
- Production renderer `packages/app/dist/assets/index-Cvqb1vYV.js`: **2,461,373 bytes**, SHA256 `e0527034c7c35a2ccf680bb750d156cf0511f4edc20ece0e21a1a453bf31309d`. Production React `bundleType:0` and minified-error markers present; checked development/act diagnostics absent.
- At the recorded audit time, local Linux ASAR bytes matched Mac exactly. Rebound build receipts identify the application revision; original committed receipts retain dirty base `0597848cdbdec362e1441b44c67bf74c525feefa` with identical member/input hashes. Supplied artifacts, receipts, frozen build files and watched dependencies remained unchanged during review. Later working-tree/CSS corrections and rebuilt current `dist` are outside this exact-revision audit.

Earlier development-build **109/116, seven failures** remain negative evidence in
`evidence/projects-followup/initial/README.md`; this audit grants no test/native acceptance.

Machine receipt: [`package-review.json`](./package-review.json).
Scratch: `/tmp/opencode/projects-mac-package-audit/{summary.json,integrity.json,source-hashes.json,verify.py}`.
Executed: `python3 /tmp/opencode/projects-mac-package-audit/verify.py` (hash-pinned historical offline ASAR reader reused). The recorded verifier also compared the then-current Linux ASAR; rerunning after the later correction rebuild requires that original Linux artifact.
Audit UTC: `2026-10-03T15:00:12Z–15:00:18Z`. Only assigned audit reports/scratch written; no application source, commits, builds, application tests or Mac session changed/executed.
