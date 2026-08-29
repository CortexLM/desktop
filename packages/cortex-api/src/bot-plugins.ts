/**
 * The plugin marketplace and the account's connections to it.
 *
 * The catalogue is the service's, cached server-side from the provider. This
 * client neither keeps a list of its own nor substitutes one: a `503` is "the
 * marketplace is not configured" and `is_live: false` is "it did not answer",
 * and both are states to render rather than reasons to show a Drive card the
 * user could not connect.
 */

import type { CortexApiClient } from './client.ts';
import { unknownSchema } from './schemas.ts';
import {
  pluginCatalogSchema,
  pluginConnectionListSchema,
  pluginListSchema,
  type ApiPlugin,
  type ApiPluginCatalog,
  type ApiPluginConnection,
} from './bot-runtime-schemas.ts';

/**
 * `GET /v1/plugins/catalog` (observed 2026-08-29): `{ items, is_live, provider,
 * source }`. The envelope is returned whole — `is_live` and `provider` are as
 * much of the answer as the items are.
 */
export function getPluginCatalog(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiPluginCatalog> {
  return client.request('/v1/plugins/catalog', pluginCatalogSchema, { signal });
}

/**
 * `GET /v1/plugins`, which is *not* the app catalogue: as of 2026-08-29 it
 * answers a bare array of runtime capability flags (browser, shell, VNC …).
 * Kept for the pending product surface; use `getPluginCatalog` for the
 * marketplace.
 */
export async function listPlugins(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiPlugin[]> {
  const list = await client.request('/v1/plugins', pluginListSchema, { signal });
  return list.items;
}

export async function listPluginConnections(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiPluginConnection[]> {
  const list = await client.request('/v1/plugins/connections', pluginConnectionListSchema, {
    signal,
  });
  return list.items;
}

/**
 * Starts a connection for one catalogue slug.
 *
 * The success shape has not been observed — every probe of this route so far
 * has been refused before it got that far, because it needs an account and the
 * only sessions available to probe with were guests (see CONTRACT.md). So the
 * response is parsed permissively and the caller re-reads the connections
 * afterwards rather than trusting a body this client has never seen.
 */
export function connectPlugin(
  client: CortexApiClient,
  slug: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return client.request(`/v1/plugins/${encodeURIComponent(slug)}/connect`, unknownSchema, {
    method: 'POST',
    body: {},
    signal,
  });
}

export async function disconnectPlugin(
  client: CortexApiClient,
  slug: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`/v1/plugins/${encodeURIComponent(slug)}/connect`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}
