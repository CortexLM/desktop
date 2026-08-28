/**
 * Chat plugins. The four cards are the product lock; install state is local
 * until Composio is configured. Official brand marks live in the screen.
 */

import { createSignal } from 'solid-js';

import { readJson, writeJson } from './persist.ts';

export type PluginBrand = 'drive' | 'slack' | 'github' | 'paper';

export interface PluginCard {
  id: PluginBrand;
  name: string;
  summary: string;
  /** Preferred install path, shown on the card. */
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

const STORAGE_KEY = 'cortex.plugins.v1';

const [installed, setInstalled] = createSignal<PluginBrand[]>(readJson(STORAGE_KEY, []));

export { installed as installedPlugins };

export function isPluginInstalled(id: PluginBrand): boolean {
  return installed().includes(id);
}

export function installPlugin(id: PluginBrand): void {
  if (installed().includes(id)) return;
  const next = [...installed(), id];
  setInstalled(next);
  writeJson(STORAGE_KEY, next);
}
