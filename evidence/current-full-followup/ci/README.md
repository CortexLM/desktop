# Final-head CI receipt — 37082159189

Retained copy of the independent receipt. JSON metadata, fourteen contact sheets and sixteen
full-resolution selections are committed here; `retained.json` binds the selections. Complete
original artifacts/logs, verification scripts and `SHA256SUMS` remain in the report's temporary directory. The original receipt below
retains its executor paths and scope; it does not describe the later recovery corrections.

**Verified SUCCESS**, attempt 1, [run 37082159189](https://github.com/CortexLM/desktop/actions/runs/37082159189), completed **2026-10-03T00:37:16Z**.
Saved API metadata/logs/artifacts; download observation **2026-10-03T00:43:08.973565Z**. All writes confined to this report and `/tmp/opencode/final-head-ci-6d96535/`.

## Source identity
- Head `6d965358bb5e02473df6be7e97ecfdb07650c0b8`; all three checkout logs and both E2E reports pin merge `3b733db499868a2917d9ed7cdb311d9312a28bdd`.
- GitHub head/merge trees equal `eba03a02a764cc9999010bc01af4bbe537042115`, matching local committed head tree; merge parents are base `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d` and head above.
- Application/E2E/package inputs unchanged from `f9aca44476fcebd0699c09c9e3f7eebcd5151a2a`: packages, tests, vendor, skills, workflow, dependency lock/configuration and smoke script. Script delta only `scripts/compare-shots.mjs` and `scripts/compare-shots.test.mjs`.
- Recomputed **473-file** renderer-input fingerprint `5f709c11d836948142b65c5c2b4fe0582bddbfc19f76dbe15cf6d2146a6bcf0f`; matches prior committed manifest. Source claims use committed inputs, not moving working-tree state.

## Actual results
| Job | Verified result |
|---|---|
| Checks `111084827948` — `ubuntu-latest` | Lint/types pass; **178 units passed, 1 skipped, 0 failed**, 16 files; i18n **63 files / 2,267 used / 3,395 English / 0 problems** |
| Linux `111084827904` — `blacksmith-4vcpu-ubuntu-2404` | **70/70**, 70 attempts, **426 render/copy checks**, 4 workers, 187.144s |
| macOS `111084827814` — `blacksmith-6vcpu-macos-26` | **70/70**, 70 attempts, **426 render/copy checks**, 1 worker, 483.755s; arm64 package and smoke pass |
- Both E2E reports: **0 retries, 0 flaky, 0 skipped, 0 unexpected, 0 report errors**. Run attempt remains 1.
- Unit skip: `lists models from a real backend`, guarded by `CORTEX_TEST_BACKEND_URL`; no real-backend result from this run.
- Each OS ran six Work-conversion, three Search, four routine, five Code-model cases; two native chrome/menu API cases (en/fr), one reduced-motion startup case.
- Chrome tests assert Cortex title, minimum 960×640, bounds, menu labels/actions; macOS traffic-light position `{x:20,y:15}`. These are API assertions, not native screenshots.

## Artifact integrity — freshly downloaded, API/upload-log SHA-256 matched
| Artifact | Bytes | Outer ZIP SHA-256 |
|---|---:|---|
| `e2e-linux` **11259033438** | 18,259,808 | `8a7947649ca40232293d3e2cb33c3ef0491b10226a76195619f84c70f0d0d4b8` |
| `macos` **11259183794** | 17,660,714 | `32925247073758b0580979c93fbee34b433c0a6ef0fc2d9720f7af373296cc9f` |
| `cortex-mac-arm64-zip` **11259064123** | 144,612,538 | `138aaed250c7fc01843ab6b9a85fc1974d59cd78b2c528452726c8b7ab4a2141` |
- Logs: 86,361 bytes, 52 files, SHA-256 `036fdd994a6535d4e96848e7e5f84c5679f3e0f29cbc72ae3216ae2ddf713ba9` (no API digest supplied). Extracted inventories: Linux 227 files, macOS 231, package wrapper 1.

## Package identity and launch limits
- Inner `Cortex-0.2.0-arm64-mac.zip`: **144,905,920 bytes**, SHA-256 `4eba9ed7ab8fe55b678e8dafd24dc3d49622edad6f4c149f97fd83cb560a1a02`.
- **697 ZIP entries**, 376 non-directory entries; every member path/size/content hash matches the retained prior manifest. ZIP metadata/whole-archive equality is not claimed.
- `app.asar`: **28,191,344 bytes**, **91 files**, SHA-256 `23decdd0596b89e8e83284b62f6e7f0eb5314b081ccf178f7dde31c8ac04af77`; all 91 members, including 90 build members, match prior; embedded SHA256 integrity verified.
- Comparator: prior **CI37080136101 / artifact11258159964**, manifests pinned at `6d96535`. Prior inner ZIP hash `3e63619e9a16589e396eba1f7b2fb10c92010adfa42ad6d032a5ab7bfa21b9fe` differs. That installed artifact retains its own provenance; current artifact was not installed here.
- macOS logs: Electron **44.5.1**, unsigned arm64, notarization/publishing disabled; default Electron icon warning. Smoke detects `Cortex cortex://app/index.html`, survives 10s, renders shell, reports `SMOKE OK`.
- **Native capture failed:** `screencapture -x out/smoke-screen.png` reports **“could not create image from display”**; native PNG absent. Script catches failure, so green smoke proves renderer/liveness only. Root cause not diagnosed.
- Sole uploaded `.ips`: simulated **Setup Assistant**, **2026-03-16 08:32:43 -0700**, system executable; SHA-256 `384ea4db6324dc5b8ab6a0fd5a4594b620e76ec694e0f0bb75495595824f90dd`. No Cortex crash file in the downloaded artifact.

## Screenshot inspection
- **All 151 unique PNGs inspected across 14 contact sheets**: Linux 75, macOS 75 plus packaged smoke; **451 uploaded copies** reconciled by hashes. Per OS: 61 images at 960×640, 12 at 1440×900, 2 at 1024×640; smoke adds one 1440×900.
- **16 original-resolution images opened** for findings/positive states; exact IDs/paths/hashes in `visual-review.json` and `images.json`. All originals remain retained. No blank/corrupt PNG observed.
- Full-resolution residual, both OS/themes at 960×640: Code split composer shows only a short draft prefix; `Message not sent` obscures most of the older `No model available` toast. Retained-value/recovery assertions pass; this is presentation evidence, not draft loss or a newly attributed regression.
- Full-resolution residual, both OS at 960×640: matching-model metadata truncates to `100...`; full context/cost unreadable in that frame. Provider key label/saved hint/entry remain readable. Long routine-name input likewise shows a prefix.
- Full-resolution positive states: Bot refusal dialog remains; routine source text/Bot B visible; failed Bot list exposes Retry with Create disabled; missing/file-dependent sources refuse creation; routine success and grouped Search paint clearly; Work Done accompanies controlled-provider output.
- Packaged smoke image shows populated light local Chat home, empty recents and `No model`; SHA-256 `bb69536bf3b15ff6bd53db88c9c3197711ef1a5cae4ac36e2036e35deb0651da`.

## Scope and handoff
- `receipt.json`, source/package/E2E manifests, raw metadata/logs, all originals/contact sheets, `visual-review.json`, `SHA256SUMS`; verification assertions passed. No CI/build/test/native rerun, Mac operation, app/repo write or owner action.
- **426 checks per OS are not 426 uploaded screenshots**, pixel comparisons, exhaustive localization, or live-product acceptance. Provider flows are controlled; remote authenticated inference, Windows/package coverage and full visual/native acceptance are not established by this run.
- Coordinator-owned installed native sweep/frozen comparisons remain separate; neither inspected nor altered by this executor. Prior CI37080136101 installed-artifact evidence retains its original revision.
