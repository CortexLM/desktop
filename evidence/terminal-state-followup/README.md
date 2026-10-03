# Terminal transcript state correction

Base application: `760c4a046ce454bc8b0ab2fd85c941fec321c3ea`.
Correction pushed: `2956564fbe31f882014d74ff3a7f920e839fd634`; frozen renderer fingerprint
`e288e023805e998f276b224f10f63a5b448082d7a31174020b943f70815c028e`.

[Bounded discovery](discovery/README.md) reproduces two existing rendering defects using
the real engine with a controlled provider: deleted Chat history returns `not_found` but
shows temporary-send/retry copy; a persisted Code failure displays green Ready after reload.
Installed deleted-Chat images separately retain that inaccurate copy in
[the preceding native batch](../mac/760c4a0/native/README.md).

The [missing-Chat baseline](chat-baseline/README.md) has two cases/four copy failures; real deleted-session/history
404s, no Retry action and New chat recovery pass. [Code's baseline](code-baseline/README.md) separately has two
cases/four badge failures; real HTTP 400 persists `provider_error`, then successful
follow-ups correctly run and complete. Its original five Code cases remain unchanged.

The correction reuses `shell.notFound.title/body` in Chat's existing error card and derives
Code's settled Failed badge from its latest persisted assistant error. Running remains
first; a newer successful assistant restores Ready. No catalog or layout change is required.
[Source-plan review](source-plan-review.md) verifies producer/lifetime and existing-key limits.

All four unchanged regressions pass on the initial corrected build (12.298s). A translation
expression was then changed to direct literal `t()` calls, preserving static key auditing.
The final rebuilt **107-case Electron suite passes**, zero retries/skips/flaky results.
Final lint/types, 245 units plus one optional backend skip and i18n (65 files/2,272 used
keys/3,405 English keys/zero findings) pass. Linux package/smoke passes; all 90 ASAR members
match the recorded final build. [Actual source review](source-review.md) approves the narrow
final diff. [Final local artifact audit](electron-final/README.md) verifies 141 images,
18 contact sheets and six full-size originals, exact source/build hashes and all eight
formerly failing assertions. New-revision CI artifact and native proof remain separate.
Original `760c4a0` acceptance remains frozen separately.
CI [37113961621](https://github.com/CortexLM/desktop/actions/runs/37113961621) passes all
three jobs at the correction pin. [CI artifact audit](ci-2956564/README.md) verifies
107 cases/426 renders per OS, 284 unique images and 28 full-size target views. All sixteen
locale images match `760c4a0`; twelve glyph-weight checks pass per OS. Native CI capture
failure remains unresolved. [Bounded auth-image diagnosis](auth-alias-2956564-review.md)
locates all 15,375 differing pixels inside the same button, matching pinned hover/normal
colors with identical copy. The actual pointer trigger remains unknown.
[Matching installed proof](../mac/2956564/README.md)
passes six native captures/checks in both themes, four UI admissions and failed/recovered
status colors. [Independent native audit](../mac/2956564/native/README.md) verifies all six
full-size images, exact stored/admitted IDs, process identity and cleanup. Mac lease released.

[09:47 public/owner readback](remote-prerequisites-0945/README.md) still finds Cloud
instance discovery missing and both Chat models explicitly non-vision. No new G2/G3
delivery or named G1 integration permission is observed; broader remote gates remain open.
