# 02 — Errors and user-facing copy

## 2.1 Never show a vendor name to a user

When something Cortex depends on fails, the user needs to know which **Cortex capability**
is affected and **what to do next** — not which supplier we route through.

| Internal dependency | User-facing wording |
| --- | --- |
| models.dev catalog | the model list |
| Cua Driver | computer use |
| AI SDK / provider HTTP errors | the model / the provider (see 2.3) |
| Hono, SSE, IPC | the app / the connection |

**Bad**: `"models.dev is unreachable"` · **Good**: `"The model list could not be loaded. Check your connection and try again."`

### Where a name may appear

- Code, comments, module names, tests and docs may name a dependency.
- **Providers the user chose** are named in Settings → Providers & models: the user is
  pasting their own key for that account. Their name comes from the catalog, not our copy.
- `scripts/translate-locales.mjs` tells the translator never to invent vendor names; keep it so.

## 2.2 Engine errors are codes; copy is ours

The engine returns `{ error: { code, message } }` (`packages/protocol`). `code` is an
`ErrorCode` from `packages/schema/src/index.ts`; `message` is a neutral English developer
string (`packages/core/src/error.ts`). The renderer maps `code` to a catalog key and
**never renders `message`**.

**Bad**:

```tsx
catch (e) { setError((e as Error).message) }   // "Provider request failed (status 503)"
```

**Good** — `packages/app/src/screens/chat/live-chat.tsx`:

```tsx
const errKey = (code?: string) => (code && KNOWN_ERRORS.includes(code) ? code : "generic");
<b>{t(`chat.err.${k}.title`)}</b><span>{t(`chat.err.${k}.body`)}</span>
```

Adding an `ErrorCode` means adding its `chat.err.<code>.title/body` (or the area's
equivalent) to `packages/i18n/locales/en/*.json`, otherwise users see the generic copy.
Provider codes (`provider_key_missing`, `provider_auth_failed`, …) offer a jump to
Settings → Providers & models.

## 2.3 What good error copy looks like

What is affected, what state it is in, what to do. Sentence case, no exclamation marks,
no blame.

| Rule | Bad | Good |
| --- | --- | --- |
| No status codes | "Request failed with status 503" | "The provider is temporarily unavailable." |
| No stack fragments | "TypeError: Cannot read properties of undefined" | "This chat could not load." |
| No internal ids | "ses_abc not_found" | "This chat no longer exists." |
| Offer a next step | "Failed." | "Add a key in Settings to start chatting." |
| Never fake success | toast "Saved" on a failed write | "Could not save. Try again." |
| Say when it is not built | a button that silently does nothing | "Sign-in to Cortex Cloud is not available yet." |

## 2.4 Copy is reviewed like code

Every user-visible string is in `packages/i18n/locales/en/*.json` and goes through review.
Keep placeholders (`{count}`, `{name}`) identical across locales — `tests/unit/locales.test.ts`
checks it. If you change error copy conventions, update `AGENTS.md` (`05-documentation.md`).
