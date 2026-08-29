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
  type PluginSurface,
} from './bot-runtime-schemas.ts';

/**
 * A connection is assigned to at least one surface, so an empty list is a
 * request the service would be right to refuse and this client does not send.
 */
function surfaceBody(surfaces: readonly PluginSurface[]): { surfaces: PluginSurface[] } {
  if (surfaces.length === 0) {
    throw new Error('A plugin connection needs at least one surface.');
  }
  return { surfaces: [...surfaces] };
}

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
 * Starts a connection for one catalogue slug, on the surfaces the user picked.
 *
 * The success shape has not been observed — every probe of this route so far
 * has been refused before it got that far, because it needs an account and the
 * only sessions available to probe with were guests (see CONTRACT.md). So the
 * response is parsed permissively and the caller re-reads the connections
 * afterwards rather than trusting a body this client has never seen.
 */
// `async` so the empty-surface refusal below arrives as a rejection like every
// other failure on these functions, rather than throwing at the call site.
export async function connectPlugin(
  client: CortexApiClient,
  slug: string,
  surfaces: readonly PluginSurface[],
  signal?: AbortSignal,
): Promise<unknown> {
  return client.request(`/v1/plugins/${encodeURIComponent(slug)}/connect`, unknownSchema, {
    method: 'POST',
    body: surfaceBody(surfaces),
    signal,
  });
}

/**
 * Re-assigns an existing connection to Chat, Bot, or both.
 *
 * `PATCH` on the same route the connection was opened on, keyed by the
 * catalogue slug the page already holds. A service that has not grown the
 * assignment yet answers `404`/`405`, and the caller says the change could not
 * be saved rather than showing a switch that moved for nothing.
 */
export async function setPluginSurfaces(
  client: CortexApiClient,
  slug: string,
  surfaces: readonly PluginSurface[],
  signal?: AbortSignal,
): Promise<unknown> {
  return client.request(`/v1/plugins/${encodeURIComponent(slug)}/connect`, unknownSchema, {
    method: 'PATCH',
    body: surfaceBody(surfaces),
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
