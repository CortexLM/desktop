/**
 * Chat plugins: the marketplace catalogue, and the account's connections to it.
 *
 * The catalogue is whatever `GET /v1/plugins/catalog` returns — the provider's
 * list, cached server-side. Nothing here adds to it, orders it, or stands in
 * for it.
 *
 * This file used to hold four hardcoded brand cards. They rendered identically
 * whether the marketplace was live, misconfigured, or unreachable, which is
 * exactly when a plugins page must show nothing: a Drive card that cannot be
 * connected is worse than an empty screen, because the user spends their click
 * finding that out. `is_live: false` and a `503` are now states, not fallbacks.
 */

import { createSignal } from 'solid-js';

import {
  classifyBotError,
  connectPlugin,
  disconnectPlugin,
  getPluginCatalog,
  isAccountRequired,
  listPluginConnections,
  PLUGIN_UNAVAILABLE,
  type ApiPluginCatalogEntry,
  type ApiPluginConnection,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';

/** One row on the Plugins page, projected from the catalogue. */
export interface PluginApp {
  slug: string;
  name: string;
  summary: string;
  category?: string;
  /** `oauth2`, `api_key`, `none` … as the provider labels it. */
  auth?: string;
  toolCount?: number;
}

/*
 * The catalogue also carries `logo_url`, pointing at the provider's CDN. It is
 * deliberately not projected: the renderer's CSP is `img-src 'self' data:`, so
 * those would not load, and widening it would have every visit to Plugins fetch
 * sixty images from a third party. A monogram is drawn from the name instead.
 * Real marks would need the backend to serve them from its own origin.
 */

export type PluginLoadState =
  | 'idle'
  | 'loading'
  | 'ready'
  /** The marketplace answered and has nothing for this account. */
  | 'empty'
  /** No marketplace configured on this backend, or no way to reach the API. */
  | 'unavailable'
  /** The backend answered from its cache and told us the marketplace is down. */
  | 'not-live'
  | 'error';

const [apps, setApps] = createSignal<PluginApp[]>([]);
const [connections, setConnections] = createSignal<ApiPluginConnection[]>([]);
/** Slugs the catalogue itself marked connected for the calling account. */
const [catalogConnected, setCatalogConnected] = createSignal<ReadonlySet<string>>(new Set());
const [provider, setProvider] = createSignal('');
const [pluginState, setPluginState] = createSignal<PluginLoadState>('idle');
const [pluginError, setPluginError] = createSignal('');

export {
  apps as pluginApps,
  connections as pluginConnections,
  provider as pluginProvider,
  pluginState,
  pluginError,
};

function toPluginApp(entry: ApiPluginCatalogEntry): PluginApp {
  const app: PluginApp = {
    slug: entry.slug,
    name: entry.name?.trim() || entry.slug,
    summary: entry.description?.trim() ?? '',
  };
  if (entry.category) app.category = entry.category;
  if (entry.auth) app.auth = entry.auth;
  if (typeof entry.tool_count === 'number') app.toolCount = entry.tool_count;
  return app;
}

/**
 * The marketplace lists itself — the live catalogue carries a `composio` entry
 * describing Composio. It is the install path, not an app anyone connects here,
 * so the provider's own row is dropped. Matched against the `provider` the
 * response names rather than a hardcoded slug, so this keeps working if the
 * service ever changes marketplace.
 */
function withoutProviderItself(
  entries: readonly ApiPluginCatalogEntry[],
  providerSlug: string,
): ApiPluginCatalogEntry[] {
  const own = providerSlug.trim().toLowerCase();
  if (!own) return [...entries];
  return entries.filter((entry) => entry.slug.trim().toLowerCase() !== own);
}

/**
 * Which field of a connection row carries the catalogue slug is not yet
 * observed — the route has only ever answered an empty list — so every
 * plausible one is compared rather than one being guessed at.
 */
export function isPluginConnected(slug: string): boolean {
  if (catalogConnected().has(slug)) return true;
  return connections().some((row) =>
    [row.slug, row.toolkit_slug, row.plugin_id, row.brand, row.id].includes(slug),
  );
}

function clear(state: PluginLoadState, message: string): void {
  setApps([]);
  setConnections([]);
  setCatalogConnected(new Set<string>());
  setPluginState(state);
  setPluginError(message);
}

export async function reconcilePlugins(): Promise<void> {
  const client = botClient();
  if (!client) {
    clear('unavailable', 'The plugin catalogue is not reachable from this origin.');
    return;
  }

  setPluginState('loading');
  try {
    // The connections are the account's and the catalogue is public, so a
    // failure to read connections must not empty the catalogue with it.
    const [catalogue, linked] = await Promise.all([
      getPluginCatalog(client),
      listPluginConnections(client).catch(() => [] as ApiPluginConnection[]),
    ]);

    setProvider(catalogue.provider ?? '');

    if (catalogue.is_live === false) {
      clear('not-live', 'The marketplace did not answer, so there is no catalogue to show.');
      return;
    }

    const entries = withoutProviderItself(catalogue.items, catalogue.provider ?? '');
    setApps(entries.map(toPluginApp));
    setCatalogConnected(
      new Set(entries.filter((entry) => entry.connected === true).map((entry) => entry.slug)),
    );
    setConnections(linked);
    setPluginState(entries.length === 0 ? 'empty' : 'ready');
    setPluginError('');
  } catch (error) {
    const classified = classifyBotError(error);
    clear(
      classified.code === PLUGIN_UNAVAILABLE ? 'unavailable' : 'error',
      classified.message,
    );
  }
}

export type PluginConnectOutcome = 'connected' | 'needs-account';

/**
 * Connects one app, or reports that the session cannot.
 *
 * `needs-account` is a second line of defence behind the caller's own check on
 * the account: a session can look signed in here and still be a guest to the
 * service. Either way the answer is the sign-in screen, so the refusal is
 * returned rather than thrown — its message explains why a guest is refused,
 * which is not something to put in front of the user.
 */
export async function installPlugin(slug: string): Promise<PluginConnectOutcome> {
  const client = botClient();
  if (!client) throw new Error('Plugins are not reachable.');
  try {
    await connectPlugin(client, slug);
  } catch (error) {
    if (isAccountRequired(error)) return 'needs-account';
    throw error;
  }
  await reconcilePlugins();
  return 'connected';
}

export async function removePlugin(slug: string): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Plugins are not reachable.');
  await disconnectPlugin(client, slug);
  await reconcilePlugins();
}

export function resetPluginsForTests(): void {
  setProvider('');
  clear('idle', '');
}
