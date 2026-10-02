# Provider key-row follow-up

Installed `de623fd` at 960×640 exposed a zero-width key label/status with the normal sidebar.
The key was persisted correctly; `Saved · 5678` could not be read. The native negative and
successful credential checks with the sidebar hidden remain [revision-scoped](../mac/de623fd/README.md).

Correction: let the existing key row wrap, reserve a 120px label basis, keep input/Save together
within the available pane. Wide layout stays inline; existing copy and colors are retained.
No new surface or design state is introduced.

Two source-Electron regressions fail before the correction (light/dark at 960px). Updated tests
save, reload, replace and remove a test key at 960/1024/1440 in both themes using a deterministic
catalog. Range/hit testing detects unreadable text, geometry rejects overlap/overflow and requires
the 1440px row to stay inline. Captures wait for the real save toast to finish.
The first capture-only wait left the pointer over the toast, pausing its dismissal; moving to
the page header resolves that harness failure without changing timers. Both logs are retained.

Local provider/stream/refusal flows pass; lint, types, i18n and Linux packaged smoke pass.
The mechanical UI detector reports only a pre-existing width-transition warning in the unrelated
system animation styles. Native correction proof and new CI remain pending.
[Retained checks and six width/theme captures](provider-layout/retained-files.json).
