# Providers and models

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
Composers pick from enabled providers that have a key.
Chat clears its draft and attachments only after the engine accepts the prompt. Changing to
a model without image input produces the engine's capability error with the draft intact;
images are never silently removed. Retrying a failed reply resends the original text and files.
Send waits for selected files to finish reading; failed reads name the file and ask to select
it again. Historical retry uses the selected reply's preceding prompt, not a later message.

Provider names shown here come from the catalog: the user chose that provider
([`.rules/02-errors.md`](../.rules/02-errors.md) § 2.1).

## Capabilities

Capabilities are derived from the catalog entry (`capabilities()` in `@cortex/schema`) and
enforced by the engine before and during a call. See [engine.md](./engine.md) § Sessions.
