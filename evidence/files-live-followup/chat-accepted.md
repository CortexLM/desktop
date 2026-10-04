# Saved-image Chat entry — rename correction accepted
**APPROVED, source only:** the sole P2 from `g1-files-chat-review.md` is resolved; positive execution remains pending.
`packages/app/src/screens/chat/live-chat.tsx:373` adds only `&& !renameWrite.current` to Rename admission.
The first blur sets that ref synchronously; the only live Rename entry cannot mount a second editor until settlement. Existing Open checks remain intact.
Verified one-line equality against `/tmp/opencode/build-files-initial/source/` (the supplied `/tmp/build-files-initial` path does not exist).
Frozen renderer receipt: `9c05e9d79cdc1420c4c6c3e5fa8a4bbae6c105914aed426e04bfe63fd5ece4da`; frozen Chat matches original `945ae020fbb4456067a236522f3dbea65325b4e45767df570d89982f42e2c3f1`.
Current SHA-256, paths relative to `packages/app/src/screens/chat/`:
- `live-chat.tsx`: `caf59a61c91eb116c494b31d3a6e9ad68622dc6c1801e39242a09b28234a9d6d`
- `model-composer.tsx`: `adae1965674288508772d5f3815a31df25aa43c648cdb176204a4fa917e348a3` (unchanged).
- `chat.css`: `703d19a440aee2306c052ba5389d5484082586d45f788dd5a16ce7ed8963a9d9` (unchanged).
Coordinator negative report/log inspected: one attempt, one failure at `files-live.spec.ts:307`; second editor count 1 instead of 0 while accepted PATCH A's reply is held.
The later PATCH-count/Open/refusal/release/viewer assertions were not reached; no executed two-write race or early-Open failure is claimed.
Negative JSON SHA-256: `daf8e7f0bbe3632c1645a4b06903d6b94d8ecda33a52d70315d5b15fc670e0a4`; log: `381e39b54733b383d26f62bd7909721998a2b244faa2f7e06c7cf85e47440577`.
The supplied 312-line test hashes to `0982831cc5fc8a569bdd0a08b5e13515cc3796de717283fb53ce6fd42ecdf1e6`; original 290-line `e28ddaec…` prefix is byte-exact.
During review the test grew to 373 lines; its first 312 still match that pin. Later appended cases are outside this acceptance.
Prior source qualifications remain; parser/viewer corrections and pre-fix unit/lint results confer no corrected runtime acceptance.
Only this report written. No delegation, application edits, builds/tests, network, CI, devices or commits; rebuilt positive coordinator execution pending.
