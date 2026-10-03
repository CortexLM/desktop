# Existing transcript surfaces — next correctness review

**Recommend next: fix deleted-Chat copy; then Code's failed-result badge. Two confirmed P2 defects.**
Application `760c4a046ce454bc8b0ab2fd85c941fec321c3ea`; documentary HEAD advanced to `72d2926b284760d96462cc931777761eedf9e3c1` during review.
Five reviewed source files match application Git bytes; all 90 final build members match before/after.
No repository/application/test mutation, build, CI, Mac action, listening server or external network request.

## 1. Deleted Chat presents a temporary send failure — P2, misleading recovery

- Confirmed browser result: real session create/delete, then GET **404 `not_found`**, empty transcript, mounted composer; alert says **“Something went wrong. Your message is kept. Try again in a moment.”**
- Cause: `packages/app/src/screens/chat/live-chat.tsx:297` deliberately converts `not_found` to `undefined`; `errKey` selects `generic` (`17–21,38–48`). `packages/i18n/locales/en/chat.json:180–181` supplies the false retained-message/retry claim. Core deletion genuinely removes the session (`packages/core/src/session.ts:85–110`).
- No `chat.err.not_found.*` keys exist in any of the eight locale catalogs. `chat.unavailable.*` concerns model capability, not deletion; `chat.preview.deleted` is preview-only wording.
- **Smallest delta:** forward `not_found` intact at line 297; in existing `ErrorCard`, select `shell.notFound.title` / `shell.notFound.body` only for that code. Both already exist in all eight locales: **“Page not found” / “This link goes nowhere, or the page has moved.”** Preserve other send-error mappings and the mounted draft; the existing New chat control provides recovery.
- Test fit: extend the deletion branch of `tests/e2e/live-state.spec.ts:126–151` with reload, real session 404, truthful missing-page text, absent retained-message/retry claim, and existing New chat navigation. Keep the delayed-history/no-revival assertions.

## 2. Failed Code result is labelled green “Ready” after reload — P2, contradictory status

- Confirmed browser result: a real admitted Code turn reaches a controlled provider-fetch 401; persisted assistant has `provider_auth_failed` and `time.completed`. Initial mount **and reload** display `badge ok` / **“Ready”** alongside **“The task stopped”** and provider recovery copy.
- Cause: `packages/app/src/screens/code/code.tsx:226–227,251,259` derives the badge only from live `status`, despite already deriving `lastError` for the banner. Core publishes error then idle (`packages/core/src/session.ts:422–427`); a fresh hook starts idle. A completed failed turn therefore loses the failed badge even though its error remains durable.
- **Smallest delta:** add `const failed = status === "error" || (!!lastError && lastError.code !== "aborted");` after `lastError`; use `failed` for the two badge error branches at line 251. Keep `busy` first. Reuse existing `code.status.failed` / `code.status.ready`; no hook, protocol or catalog changes. Explicit Stop semantics remain outside this narrow failure correction.
- Test fit: existing Code-session cases in `tests/e2e/code-models.spec.ts`; reuse `startFakeProvider({ rejectFirst: true })`. Assert accepted/persisted failure shows Failed before/after reload; a successful follow-up returns Ready and removes the error banner. Verify actual histories, both themes.

## Proof and review bounds

- `/tmp/opencode/transcript-next-review/receipt.json` records actual API responses, persisted Code history, busy/error/idle events, rendered labels, source pins, requests and cleanup. Both full-size PNGs were inspected.
- Runnable isolated probe: `bun /tmp/opencode/transcript-next-review/probe.ts`. Uses the existing hash-verified dist, Chromium request interception, real in-memory core/SQLite plus `app.fetch`; provider 401 is injected at core's supported fetch boundary. No fabricated session/history objects.
- Browser requests are fulfilled before network; real SSE greeting is read then cancelled. This establishes initial/reload rendering, **not** live SSE timing or native Electron acceptance. Zero page errors; browser/core closed. First attempt stopped before startup on documentary HEAD movement (`setup-boundary.txt`); no behavioral failure was hidden.
- Work already derives failed/paused/done from persisted message info (`home.tsx:21–25,435`), unlike Code. Chat/Code/Work live children are session-keyed; no owner-reset or hydration fix is proposed here.
- Their session-metadata `useQuery` predicates currently observe `session.updated` only (`live-chat.tsx:252`, `code.tsx:215`, `home.tsx:426`); this probe does not claim immediate missing-page transition on live deletion. Load-error and unavailable-state branches were read; no third defect is promoted without bounded reproduction.
- Existing transcript/Bot corrections and earlier visual receipts retain their prior scopes. These two local fixes can proceed within the approved surfaces.
