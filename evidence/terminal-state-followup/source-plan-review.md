# Terminal-state corrections — bounded source review

**Approve the proposed minimal plan. No source-level blocker found.** Application baseline: `760c4a046ce454bc8b0ab2fd85c941fec321c3ea`. Offline verification at `2026-10-03T09:30:52Z`: ten reviewed source files and 24 shell/chat/code catalogs match that Git revision exactly. This approves the plan, not an integrated patch or runtime result.

## Chat: existing ErrorCard, explicit missing-session copy

Recommended replacements in `packages/app/src/screens/chat/live-chat.tsx:45,297`:

```tsx
<div className="chat-grow"><b>{code === "not_found" ? t("shell.notFound.title") : t(`chat.err.${k}.title`)}</b><span>{code === "not_found" ? t("shell.notFound.body") : t(`chat.err.${k}.body`)}</span></div>
{session.state === "error" && <ErrorCard code={session.code === "not_found" ? "not_found" : "network"} />}
```

- Schema `ErrorCode` already includes `not_found` (`packages/schema/src/index.ts:22–49`); client preserves it (`packages/client/src/index.ts:108–110`), `useQuery` retains it (`state/live.ts:23`). Chat's `KNOWN_ERRORS` omits it. Keep that allowlist unchanged: the explicit ErrorCard branch resolves these two keys; other dynamic error mappings retain their current fallback.
- `shell.notFound.title/body` exist, nonempty, in **en/fr/es/de/ja/zh-Hans/pt-BR/ko**; no locale has `chat.err.not_found.*`. English is **“Page not found” / “This link goes nowhere, or the page has moved.”** Already used by `shell/not-found.tsx:7`; truthful for a missing conversation route, with no retained-message or temporary-retry promise.
- **Audit gotcha:** put the conditional outside `t()`, as above. `audit-i18n.mjs:101–104` registers direct literal arguments; `t(condition ? "shell.notFound.title" : dynamicKey)` would conceal that key from its missing-English-key check. Direct literal calls preserve audit coverage; full audit execution belongs to integration.
- The load-error call supplies no `onRetry`; `not_found` is not a provider-settings error. Therefore this card has no Retry button. A historical assistant `m.info.error.code === "not_found"` would share the copy and retain its separately supplied Retry (`:324`); this is not the confirmed initial/reload load-error case and does not block this bounded correction.
- Existing New chat (`:294`) calls `go("home")`. Composer/draft ownership stays intact: prompt refusals return `false` (`:266–270`), composer clears only after accepted sends (`model-composer.tsx:80–91`), core rejects a missing session before admission (`core/src/session.ts:124–150`). A rejected send's existing toast mapping is separate from the corrected load-error card. No automatic navigation or live-deletion timing claim.

## Code: persisted latest-assistant error drives the settled badge

After existing `lastError` at `packages/app/src/screens/code/code.tsx:227`:

```tsx
const failed = status === "error" || (!!lastError && lastError.code !== "aborted");
```

Use `failed` in **both** badge error branches (`:251`): `busy ? "run" : failed ? "err" : "ok"` and `busy ? t("code.status.running") : failed ? t("code.status.failed") : t("code.status.ready")`.

- Core completes/persists the assistant with `error`, publishes non-aborted status `error`, then publishes `idle` (`core/src/session.ts:422–427`). Storage keeps the entire message JSON and returns it as `info` in ID order (`storage.ts:103–105,141–149`). Live status alone cannot retain a settled failure.
- `useMessages` starts idle, loads full `info`, accepts final live message updates, preserves completed records against older snapshots (`state/live.ts:39–64,90–93,111–117`). The already-computed latest-assistant `lastError` therefore survives reload; the existing banner uses `lastError && !busy` (`code.tsx:259`).
- Keep `busy` first in both branches. Keep selection of the **latest assistant**, not the latest erroneous assistant: each new run creates a new assistant without an error (`core/src/session.ts:277–287`); successful completion leaves its `error` absent. This clears derived `lastError` and the banner while preserving the older failed history, restoring Ready after success.
- Existing `rejectFirst` fake returns HTTP 400; `toErrorInfo` maps it to `provider_error`. Discovery's HTTP 401 becomes `provider_auth_failed` (`core/src/error.ts:27–30`). Both take this non-aborted failure branch; the existing fake needs no additional mode. Stop/`aborted` remains its existing separate behavior.

## Required regression evidence from the assigned workers

- Chat, both themes: actual deleted-session GET 404/`not_found`, initial visit and reload show the two missing-page strings, no generic retained-message/retry claim in the load-error alert, no Retry there, existing New chat reaches home. Preserve earlier deletion/no-revival assertions.
- Code, both themes: an admitted provider-refused turn has a persisted completed assistant error; settled and reloaded views show **Failed + `badge err`**, never Ready/`badge ok` alongside that hydrated failure. A successful follow-up has a newer completed error-free assistant, shows **Ready + `badge ok`**, removes the banner, retains the earlier failure in history. Busy keeps Running priority. Preserve the original negative cases unchanged for the corrected rerun.

## Original SHA-256 pins

| Source | SHA-256 |
| --- | --- |
| `packages/app/src/screens/chat/live-chat.tsx` | `2a1c72aed2b979797be67d6f37612726a7d086e7a902ab5423d8d9026dc299ab` |
| `packages/app/src/screens/code/code.tsx` | `65f25c7b534b9a8f8d032a6f67f9a794054c18a997a15de499f88ede8d8ccb89` |
| `packages/app/src/state/live.ts` | `fde8193d44f8e943915b18a5b3dc074ef048dc1f37cd580f25db1f2bfab6ed34` |
| `packages/core/src/session.ts` | `8bdaadc276264e3e755c73df44bd894b884826875a6e582149dccc69086b81d4` |
| `packages/core/src/storage.ts` | `1c56b82e24b89b68733e7cf5ba38a7d241f11f66e7a3857e0561ec3728bff255` |
| `packages/core/src/error.ts` | `9205502b45ddbdab79a212385af3141940158e6a68f1439391241b0a571572a2` |
| `packages/schema/src/index.ts` | `0403846e16c38e7f06c077d7980a9c375898ba413f5aa5f93cf863d7229f5361` |
| `scripts/audit-i18n.mjs` | `7e4ba09a4652f18e2428d392141ea023bfb742277ebab3e3fcab9b13ef7c8a56` |
| `packages/app/src/screens/chat/model-composer.tsx` | `cf9fde70480feddd3030f4c430038ede8869fb823a4808d22ec69b361e27b93a` |
| `packages/client/src/index.ts` | `0faa61a96ffb009edd1fd6d321d38d805625eb385c9d912c7a184bc1467367e7` |

Checked existing source, catalog JSON and retained discovery receipt only. No application/test/build/native/network/CI execution, repository writes, commits or delegation. Sole deliverable: this review. Earlier discovery/native evidence retains its original scope; corrected Electron/native acceptance remains with the coordinator.
