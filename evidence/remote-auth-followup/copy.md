# Desktop email-code authentication copy

## Delivered

Added seven `auth.*` keys immediately after `login.unavailable` in
`packages/i18n/locales/{en,fr,es,de,ja,zh-Hans,pt-BR,ko}/system.json`.
Eight catalog files; 56 added entries; no removed or modified pre-existing entries.
Removed unused `auth.verifyEmail` and `auth.verifyEmailText` from the initial copy
delivery. The frozen six-digit OTP copy does not describe backend VerifyEmail's
nonempty 1–128-character input. Unsupported continuation screens use
`auth.continuationUnavailable`; the seven retained keys and translations are unchanged.

| Key | Exact English source |
| --- | --- |
| `auth.signedIn` | Signed in |
| `auth.failed` | Couldn’t sign in. Check your details and try again. |
| `auth.sendFailed` | Couldn’t send a code. Try again. |
| `auth.continuationUnavailable` | This sign-in step isn’t available in Cortex yet. Use another address or cancel. |
| `auth.sessionOnly` | Sign-in lasts until Cortex closes. Chats still use your local provider settings. |
| `auth.optionUnavailable` | This sign-in option isn’t available yet. Use email or continue on this device. |
| `auth.settings` | Open connection settings |

## Verification

- Node `v22.23.3`; existing locale suite ran once before the two-key removal, exit 0.
  Vitest result cache recorded `tests/unit/locales.test.ts` with `failed: false`.
  The suite was not rerun for the bounded removal.
- Final Node assertions passed: valid JSON; exactly seven additions per locale;
  all values nonempty strings; no duplicate keys; exact requested English; matching
  placeholders; both unused keys absent; every prior entry identical to HEAD,
  including `login.unavailable`.
- The seven retained keys have no placeholders in any locale.
- Initial scoped `git diff --check` passed before removal. Final catalog assertions
  confirm seven additions and zero pre-existing deletions for each of the eight files.
- No dependency installation was performed; cached Node 22 and existing dependencies
  were used. No install process was detected before running the suite.

Earlier suite command:

```sh
NODE_ENV=test PATH="/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH" /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/vitest/vitest.mjs run tests/unit/locales.test.ts
```

## Translation review and limits

- Seven non-English locale translations authored directly; no external translation service or generative
  API. Reviewed against the English meaning, existing terminology and placeholders.
- Each `auth.sessionOnly` translation explicitly ends the sign-in state when Cortex
  closes and retains local/device provider settings for chats. None adds a claim of
  remote inference, chat synchronization or persistent sign-in.
- French uses the existing informal address. German follows the informal settings
  copy. Japanese, Chinese and Korean retain the sign-in and local-provider distinction.
- Linguistic review is author-only: no independent native-speaker approval. Catalog
  parity does not prove layout, truncation, accessibility or live authentication.
- Source stamps, fixtures, docs and application sources were not edited. UI/build,
  packaged smoke, Mac and CI verification remain with the integrating coordinator.
- Catalog edits remain uncommitted for integration.
