/**
 * Chat plugins. Catalog and connection state come from the API.
 * A 503 is "Composio is not configured". The four brand cards stay as
 * the product lock; they are never shown as connected unless the API says so.
 */

import { createSignal } from 'solid-js';

import {
  classifyBotError,
  connectPlugin,
  disconnectPlugin,
  listPluginConnections,
  listPlugins,
  PLUGIN_UNAVAILABLE,
  type ApiPlugin,
  type ApiPluginConnection,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';

export type PluginBrand = 'drive' | 'slack' | 'github' | 'paper';

export interface PluginCard {
  id: PluginBrand;
  name: string;
  summary: string;
  installVia: 'composio';
}

export const PLUGIN_CARDS: readonly PluginCard[] = [
  {
    id: 'drive',
    name: 'Google Drive',
    summary: 'Files and folders Ana already has in Drive.',
    installVia: 'composio',
  },
  {
    id: 'slack',
    name: 'Slack',
    summary: 'Channels and mentions, without leaving Cortex.',
    installVia: 'composio',
  },
  {
    id: 'github',
    name: 'GitHub',
    summary: 'Issues and pull requests on repositories you can see.',
    installVia: 'composio',
  },
  {
    id: 'paper',
    name: 'Paper',
    summary: 'Design files from Paper, the same source this UI is drawn from.',
    installVia: 'composio',
  },
];

export type PluginLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';

const [catalog, setCatalog] = createSignal<ApiPlugin[]>([]);
const [connections, setConnections] = createSignal<ApiPluginConnection[]>([]);
const [pluginState, setPluginState] = createSignal<PluginLoadState>('idle');
const [pluginError, setPluginError] = createSignal('');

export { catalog as pluginCatalog, connections as pluginConnections, pluginState, pluginError };

export function isPluginConnected(id: PluginBrand): boolean {
  if (connections().some((row) => row.brand === id || row.plugin_id === id || row.id === id)) {
    return true;
  }
  return catalog().some((row) => (row.brand === id || row.id === id) && row.connected === true);
}

export async function reconcilePlugins(): Promise<void> {
  const client = botClient();
  if (!client) {
    setPluginState('unavailable');
    setPluginError('The plugin catalog is not reachable from this origin.');
    setCatalog([]);
    setConnections([]);
    return;
  }
  setPluginState('loading');
  try {
    const [rows, linked] = await Promise.all([listPlugins(client), listPluginConnections(client)]);
    setCatalog(rows);
    setConnections(linked);
    setPluginState(rows.length === 0 && linked.length === 0 ? 'empty' : 'ready');
    setPluginError('');
  } catch (error) {
    const classified = classifyBotError(error);
    setCatalog([]);
    setConnections([]);
    setPluginState(classified.code === PLUGIN_UNAVAILABLE ? 'unavailable' : 'error');
    setPluginError(classified.message);
  }
}

export async function installPlugin(id: PluginBrand): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Plugins are not reachable.');
  await connectPlugin(client, id);
  await reconcilePlugins();
}

export async function removePlugin(id: PluginBrand): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Plugins are not reachable.');
  await disconnectPlugin(client, id);
  await reconcilePlugins();
}
