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
  setPluginSurfaces,
  type ApiPluginCatalogEntry,
  type ApiPluginConnection,
  type PluginSurface,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import { readPluginSurfaces } from './plugin-surfaces.ts';

/** One row on the Plugins page, projected from the catalogue. */
export interface PluginApp {
  slug: string;
  name: string;
  summary: string;
  category?: string;
  /** `oauth2`, `api_key`, `none` … as the provider labels it. */
  auth?: string;
  toolCount?: number;
  /**
   * Chat, Bot, or both — the account's assignment for this connection. Only
   * meaningful once the app is connected; a catalogue row nobody has connected
   * carries the pair the page would ask for.
   */
  surfaces: readonly PluginSurface[];
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

function toPluginApp(
  entry: ApiPluginCatalogEntry,
  linked: readonly ApiPluginConnection[],
): PluginApp {
  const connection = linked.find((row) => carriesSlug(row, entry.slug));
  const app: PluginApp = {
    slug: entry.slug,
    name: entry.name?.trim() || entry.slug,
    summary: entry.description?.trim() ?? '',
    surfaces: readPluginSurfaces(connection?.surfaces ?? entry.surfaces),
  };
  if (entry.category) app.category = entry.category;
  if (entry.auth) app.auth = entry.auth;
  if (typeof entry.tool_count === 'number') app.toolCount = entry.tool_count;
  return app;
}

/**
 * Which field of a connection row carries the catalogue slug is not yet
 * observed — the route has only ever answered an empty list — so every
 * plausible one is compared rather than one being guessed at.
 */
function carriesSlug(row: ApiPluginConnection, slug: string): boolean {
  return [row.slug, row.toolkit_slug, row.plugin_id, row.brand, row.id].includes(slug);
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

export function isPluginConnected(slug: string): boolean {
  if (catalogConnected().has(slug)) return true;
  return connections().some((row) => carriesSlug(row, slug));
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
    setApps(entries.map((entry) => toPluginApp(entry, linked)));
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

/**
 * Why a write to the plugin service failed, in terms the page can put copy to.
 *
 * The service's own message never reaches the screen: it is written by whoever
 * threw it, and on this route it has already been seen carrying the name of the
 * marketplace we install through (`.rules/02-errors.md`).
 */
export type PluginWriteFailure =
  /** Plugins are not configured or not answering on this workspace. */
  | 'unavailable'
  /** The connection could not be opened. */
  | 'connect'
  /** The Chat / Bot assignment could not be saved. */
  | 'assign'
  /** This backend has no notion of assigning a connection to a surface yet. */
  | 'assign-unsupported';

export function classifyPluginWrite(
  error: unknown,
  intent: 'connect' | 'assign',
): PluginWriteFailure {
  const classified = classifyBotError(error);
  if (classified.code === PLUGIN_UNAVAILABLE) return 'unavailable';
  // 404 is a route this backend does not have; 405 is one that does not take a
  // PATCH. Either way the assignment is not a thing here yet, which is a
  // different sentence from "the save failed, try again".
  if (intent === 'assign' && (classified.status === 404 || classified.status === 405)) {
    return 'assign-unsupported';
  }
  return intent;
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
export async function installPlugin(
  slug: string,
  surfaces: readonly PluginSurface[],
): Promise<PluginConnectOutcome> {
  const client = botClient();
  if (!client) throw new Error('Plugins are not reachable.');
  try {
    await connectPlugin(client, slug, surfaces);
  } catch (error) {
    if (isAccountRequired(error)) return 'needs-account';
    throw error;
  }
  await reconcilePlugins();
  return 'connected';
}

/**
 * Moves a connection between Chat and Bot.
 *
 * The service is asked first and the page re-read afterwards, so the switches
 * show the assignment the account actually holds. A write that fails leaves
 * them where they were — a switch that moved locally would claim a filter the
 * agent loops are not applying.
 */
export async function assignPluginSurfaces(
  slug: string,
  surfaces: readonly PluginSurface[],
): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Plugins are not reachable.');
  await setPluginSurfaces(client, slug, surfaces);
  await reconcilePlugins();
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
