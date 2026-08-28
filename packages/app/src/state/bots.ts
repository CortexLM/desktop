/**
 * Bot mascots. The API is the source of truth. localStorage only caches the
 * last successful list (reconcile). Create / send / hibernate / videos never
 * write the cache.
 */

import { createSignal } from 'solid-js';

import {
  classifyBotError,
  createMascot as apiCreate,
  deleteMascot as apiDelete,
  patchMascot as apiPatch,
  getComputer,
  getMascot,
  isCortexApiError,
  listMascotMessages,
  listMascots,
  listMascotVideos,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import {
  mapComputer,
  mapMascot,
  mapMessage,
  mapVideo,
  type Mascot,
  type MascotColor,
  type MascotShape,
} from './bot-map.ts';
import { readJson, writeJson } from './persist.ts';

export type {
  BotComputer,
  BotMessage,
  BotVideo,
  ComputerStatus,
  Mascot,
  MascotColor,
  MascotShape,
} from './bot-map.ts';

export {
  computerIsOffline,
  isPendingAsk,
  isPendingSecret,
} from './bot-map.ts';

const CACHE_KEY = 'cortex.bots.cache.v2';

export type BotLoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

const [mascots, setMascots] = createSignal<Mascot[]>(readCache());
const [loadState, setLoadState] = createSignal<BotLoadState>('idle');
const [loadError, setLoadError] = createSignal<string>('');

export { mascots, loadState, loadError };

export function mascotById(id: string): Mascot | undefined {
  return mascots().find((mascot) => mascot.id === id);
}

export async function reconcileMascots(): Promise<void> {
  const client = botClient();
  if (!client) {
    setLoadState('unavailable');
    setLoadError('The Bot API is not connected from this origin.');
    setMascots([]);
    return;
  }
  setLoadState('loading');
  try {
    const rows = await listMascots(client);
    const next = rows.map(mapMascot);
    setMascots(next);
    writeJson(CACHE_KEY, summaries(next));
    setLoadState('ready');
    setLoadError('');
  } catch (error) {
    applyListError(error);
  }
}

export async function createMascot(
  name: string,
  shape: MascotShape,
  color: MascotColor,
): Promise<Mascot> {
  const client = botClient();
  if (!client) throw new Error('The Bot API is not connected from this origin.');
  const created = await apiCreate(client, { name: name.trim() || 'Untitled mascot', shape, color });
  const mascot = mapMascot(created);
  setMascots((current) => [mascot, ...current.filter((row) => row.id !== mascot.id)]);
  return mascot;
}

/**
 * Renames a mascot or changes its shape and colour.
 *
 * The settings screen was read-only: it printed the shape and colour as prose with
 * no control to change either, even though `PATCH /v1/mascots/{id}` was already in
 * the client. The API's answer replaces the local row rather than the requested
 * patch being applied optimistically, so what is shown is what the service stored.
 */
export async function updateMascot(
  id: string,
  patch: { name?: string; shape?: MascotShape; color?: MascotColor },
): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('The Bot API is not connected from this origin.');
  const updated = await apiPatch(client, id, patch);
  const mapped = mapMascot(updated);
  setMascots((current) =>
    current.map((mascot) =>
      mascot.id === id
        ? { ...mapped, messages: mascot.messages, videos: mascot.videos, computer: mascot.computer }
        : mascot,
    ),
  );
}

/**
 * Deletes a mascot.
 *
 * Its dedicated computer goes with it — that is the service's doing, not something
 * this client can undo, which is why the screen asks before calling this.
 */
export async function removeMascot(id: string): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('The Bot API is not connected from this origin.');
  await apiDelete(client, id);
  setMascots((current) => current.filter((mascot) => mascot.id !== id));
}

export async function hydrateMascot(id: string): Promise<void> {
  const client = botClient();
  if (!client) return;
  const bundle = await loadMascotBundle(id);
  setMascots((current) =>
    current.map((mascot) => (mascot.id === id ? mergeHydration(mascot, bundle) : mascot)),
  );
}

export function replaceMascot(next: Mascot): void {
  setMascots((current) => current.map((mascot) => (mascot.id === next.id ? next : mascot)));
}

export function patchMascotState(id: string, patch: (mascot: Mascot) => Mascot): void {
  setMascots((current) => current.map((mascot) => (mascot.id === id ? patch(mascot) : mascot)));
}

export function resetBotsForTests(): void {
  setMascots([]);
  setLoadState('idle');
  setLoadError('');
}

async function loadMascotBundle(id: string) {
  const client = botClient()!;
  const [detail, messages, videos, computer] = await Promise.all([
    getMascot(client, id).catch(() => undefined),
    listMascotMessages(client, id).catch(() => undefined),
    listMascotVideos(client, id).catch(() => undefined),
    getComputer(client, id).catch(() => undefined),
  ]);
  return { detail, messages, videos, computer };
}

function mergeHydration(
  mascot: Mascot,
  bundle: Awaited<ReturnType<typeof loadMascotBundle>>,
): Mascot {
  const mapped = bundle.detail ? mapMascot(bundle.detail) : mascot;
  return {
    ...mapped,
    messages: bundle.messages ? bundle.messages.map(mapMessage) : mascot.messages,
    videos: bundle.videos ? bundle.videos.map(mapVideo) : mascot.videos,
    computer: bundle.computer
      ? mapComputer(bundle.detail ?? { id: mascot.id }, bundle.computer)
      : mapped.computer,
  };
}

function applyListError(error: unknown): void {
  const classified = classifyBotError(error);
  setLoadState(isCortexApiError(error) && error.status === 404 ? 'unavailable' : 'error');
  setLoadError(classified.message);
}

function summaries(rows: Mascot[]): Array<{ id: string; name: string; shape: string; color: string }> {
  return rows.map((row) => ({ id: row.id, name: row.name, shape: row.shape, color: row.color }));
}

function readCache(): Mascot[] {
  const rows = readJson<Array<{ id: string; name?: string; shape?: string; color?: string }>>(
    CACHE_KEY,
    [],
  );
  return rows.map((row) =>
    mapMascot({
      id: row.id,
      name: row.name,
      shape: row.shape,
      color: row.color,
    }),
  );
}
