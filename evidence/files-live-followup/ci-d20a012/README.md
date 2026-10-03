# Saved Files — independent CI artifact audit

**Scoped pass:** [CI 37153526225](https://github.com/CortexLM/desktop/actions/runs/37153526225),
application **`d20a012fbb774aa9b348fe1913f85d3476430098`**; all three jobs successful.
Offline source/artifact review. No new blocking finding in reviewed Files CI states; full goal remains open.

## Derived results
| Evidence | Linux | macOS |
| --- | ---: | ---: |
| Electron cases / attempts / passes | 143 / 143 / 143 | 143 / 143 / 143 |
| Registered theme/state render visits | 426 | 426 |
| Retries / skips / flaky / unexpected / runner errors | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Workers / duration | 4 / 243.810562s | 1 / 716.119807s |
| PNG copies / unique PNG and RGBA images | 589 / 195 | 590 / 196 |

**278 units + one optional real-backend skip**, 25 files; lint/types pass.
i18n: **69 files / 2,288 used keys / 3,438 English keys / zero problems**. All **132 JSON attachments** parse.
[Cases](cases.jsonl), [E2E](e2e-summary.json), [checks](checks-summary.json), [structured observations](structured-observations.jsonl).

## Artifact and source binding
| Artifact | ZIP bytes / files | Independently verified SHA-256 |
| --- | ---: | --- |
| Linux `11283984884` | 41,461,742 / 593 | `10f92464e60410f96d97ccdc2563eb38bf6d6798bbe9a272470687f9e6b31e42` |
| macOS `11284439650` | 40,035,330 / 595 | `b33f9a289147cf1420d1499770d7e98c340453461e12ea91d184011600c3ee14` |

Metadata/upload digests, CRC, safe unique paths, extracted file sets and every byte checked independently.
All job logs/report metadata name checkout **`72b43406c8092c54c1683f8d0c53bed2e24b5923`**.
Supplied signed-commit payload reconstructs its exact Git-object SHA-1; head/checkout share tree
**`b17a4b9a71398b511253044a159ef0ebb558d4ef`**. GPG signature itself not independently validated.
The unsuccessful local object lookup is preserved; offline reconstructed proof is recorded separately.
All **520 frozen source inputs / 478 renderer inputs / 90 local build members** verified, exact file sets.
Renderer fingerprint **`087587293bfb7c2ccf85176cece73982ae75db48318e1c381270caa5196a0d73`**.
Original dirty `d390cce` receipts retained; later `d20a012` binding does not rewrite their execution provenance.
[Downloads](downloads.json), [members](members.jsonl), [source binding](source-binding.json), [source delta](source-delta.jsonl).

## Eleven corrected Files cases, both OSes
Bound 373-line test SHA-256: **`a7bd52dbc4577825bbaf2b50fff0de17801faa521ca98c6369c37b53e0f1e498`**.
All eleven pass once per OS, including corrected native-unreadable WebP, pan against actual pre-action
translation, provider-disabled restart GET, draft setup reload and three appended application regressions.
Native decoding calls the original decoder; hooks delay completion. IPC gates preserve genuine replies.
Three genuine completed downloads per OS compare original bytes, including held same-owner PNG download.
`will-download` / `setSavePath` chooses a deterministic destination: **no installed Save dialog proof**.
Downloaded files are not archived; completion/byte equality derives from executed assertions and bound source.
Unsafe-URL observation covers the renderer after setup, not all main-process traffic.
[Case proofs](files-cases.jsonl), [limits](files-proof-scope.json), [native fixture binding](fixture-binding.json).

## Visual inspection and drift
All **391 unique images** inspected through **34 contacts**; **28 Files views** inspected full-size:
per OS four lifecycle, eight dark-locale and two long-filename frames. **74 prior-alias drift views**
plus one smoke renderer inspected full-size; **103 current full-size views** total.
**290 exact prior canonicals reused / 101 new lossless WebPs**; full RGBA bytes and dimensions verified.
**374 matched aliases: 300 exact / 74 changed**. Every changed frame retains exact changed-pixel counts/bounds.
All **16 Memory + 16 auth locale** images remain PNG/RGBA-exact to Activity evidence.
All **16 Activity locale** frames differ only within right-side timestamp columns: **387–543 pixels/frame**,
**7,827 total**. Visible Linux time 18:55 versus 21:03; macOS 19:04 versus 21:11 (localized equivalents).
No inferred clock policy or generic clock explanation for unrelated differences.
Larger unrelated differences include button fills, appearance-card edges and 5s/6s reasoning content/scrollbars;
current frames inspected, measurements retained, causes unestablished. Contact-only frames receive no blanket full-size approval.
Long filenames have intentional bounded scrolling; Home/End proves movement, not exhaustive visual reading.
Two light long-header frames retain Zoom out tooltips without obscuring primary controls or image pixels.
CJK glyphs visible; no native-speaker fluency, photographic accuracy or full-locale-state certification.
[Image index](image-index.md), [review](visual-review.json), [exact drift](prior-image-comparisons.jsonl), [regional checks](regional-review.json).

## Historical failures and proof limits
Eight original first-failure negatives on `9ba8e59` remain; later assertions were unreached.
Initial target six passes/two collector failures remain: damaged PNG decoded; provider PATCH emitted no refresh event.
Corrected WebP is independently fixture-bound; no application codec expansion. Reload precedes the fresh no-model draft.
Three application negatives remain distinct: second Rename editor, first-toggle Blob replacement, light long-header zero image height.
Reconstructed negative-source suffixes are labelled; earlier negatives cannot inherit later assertion/dark-iteration execution.
[History](historical-results.jsonl), [source attribution](negative-to-positive.json), [collector correction](provenance/collector-corrections.diff).
Static PNG/JPEG/WebP preflight: **50,000,000 bytes / 40,000,000 encoded pixels / 32,768 per dimension**.
Full history crosses IPC first; **no total IPC/decoder memory bound**. Native dimensions are checked after decode.
Observed deletion clears owned pixels/URLs; journal bytes and already dispatched downloads are not erased.

## Smoke, diagnostics and retention
CI unsigned arm64 package/smoke reports window/process/renderer success. Native display capture still fails:
`could not create image from display`; cause unknown. Original raw log/error retained, not inherited by assumption.
Current March 16 simulated Setup Assistant diagnostic is byte-exact to Activity's retained file.
No Cortex crash diagnostic was uploaded; absence does not establish crash-free execution.
Package/ASAR admission and installed-native verification belong to other owners.
Raw JSON/log gzip, source receipts, callback-error fixtures, diagnostic and PNG member hashes retained.
Lossless canonicals are visual authority; contacts/crops are supplementary. ZIP/HTML/smoke DB not duplicated.
Run `python3 evidence/files-live-followup/ci-d20a012/verify.py` for offline integrity checks.
Reviewer executed only offline verifiers; no app/test/build/codec/network/device execution or commits.
Approval is bounded to supplied CI/source/image evidence; remote inference, installed Save dialog and full-product acceptance remain outside it.
