# Independent offline package review — 96df66c

**Approved for installation.** Exact archive/source admission passes; installed/native verification remains separate.
Application `96df66ce727c42ddf647b2dcb4eeeff04fda4927`; retained metadata binds run `37139741944`, artifact `11279989876`, **144,690,388 bytes**. No CI/API/network query performed.

- Outer SHA256: `6136183fb69490a7a2d940fb4722c600494c5caee16bebf3c9a309b081ac7aef`.
- Inner ZIP SHA256: `5a034bc8f0a6a369a46ec1e37f0297b708f33219c5e2e7a9451bdcf8271d39a0`.
- ASAR SHA256: `b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44`.
- Both ZIP CRC checks pass. Outer ZIP contains exactly the supplied inner ZIP; embedded ASAR equals supplied bytes. All 697 inner entries are unique; 14 framework symlinks resolve inside the bundle to existing members.
- All **91 ASAR files / 92 integrity blocks** verified: contiguous offsets, complete payload, no gaps, overlaps, unindexed bytes, links or unpacked entries. Exact **90 frozen build members + root package.json**, independently enumerated against frozen files.
- Root metadata matches Git after packaging removes scripts/devDependencies: `cortex-desktop` 0.2.0, main `packages/desktop/dist/main.cjs`; byte-identical to `f82a648`.
- Resources exactly match Git: **104 catalogs, 13 × eight locales, plus `skills/summarize/SKILL.md`**. No fixture/source-stamp files or extra locale/skill resources.
- All **516 package inputs**, including the entire frozen source copy, match Git. Complete package and **474 renderer input** path sets independently enumerated. The sole added path is `packages/app/src/state/runtime-settings.ts`.
- Renderer fingerprint: `64a314be9950c61466f8beec1b1ef50aa7f5b60a7f67d67bc3deff805a5800ef` (`sha256` of sorted `path:sha256` rows joined with LF, no trailing LF).
- Relative to `f82a648`, **31 package inputs differ**: 14 runtime source files **+183/−23**, 16 catalogs adding **56 keys** with prior values intact, README +2/−0. Tests and other documentation are outside this package-input count.
- All **eight source CSS files** and compiled CSS are byte-identical to `f82a648`: `index-BI2hVXPN.css`, SHA256 `6531efe4f5e496773b489657e19d46ccc4b7e355cd39b5ea1cbd997b8de16e48`.
- **Preload and its map remain byte-identical; main and its map change.** Main's 33 workspace sources match Git; 16 SDK + 16 api-types sources match original vendor archives. Preload's one source matches Git; 915 other embedded dependency sources, archives and dependency pins remain unchanged.
- Production renderer `index-BtBW9d3M.js`: **2,473,064 bytes**, SHA256 `af6bb76723b5de4f7774f476260362ad6d75651e118f2b02c18b0e740844d477`. Production React `bundleType:0`/minified-error markers present; checked development/act diagnostics absent.
- Local Linux ASAR bytes match Mac exactly. Rebound receipts identify `96df66c`; original committed receipts retain dirty base `74579d574646aff5dbd462247b4fd47a99dd2cdd` with identical member/input hashes. Watched files and both frozen trees remain stable before/after review.
- Prepared native driver remains `370b06ee1628b3e88e17104562da077b22f70da859947baa4990dd555ee44aa9`; runbook remains `4ebb970222711434366b8867a87fc387bcaf66b9da0860a232676e15fe0b31d6`. Seven English labels match the committed catalogs. Final hook is `a441e7e520e803c49f1fb5a5755c8e2cb0efed9dcdb4f30ce284a789f44e8c00`; its live/preview-boundary correction preserves the normal live-only collector flow. Prior source approval remains applicable; no collector execution claimed.

Machine receipt: [`package-review.json`](./package-review.json).
Scratch: `/tmp/opencode/memory-package-audit/{summary.json,integrity.json,source-hashes.json,verify.py}`.
Executed: `python3 /tmp/opencode/memory-package-audit/verify.py` (hash-pinned historical offline readers reused).
Audit UTC: `2026-10-03T17:34:21Z–17:34:28Z`. Only assigned reports/scratch written; no app source, commits, builds, application tests, CI/network or Mac actions executed. Prior negative evidence retains its original scope.
