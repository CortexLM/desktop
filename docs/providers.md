# Providers and models

The key entry row wraps its controls when the Settings pane is narrow, keeping the label and
saved last-four hint readable at the minimum window width. Key material remains write-only.
Model rows also wrap their capability badges below the name, context and cost when the pane
is narrow, preserving complete metadata instead of clipping it behind an ellipsis.

Live Cortex Code uses the configured-model chooser for new tasks and follow-ups, including reasoning
controls and file attachments. Reopening a task starts with its persisted session model. A missing,
disabled or unsupported choice refuses the send and keeps the draft/files; it does not silently fall
back to another model. Explicitly configured keyless compatible endpoints remain available in Code.
Folder cancellation retains the draft before a session is created; engine refusals retain it afterward.
Code refusal notifications anchor above the complete attachment/composer area, keeping file removal
and model recovery controls reachable in a narrow pane.

## Catalog

The model list is the public models.dev catalog, `https://models.dev/api.json`
(`CATALOG_URL` in `packages/core/src/catalog.ts`; override with `CORTEX_CATALOG_URL`).

- Loaded lazily on first use, network first with a 10 s timeout.
- On success the raw JSON is cached to `<dataDir>/cache/models.json`.
- Offline: falls back to the cache, then to the data already in memory; with neither the
  engine returns `catalog_unavailable`.
- `POST /api/catalog/refresh` forces a reload.

Routes: `GET /api/catalog/providers`, `GET /api/catalog/providers/:id/models`,
`GET /api/catalog/search`.

Signed-in Chat and its feature screens use the main-owned remote Chat catalog through
`remoteChatModels()` in `screens/chat/remote-owner.ts`. Concurrent reads share one
`api.remoteSessions.models()` request. The Code catalog endpoint does not populate the
Chat core catalog; it must not be substituted under the same shared key. Completed reads
are not reused indefinitely: the next call reloads against the current owner.

## Supported providers

A provider is usable when its catalog `npm` maps to a bundled AI SDK factory
(`sdkFamily` in `packages/core/src/provider.ts`):

| Catalog `npm` | Factory |
| --- | --- |
| `@ai-sdk/anthropic` | `createAnthropic` |
| `@ai-sdk/openai` | `createOpenAI` |
| `@ai-sdk/google` | `createGoogleGenerativeAI` |
| `@ai-sdk/openai-compatible` (needs `api` base URL) | `createOpenAICompatible` |

Anything else is listed with `supported: false` and cannot be used.

## Configuration and keys

Per provider: `enabled`, optional `baseURL` override, key. `GET /api/providers` returns
`ProviderConfig` = `{ providerID, enabled, hasKey, keyHint?, baseURL? }` — never the key.

| Route | Effect |
| --- | --- |
| `PATCH /api/providers/:id` | enabled / baseURL |
| `PUT /api/providers/:id/key` | set key (write-only, 1–4096 chars) |
| `DELETE /api/providers/:id/key` | remove key |

Keys go to the host `Credentials` (desktop: `packages/desktop/src/credentials.ts`).
Resolution errors: `provider_disabled`, `provider_unsupported`, `provider_key_missing`
(OpenAI-compatible providers may run without a key), `model_not_found`.

## In the app

Settings → **Providers & models** (`packages/app/src/screens/system/settings.tsx`,
`#/settings?section=providers`): provider list with search, key field (masked, hint
shown), enable/disable, model list with capability badges (reasoning, image, tools),
context size and cost. Chat shows a banner linking here when no provider is configured.
Enable changes preserve an unsaved replacement key. Accepted key Save/Remove clears the
draft only when it still matches the action's captured input; newer edits survive pending
responses. Refused writes retain the draft and saved metadata.
Composers pick from enabled providers that have a key.
Chat clears its draft and attachments only after the engine accepts the prompt. Changing to
a model without image input produces the engine's capability error with the draft intact;
images are never silently removed. Retrying a failed reply resends the original text and files.
The same capability gate covers images/PDFs replayed from conversation history, including a
text-only follow-up after changing models. Refusal preserves the selected session model and history.
Send waits for selected files to finish reading; failed reads name the file and ask to select
it again. Historical retry uses the selected reply's preceding prompt, not a later message.

Code, Work and Bot composers also clear drafts only after prompt admission. Missing models,
cancelled Code folder selection and engine refusals keep the original text editable for retry.
While admission is pending, composer controls are locked and duplicate submits are ignored.
Work home keeps its composer mounted when a new session replaces the empty board.

The shared and live Chat composers use the frozen reference's trimmed-text capsule state:
typing detaches the send button; whitespace keeps the voice state. Live Chat keeps its real
model picker, attachment handling and accepted-send contract. Refresh reloads configured
model availability without clearing text or files; voice controls report unavailability in
place until voice is wired.

Preview Home suggestions and Code tasks carry their text and selected preview model into
the conversation via browser history. Chat preview replies explicitly identify themselves
as local demonstrations; Code personal requests show no executed changes or commands.
Same-URL fixture navigation gets a distinct history entry, so Back restores the initial
personal request and model. Later preview turns are local component state, not engine data.
Shared preview add/microphone/voice controls open the matching registered screens.

Provider names shown here come from the catalog: the user chose that provider
([`.rules/02-errors.md`](../.rules/02-errors.md) § 2.1).

## Capabilities

Capabilities are derived from the catalog entry (`capabilities()` in `@cortex/schema`) and
enforced by the engine before and during a call. See [engine.md](./engine.md) § Sessions.
