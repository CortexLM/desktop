/**
 * Plugin catalog and Composio connections. A 503 is "not configured", never
 * a fake Drive or Slack row.
 */

import type { CortexApiClient } from './client.ts';
import { unknownSchema } from './schemas.ts';
import {
  pluginConnectionListSchema,
  pluginListSchema,
  pluginRowSchema,
  type ApiPlugin,
  type ApiPluginConnection,
} from './bot-grok-schemas.ts';

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

export function connectPlugin(
  client: CortexApiClient,
  pluginId: string,
  signal?: AbortSignal,
): Promise<ApiPlugin> {
  return client.request(`/v1/plugins/${encodeURIComponent(pluginId)}/connect`, pluginRowSchema, {
    method: 'POST',
    body: {},
    signal,
  });
}

export async function disconnectPlugin(
  client: CortexApiClient,
  pluginId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`/v1/plugins/${encodeURIComponent(pluginId)}/connect`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}
