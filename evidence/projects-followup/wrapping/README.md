# Project long-input wrapping correction

Pushed application `f82a64800c0fffd6ebaa99e571a8af0fa4307095`;
[CI 37132419774](https://github.com/CortexLM/desktop/actions/runs/37132419774) passes all
three jobs: 118 Electron cases/426 visits per OS, 252 units plus one optional skip.
[Independent CI audit](../ci-f82a648/README.md) reviews 316 images/20 full-size Project views;
all sixteen locale images exactly match `8e3fd79`. Native acceptance is separately scoped.
[Post-commit binding](final/application-pin.json) verifies all 515 tested package inputs.

After `8e3fd79` passed CI, a bounded 960×640 check exposed accepted unbroken input clipping:
48-character names overflow creation preview, Project headings/cards and Library cards;
4000-character instructions overflow detail and Library text. The creation toast also
lets the name escape its boundary. These failures were outside the original three cases.

Two additional Electron cases fail against `8e3fd79` with eight recorded assertions.
The first CSS correction fixes Project text but retains two toast-overflow failures.
Four changed CSS rules now wrap these surfaces through `overflow-wrap: anywhere` and
native flex sizing. No input limit, stored text, copy or behavior assertion changes.
The exact baseline test SHA is `899a1ae786d68645117d4bd0c9d6d1be413850a3b5bc3f2ab195f9abe319eef3`.
The same five-case Projects file passes in 14.125 seconds; two long-input views were inspected.

The two failing baseline captures and first-correction captures remain negative evidence.
Full regression passes **118 cases / 426 render visits** in 278.610 seconds, zero
retries/skips/flaky outcomes. Linux package/smoke, lint/types/i18n pass. The completed
[18-reference comparison](compare/README.md) passes its independent bounded review.
Its production build is frozen separately from `8e3fd79`: 515 inputs, 90 members, renderer
fingerprint `2230ff6f2deeee6b9d2b7eff21e96f152c193e15dfa824080721b3d1853d4464`.
The admitted `8e3fd79` Mac package is archived, not installed. Matching `f82a648`
[installed evidence](../../mac/f82a648/README.md) includes four individually passing
captures plus a passing zero-capture deletion supplement. The collector's overall time-budget
failure remains retained; independent native audit accepts the scoped composite. Earlier CI/artifact audits
retain their original pins.
