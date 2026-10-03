# Terminal transcript state correction

Base application: `760c4a046ce454bc8b0ab2fd85c941fec321c3ea`.

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
final diff. Final image audit and new-revision CI/native proof remain pending.
Original `760c4a0` acceptance remains frozen separately.
