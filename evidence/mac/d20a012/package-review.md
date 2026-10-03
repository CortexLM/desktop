# Independent offline package review — d20a012

**Approved for installation.** Exact archive/source admission passes; collector-source approval and installed-native verification remain separate.
Application `d20a012fbb774aa9b348fe1913f85d3476430098`; retained metadata binds CI `37153526225`, artifact `11284474514`, **144,707,245 bytes**. CI success is coordinator-reported, not queried here.

- Outer SHA-256: `bca22424621e7fd49f6490ab606257efb6ca84c9203892021b2dc39140a8a58b`.
- Inner ZIP SHA-256: `90f74a9796f1c1753885d0c0679ab2aa35130d826485c529794f45c3701f2429`.
- ASAR SHA-256: `9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893`.
- Both ZIP CRC checks pass. Outer ZIP contains exactly the supplied inner ZIP; embedded ASAR equals supplied bytes. All **697 entries** are unique: **362 regular files, 321 directories, 14 framework symlinks**. Symlinks resolve inside the bundle to existing members; no archive paths traverse them.
- All **13 Mach-O binaries are arm64**, byte-identical to the hash-pinned Activity package. Regular-file hashes and symlink targets are recorded in the scratch integrity ledger; nothing extracted or executed.
- All **91 ASAR files / 92 integrity blocks** verified: contiguous complete payload, no gaps, overlaps, unindexed bytes, links or unpacked entries. Exact **90 frozen build members + root package.json**.
- Root package metadata matches Git after scripts/devDependencies removal; bytes match Activity. Local Linux ASAR bytes match this Mac ASAR exactly.
- Resources match Git exactly: **104 catalogs, 13 × eight locales, plus `skills/summarize/SKILL.md`**. No extra locale/skill files, fixture directories or raw source stamps in those resources.
- All **520 package inputs / 478 renderer inputs**, including complete frozen source copies, match Git. Input path sets independently enumerated; rebound headers change only revision/dirty fields. Original committed dirty-`d390cce` receipts remain intact; later application-pin/source-delta receipts agree.
- Renderer fingerprint: `087587293bfb7c2ccf85176cece73982ae75db48318e1c381270caa5196a0d73` (SHA-256 of sorted `path:sha256` rows joined with LF, no trailing LF).
- Relative to `9ba8e59`, exactly **17 package inputs differ**: **eight runtime source/style files +438/−48**, **one raster unit source +134**, **eight Files catalogs +152 values**. Each locale adds the same 19 keys; all prior catalog values remain unchanged. Three new input paths: image.tsx, raster.ts, raster.test.ts.
- **Main, preload and both maps are byte-identical to Activity.** Main's 33 workspace sources and preload's one source match Git; 16 SDK +16 api-types sources match original vendor archives. All 915 other embedded dependency sources and dependency pins remain unchanged. No engine/API/preload/store delta.
- Raster source is corrected `3aaacb7094d26554ebb1e61973e026a05a4067fe0f13714ebca4f2f26388ced7`; unit source `619ec5fe7d970224ef1309e862c24130a01bfda18aa6a0c4656e54c6ba38f031`. Reversing only the filename regex correction and its added assertion recovers the original author hashes; no parser-policy expansion inferred.
- Production renderer `index-DUOpTxRN.js`: **2,507,431 bytes**, SHA-256 `41a9bd8ce4f12279d751424fec1c4d690b642619cd7d90173597b1f88c2f1741`. Production React/minified-error markers present; checked development diagnostics absent.
- CSS `index-BLpXbDn5.css`: **207,405 bytes**, SHA-256 `6f9ee615b76e0301097d546b8fedc2bf386b306f766a628ae0485a0b165dbb78`.
- Watched inputs and both frozen trees remain stable before/after. Initial auditor failed only because its reverse-patch pattern incorrectly expected `/g`; initial script/log retained separately. Corrected audit passes without modifying any input artifact.

Machine receipt: [`package-review.json`](./package-review.json). Scratch: `/tmp/opencode/files-package-audit/{verify.py,summary.json,integrity.json,source-hashes.json,verification.log}`; initial attempt: `verify-initial.py`, `verification-initial.log`.
Executed offline verifier `python3 /tmp/opencode/files-package-audit/verify.py`, reusing hash-pinned historical data readers; successful audit UTC **2026-10-03T21:24:35Z–21:24:47Z**.
Only assigned reports/scratch written. No build, application test, CI/network, Mac, lease or installation action. This permits the matching package's installation, not collector execution or native acceptance; full Files/product delivery remains incomplete. Earlier Activity proof retains its original scope.
