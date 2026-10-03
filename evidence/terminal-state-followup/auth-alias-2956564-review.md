# Auth alias review — application 2956564
**Disposition: shared unavailable UI/copy; button hover-style variance. No product or wrong-state assertion defect established.**
Pin: `2956564fbe31f882014d74ff3a7f920e839fd634`; existing CI `37113961621` artifacts only.
Both original **960×640** PNGs inspected full-size, then button crops; canonicals independently decode RGBA-exact.
- [MFA original](auth-alias-2956564-review/remote-mfa-unavailable-light.png) SHA-256: `41359fdbb9fe730dbf81e1037daf0b1e72d01b3d9d4274531183be139e9460f2`.
- [Verification original](auth-alias-2956564-review/remote-verification-unavailable-light.png) SHA-256: `f335a20d87cd58cc2087303dcd14d1eaa20cc6c486b209c05ac5260347bfa968`.
## Exact difference
Both read **“Not available yet”**, **“This sign-in step isn’t available in Cortex yet. Use another address or cancel.”**, **“Use another address”**, **“Cancel”**.
**No differing text.** All **15,375 changed pixels** lie within button bounds **`[466,392,826,436]`**; every pixel outside is identical.
Button interior `(500,410)`: MFA **`#eaeaea`**, verification **`#ffffff`**, both opaque; size/label position unchanged.
Dark text masks have identical bounds, eight threshold-100 differences; 76 threshold-18 core pixels are identical. No claim of byte-identical text antialiasing.
## Source-backed interpretation
All following references are Git blobs at the full pin above, retained with hashes in `review.json`.
`packages/app/src/kit/styles.css:22–23,321–323`: `--card:#ffffff`, `--hover:#eaeaea`; `.btn.secondary:hover` selects hover background.
`packages/app/src/screens/system/account.tsx:116`: both pending statuses select `unavailable`; `:205–208` renders one shared heading/body/secondary button, no status-specific label or disabled prop; `:212` supplies Cancel.
`packages/i18n/locales/en/system.json:18,325,335` and `common.json:1` supply exactly the four strings above.
Thus the captured appearance matches the intended **hover versus normal CSS**, not different MFA/verification wording, opacity or disabled-state styling.
**Trigger remains unknown:** captures retain no pointer position, `:hover` or computed-style measurement. No callback/animation-timing cause inferred.
## Fixture and assertion fidelity
`tests/e2e/remote-auth.spec.ts:43–52`: accepted code for `mfa@example.test` returns `mfa_enrollment`; `verify@example.test` returns `verify_email`.
`packages/desktop/src/remote-session.ts:98,168–175`: pending status stays distinct in sanitized state; both have `signedIn:false` in this case.
Test `:210–225` asserts the shared continuation copy, each correct engine status, signed-out connection, private-state boundaries; verification also asserts no code textbox.
Captures occur at **215/225**; following clicks at **216/226** both recover visible email and `signed_out`; subsequent email fills succeed. Matching macOS light case passes once, no retry.
Test SHA-256: `653016add38f51d766dfec52c205790de4b941c02739a993315c282469b1b0cb`.
`capture()` at **102–105** disables animations but does not normalize the pointer. Visual reproducibility gap; no demonstrated auth-state coverage failure.
Prior CI `760c4a0` aliases both macOS views to the current verification PNG; that equality remains true, without retroactive cause attribution.
## Smallest follow-up, if deterministic captures are required
In existing `capture()`, move the pointer outside controls (`await page.mouse.move(0, 0)`) before screenshot. No sleep or new test needed.
If variance persists, attach this button’s `matches(':hover')`, `disabled`, bounds and computed background at capture; no implementation performed.
Receipts, source gzip/excerpts, two original-image symlinks, crops/diff and runnable offline check: `/tmp/opencode/auth-alias-2956564-review/`.
Only owned temporary outputs written. No repository changes, application/test/build/CI/Mac/network execution, posts, commits or delegation.
