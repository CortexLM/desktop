# Linux CI glyph repair — implementation handoff

Ready for coordinator integration. Controlled missing-fallback mechanism accepted;
historical CI package/configuration cause remains unknown. CI provisioning is pending.

## Changes

- `.github/workflows/ci.yml`: existing Linux setup installs `xvfb fonts-noto-cjk fontconfig`.
  Separate apt commands preserve fail-fast behavior with GitHub's `bash -e`.
  Fontconfig file/index/family/PostScript-name/charset inventory goes to
  `out/fonts/fontconfig.tsv`; package/version/status to `out/fonts/packages.tsv`.
  Existing always-upload Linux artifact includes `out/fonts/`.
- `tests/e2e/remote-auth.spec.ts`: existing eight-locale case now probes **あ/ア, 한/글,
  汉/字**, both themes, weights **400/500**. It uses the computed heading font family,
  explicit `32px`, fixed **128×64** canvases centered at **64,32**. Exact RGBA comparisons
  require ink, distinct pair rasters and neither equal to U+10FFFF's missing glyph.
  Separate `auth-locale-fonts` JSON stores pairs, heading styles, twelve weight results
  and six CDP platform-font records. Only failed probes attach tiny glyph PNGs.
  Font attachment errors still enter nested app/backend cleanup.

No new registered case. Original **48 primary states / 80 measurements / 384 text rows /
144 keyboard stops** remain asserted/exercised. Bytes before line 409 are identical to
`1076c2584941cf054efffaf709a149b4195bc1c4`; SHA-256 of that prefix:
`ec9671e179cd43b07fb737b8e9c0ccd7316797a1426e4fb6814b08a4d15cb8c7`.
Runner labels and other CI jobs are unchanged.

## Executed checks

| Check | Result |
| --- | --- |
| `bunx --no-install eslint tests/e2e/remote-auth.spec.ts` | Pass |
| TypeScript API using repository options, root `tests/e2e/remote-auth.spec.ts` | 321 source files, zero diagnostics, no emit |
| `bun run typecheck` | Final pass; initial failure below retained |
| YAML parse, `bash -n`, isolated `bash -e` apt-failure check | Pass; failed update cannot fall through to successful inventory |
| `git diff --check -- .github/workflows/ci.yml tests/e2e/remote-auth.spec.ts` | Pass |
| Existing locale case under Xvfb, current built app | **1 passed**, 39.9 s case / 40.6 s run; zero skips/retries/flaky/errors |
| Exact new helper under isolated missing/full system-font configs | All three scripts fail without fallback, pass with fallback at both weights |

E2E command, with `NODE_ENV=test`, `TMPDIR=/tmp/opencode`, dedicated
`PLAYWRIGHT_HTML_OUTPUT_DIR` / `PLAYWRIGHT_JSON_OUTPUT_FILE`:

```sh
xvfb-run -a -s '-screen 0 1920x1080x24' bun run test:e2e tests/e2e/remote-auth.spec.ts --grep 'Live sign-in copy stays readable across eight locales' --workers=1 --output=/tmp/opencode/linux-ci-glyphs-check-s9i1loe0/artifacts
```

Generated receipts: `/tmp/opencode/linux-ci-glyphs-check-s9i1loe0/`:
`e2e.json`, `e2e.log`, `html/`, `artifacts/`, `controlled/results.json`.
All eight full-size dark locale PNGs reviewed: visible glyphs, no tofu or clipped login
copy. All six local CJK heading records select **WenQuanYi Zen Hei** (Korean also uses
Geist for its space). Local Noto CJK is not installed; this does not prove CI installation.

Controlled verification transpiled/executed the actual `readableGlyphs` initializer,
including its Playwright assertion and CDP collection. Existing Chromium **153.0.8010.12**,
existing source-pinned Geist, two isolated fontconfig directories; zero requests,
zero new page captures. Six negative weight groups produced **18 tiny PNGs**; each pair
and missing-glyph RGBA raster is identical. Positive groups produced no failure PNGs.
Helper SHA-256: `97bc5fa6552790d634e08551368bd6e9907c6995e8e380338a544ce9d6bf9f09`.

## Build binding / limits

No build performed. All **90 existing build members** matched
`evidence/live-state-followup/integrated/source-build-initial.json` before and after E2E.
That renderer includes the separate live-state hook correction, SHA-256
`fde8193d44f8e943915b18a5b3dc074ef048dc1f37cd580f25db1f2bfab6ed34`.
Main SHA-256 remains `f0fc4522cde726dd8b88dcbb56f4116ba93dc87e1e9e29163502d25e522512c7`.
Runtime: Electron **44.5.1**, local Node **24.21.0**, Bun **1.4.2**.

Initial full typecheck failed in concurrent `tests/e2e/bot-owner.spec.ts:61`:
`TS2339: Property 'pushState' does not exist` because a local `history` helper shadowed
the browser global. Its owner changed that call to `window.history.pushState`; subsequent
full typecheck passes. No edit to that file here.
Initial anchored grep selected no tests; its diagnostic remains in
`/tmp/opencode/linux-ci-glyphs-check-45u7omkf/`. Corrected title filter ran exactly one case.
`bun run test:e2e --list --reporter=list` discovers **103 cases**, including the concurrent
four live-state and two Bot-owner cases. Glyph changes contribute **zero** new cases.

## SHA-256 handoff

| File | SHA-256 |
| --- | --- |
| `.github/workflows/ci.yml` | `7d1fb3b18f9784ed295085dd96664e9f967f4eb12d3c4958bf183838e067e6c8` |
| `tests/e2e/remote-auth.spec.ts` | `653016add38f51d766dfec52c205790de4b941c02739a993315c282469b1b0cb` |
| `e2e.json` | `ab4a8252a8292cc1729abaeaa31b4fddc1c71ea9cf1c9ae37db33efe04a7c006` |
| `controlled/results.json` | `5f03dd3047bd7cd7404833fab228afc503093aca1f73de1e837836eec75a528c` |

Coordinator owns docs/evidence integration and next-push CI acceptance. No application,
CSS, bundled-font, dependency or lockfile edits; no installs, commits, new CI runs or Mac
actions. Historical failing CI images remain intact. The sentinel detects this tofu class,
not exhaustive Unicode coverage or full product acceptance.
