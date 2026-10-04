# Appearance theme — final local Electron audit

**Bounded artifact approval: 113/113 cases pass; zero retries, skips, flaky or unexpected results.**
Run: `2026-10-03T12:31:55.825Z`, **284.403482s**, four workers, Linux Electron.
All prior **111 cases** remain registered, green and source-unchanged. The two new cases use
the exact 93-line negative test: **17 original failed assertions now pass** (light 9/dark 8).
One case verifies **426 registered screen-state renders**, not 426 retained screenshots.

## Source and build

Base application: `37c22c2fcff92fb76b10ffc97ec0643ac325d62f`. Final bindings:

| File | SHA-256 |
| --- | --- |
| `packages/app/src/screens/system/settings.tsx` | `4f0b4f911195eb7e5a12dc22ff9e940f0cd67190ce9eb44ae7c99d6054c80461` |
| `packages/app/src/shell/nav.tsx` | `876682aef675ef9e0b1c5a3a59a49b00acbb1da84a7897f0dc17efa287579315` |
| `packages/app/src/shell/shell.tsx` | `880240350484738971849dbabdfe591cd90471afc08fa0ffca02ef6f78a6ae67` |
| `tests/e2e/appearance-theme.spec.ts` | `2bff6928c640ef274363b00e3861027488fa1025d0087135a93ddbee061949ba` |

The current **514-input inventory** differs from the freeze only in those three source files.
This separate final check does not expand the baseline's original 512-input receipt.
All **473 renderer inputs** match fingerprint `474405faaf26dba6319cb1c139f0b32ef04adf2b7e600d6edee37f72b4fabf44`.
All **90 distribution members** match the final receipt, stable before/after audit; **88/90**
equal the prior freeze. Only renderer entry bundle/name and its HTML reference differ.
Main/preload, both maps and CSS are unchanged. No unexplained input drift.

The packaged ASAR independently parses to exactly those 90 build files plus root package.json;
embedded file/block hashes pass. ASAR SHA-256:
`f0b5f9ee60b8170d69bdd7bc04fa636a44f3360bc90082d41437097b1c902aae`.
Retained Linux smoke says **SMOKE OK**. Recorded source/build pairing and byte verification
establish identity; this audit did not reproduce the build. [Provenance](provenance.json).

## Corrected behavior

Both live English 960×640 cases complete nine stages with zero recorded page errors.
Fresh hash, main selection and rail agree; pointer selection saves even an already-selected
hash preference. ArrowRight/ArrowLeft move focus, selection and stored preference. Tab exits
to Language. External rail selection updates the mounted card and its sole Tab entry.
System remains selected and stored as `system` under both emulated OS schemes; reload with
`theme=system` restores it. Initial-hash and external-Tab ownership are verified observations;
the original 17 assertions and test bytes remain unchanged. [Checks](checks.json),
[negative-to-positive mapping](negative-to-positive.json), [cases](cases.jsonl).

The separate [preview helper](../preview-check/result.json) passes eight screenshot-free groups:
arrow wrap/focus and same-node continuity, rail-selected Tab entry, Language exit, both System
OS schemes, reload and null preview storage. Its matching-source proof closes the earlier
[source review](../source-review.md)'s preview uncertainty; it adds no registered/CI cases.
The [first candidate's two pointer-setup failures](../initial-candidate/targeted.json.gz)
remain separate from the original 17 baseline failures.

Final lint/types logs contain no diagnostics; i18n reports **65 files / 2,272 used keys /
3,405 English keys / zero problems**; mechanical design findings: zero. Final-source units
reran at 12:40:05: **245 passed, one optional skip, 22 files, 12.02s**. The earlier candidate
unit run remains separately pinned in provenance.

## Visual retention and limits

**298 PNG files / 145 unique file PNGs; 153 PNG attachments, four inline; 149 unique images.**
All **19 contact sheets** inspected; both new Appearance originals inspected full-size.
Selected card, rail icon and rendered theme agree. Labels and controls fit these 960×640
frames. The previously hovered card retains its shadow; it is not the selected ring.
Both originals are byte-identical to targeted-confirm captures, so their existing canonicals
are reused. **127 canonicals reused; 22 new lossless WebPs**, all decoded RGBA-exact.

Against the previous full run: **151 comparable attachments; 119 exact RGBA, 32 different**.
Measured bounds/counts remain in [comparisons](image-comparisons.json); causes are unassigned.
Contact views retain known provider-row crops, toast overlap and text ellipsis. This is not
all-screen pixel parity, all-locale Appearance, native chrome or screen-reader acceptance.
[Images](images.jsonl), [contacts](contacts.json), [full-size targets](fullsize-targets.json),
[review](review.json), [summary](summary.json) and [SHA256SUMS](SHA256SUMS) bind this audit.
Raw reports/logs are linked from [provenance](provenance.json); existing gzip bytes roundtrip exactly.
Offline verifier: `python3 /tmp/opencode/appearance-theme-final-review/finalize.py`.
