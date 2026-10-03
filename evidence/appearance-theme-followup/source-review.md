# Appearance theme — independent integrated source review

**APPROVED: actual three-file implementation, including selected-click persistence correction. No source blocker found.**

- Whole-file reconstruction against `37c22c2` passes: original proposal plus only `settings.tsx:85`'s `onClick={() => { if (pref === x) setTheme(x); }}`. Production diff: **12 additions/10 removals across three files**; CSS/catalogs/dependencies/config unchanged; whitespace check passes.
- The first proposal missed selected-radio callback semantics. Retained `targeted.json` records **2 Appearance failures at test line34**, storage null, only initial observation reached; two existing keyboard cases pass (**50.149s total**). `evidence/appearance-theme-followup/initial-candidate/` report/log gzip round-trips match originals exactly. This is a real behavior regression, not the original 17 failures repeating.
- The added handler restores the old button's explicit-selection persistence when the initial hash already selected that value. Unselected clicks remain solely `onValueChange`; assertions remain unchanged.
- Installed `mergeProps.mjs:167–187` runs this user handler before RadioRoot's default click; already-checked native input emits no change. The unselected branch does nothing; Base UI performs its one real change. Space activates the native button; arrow focus uses Base UI. No duplicate key handler or synthetic application event path added.
- Base UI supplies `radiogroup`/`radio`/`aria-checked`; existing group label and visible translated names remain. `nativeButton render={<button />}` is correct; Space-only activation and omitted Home/End match the radio contract. No redundant explicit ARIA needed.
- Required `Nav.themePref` uses Shell's `pref`, default `system`; `import type` is erased. Base UI value/setter infer the same literal union; existing Shell event validation remains. No new trust boundary, authentication dependency or state source.
- Existing provider allocation, section/main keys, preview replaceState path, theme resolution/persistence remain unchanged; this patch adds no remount key or synchronization effect. Onboarding/common getter remains separate and unchanged.
- `AGENTS.md:155–158` correctly separates rail Home/End from Settings arrows; `docs/testing.md:375–381` describes the actual cases and original 17 failures without claiming preview coverage. Its pending-result wording was still present at readback.

| Exact current file | SHA-256 |
| --- | --- |
| `packages/app/src/screens/system/settings.tsx` | `4f0b4f911195eb7e5a12dc22ff9e940f0cd67190ce9eb44ae7c99d6054c80461` |
| `packages/app/src/shell/nav.tsx` | `876682aef675ef9e0b1c5a3a59a49b00acbb1da84a7897f0dc17efa287579315` |
| `packages/app/src/shell/shell.tsx` | `880240350484738971849dbabdfe591cd90471afc08fa0ffca02ef6f78a6ae67` |
| `tests/e2e/appearance-theme.spec.ts` — 93 lines, identical negative-test hash | `2bff6928c640ef274363b00e3861027488fa1025d0087135a93ddbee061949ba` |

- Parsed available **`targeted-confirm.json`: 4/4 pass, 21.679s, zero retries/skips/flaky/errors**; SHA-256 `b6537fa36a912f36ab1fdde18e1f90850159ab4b8d21b023da425789d3c0a6c0`. Both Appearance cases reach nine stages with no page errors; original test bytes unchanged. Original baseline remains two cases/17 failures in 19.624s.
- Confirmation observations establish correct fresh-hash selection, external rail-selected **sole Tab stop**, System under both emulated OS schemes, saved-System reload. Existing keyboard cases also pass. These are supplied results, not reviewer-executed tests or independent build provenance.
- Final `source-final.json` hashes match all four files above. Corrected lint/types logs have no diagnostics; corrected i18n reports zero problems; `design-detect.json` is `[]`. Earlier unit log reports 245 passes + one optional skip; no unit rerun inferred.
- External-rail Tab-stop observations already pass; no extra test required for that claim. Preview hash/System/OS focus continuity remains source-reviewed, runtime-unverified. Full113/package run is coordinator-owned, outside this approval.
- Performed source reconstruction/hash/diff, installed handler/type/CSS review, supplied report parsing. No test/build/CI/Mac/network/capture/commit/delegation operation. No visual or screen-reader acceptance claimed. Sole write: this report.
