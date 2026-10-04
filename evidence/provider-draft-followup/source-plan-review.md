# Provider key draft — bounded source proposal

**Approve one minimal repair after the original negative: action-selective clearing in existing `run()`, guarded by the captured raw draft.** Static review only; no corrected runtime result claimed.
Baseline application `2956564fbe31f882014d74ff3a7f920e839fd634`; documentary HEAD `10a57be97ee9e9f9ea0c761784279ec8744b70d3`. Six reviewed source files match both revisions at `2026-10-03T10:39:38Z`.

## Recommended three-line replacement in `settings.tsx:221,224,237`
```tsx
const run = (f: () => Promise<unknown>, ok: string, clearKey = true) => {
  f().then(() => { toast.add({ title: ok, data: { icon: "check-circle" } }); if (clearKey) setKey((current) => current === key ? "" : current); onChange(); }, () => toast.add({ title: t("system.providers.saveFailed"), data: { icon: "alert-triangle" } })).finally(() => setBusy(false));
<Switch checked={cfg.enabled} onCheckedChange={(x) => run(() => api.providers.update(p.id, { enabled: x }), x ? t("system.providers.enabled") : t("system.providers.disabled"), false)} aria-label={t("system.providers.enable")} />
```
These replace the corresponding existing lines; preview guard, `setBusy(true)`, function closure and surrounding JSX stay in place.

- **Cause:** successful Enable PATCH shares unconditional `setKey("")` with key PUT/DELETE. Core PATCH updates only enabled/baseURL (`provider.ts:72–77`), so lost replacement input was never saved. Protocol `:70–72` and client `:163–166` keep these operations distinct.
- **Why this choice:** moving clearing into only PUT's `.then()` either changes accepted Remove semantics or duplicates that side effect for DELETE. One action flag keeps the current helper and both credential actions; PATCH alone opts out.
- **Save:** `key` is the invocation render's raw submitted draft; request still sends `key.trim()`. Functional update compares the latest raw draft against that captured raw string. Unchanged draft clears only after success; different text typed while the input remains editable survives. Do not compare against `key.trim()` or unconditionally clear in a relocated callback.
- **Remove:** preserve current behavior for an unchanged draft on accepted deletion. It is an explicit stored-key removal, not submission of replacement text; preserving the incumbent clearing policy avoids silently redesigning it. A different draft typed after DELETE starts survives. Rejected PUT/DELETE/PATCH never enter the success callback and retain the draft.
- **Ownership/security:** `ProviderDetail key={current.id}` (`:210`) remounts on provider selection; an old state setter cannot clear another provider's draft. Provider reads still return only `hasKey`/last-four `keyHint` (`provider.ts:48–51`); no key-read API, storage or protocol change is needed.
- **Bound:** the functional guard protects changed draft contents, not edit-history identity. Existing Switch concurrency and lack of a `run()` busy guard are visible but not reproduced by this review; this proposal does not claim request serialization. No extra concurrency refactor is recommended for this draft-loss batch.

## Minimum evidence before accepting the fix

1. Preserve the assigned real-Electron negative unchanged, both themes: saved fixture key A, unsaved B, successful Enable PATCH, B retained, A's hint unchanged, no key PUT; explicit Save B then persists its hint and clears unchanged input.
2. Cover the new stale-completion guard: hold the **actual successful PUT response** after real engine acceptance, type distinct C while B's response is held, release unchanged response; B stays persisted, C remains editable. Apply the same held-real-response check to DELETE: stored key absent, newly typed C retained; ordinary accepted DELETE with unchanged draft retains its prior clearing behavior. Do not fabricate API success/history.
3. Refused credential writes retain input and saved metadata; unchanged accepted Save clears. Check real transport/results and draft values, not merely the toast. Existing write-only responses remain sanitized.

Source SHA-256: `settings.tsx` **`54e9b65e6f37710d6235e64f720e75f0ed03ec647cd1f0dd1bda63aca544285d`**; `packages/core/src/provider.ts` `ded605cbdf58d2ed7352d302ac365067fcd6b33b4ab33bacc67af1de8a536e07`; `packages/protocol/src/index.ts` `8c91ead8ab678b0bfab39799bb03e0b4d60612632bfd5aa65f74bf8b21669e69`.
Additional verified SHA-256: client `0faa61a96ffb009edd1fd6d321d38d805625eb385c9d912c7a184bc1467367e7`; schema `0403846e16c38e7f06c077d7980a9c375898ba413f5aa5f93cf863d7229f5361`; live hook `fde8193d44f8e943915b18a5b3dc074ef048dc1f37cd580f25db1f2bfab6ed34`.
Sole write: this review. No app/test/build execution, repository edits, native/CI/network operations, commit or delegation.
