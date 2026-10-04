# Dark UI deletion supplement — APPROVED, source only

Reviewed `/tmp/opencode/projects-native-dark-delete.mjs` (57 lines).
Verified SHA-256: `3a3c694f32edefa8259e9280a3b6fa32f5c772fb4072ac41011a2dbbc9ae3cb6`.
Retained pointer-run manifest SHA-256: `148075d5cbdddd991720b3def5d31a0d666c0b96fb8a06b69a0a90ac20911b27`.

- Hardcoded PID 67608, revision `f82a64800c0fffd6ebaa99e571a8af0fa4307095`, ASAR and isolated pointer root match that manifest. Inspector rechecks package members; CDP browser PID binds the attached page; final inspection must match.
- Fresh Projects/sessions/providers guards precede UI creation. One listed Project and one IPC-created root Chat supply cleanup IDs; the UI must show `1 chat` and dark theme before deletion.
- OS dark is read, CDP media defaults released. Existing English Create/More actions/Delete project selectors match source; no prompt or provider configuration occurs.
- UI deletion must navigate to Projects, return Project 404 and empty list, preserve the complete returned Chat except `projectID`, and retain empty messages.
- Cleanup targets only captured Project/session IDs, verifies three empty lists, restores the initial route and requires zero fixture requests/failures/errors. No blanket deletion.
- No screenshot/capture call. Thirty-second success gate precedes cleanup; reported total duration also includes cleanup. Original four-capture/120-second driver is untouched.

Pointer-run manifest remains **failed**: budget assertion occurred at `dark:delete-project-ui` before its UI action; duration 128.800 s includes seven successful cleanup checks.
Its four captures remain individually recorded as passed; API cleanup of the dark Project/session does not establish dark UI deletion.
A supplement pass establishes only this missing dark UI deletion/preservation case. It cannot rewrite the failed run or establish a single complete passing flow.

Only local source/manifest reads and SHA-256 checks performed. No execution, device/network access, tests, new captures or lease actions. Coordinator owns execution and final restoration evidence.
