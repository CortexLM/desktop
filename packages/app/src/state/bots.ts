/**
 * Bot mascots, held only for as long as the API says they exist.
 *
 * Nothing about a mascot is persisted in the client. A cache of the last list
 * used to seed this store at module load, which meant the first paint of /bot
 * — and every paint after the service started refusing — showed a roster that
 * came from the browser rather than from the account. Those rows were
 * clickable, and the mascot they opened had a computer this file had invented.
 * An empty list next to "New mascot" is the honest answer when the API has not
 * answered yet.
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
  type ComputerKind,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import {
  mapComputer,
  mapMascot,
  mapMessage,
  mapVideo,
  type Mascot,
  type MascotFace,
  type MascotLook,
} from './bot-map.ts';

export type {
  BotComputer,
  BotMessage,
  BotVideo,
  ComputerStatus,
  Mascot,
  MascotFace,
  MascotLook,
} from './bot-map.ts';

export {
  computerIsOffline,
  computerIsMissing,
  computerLabel,
  isPendingAsk,
  isPendingSecret,
} from './bot-map.ts';

export type BotLoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

const [mascots, setMascots] = createSignal<Mascot[]>([]);
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
    setMascots(rows.map(mapMascot));
    setLoadState('ready');
    setLoadError('');
  } catch (error) {
    applyListError(error);
  }
}

export async function createMascot(
  name: string,
  look: MascotLook,
  face: MascotFace,
  computerKind?: ComputerKind,
): Promise<Mascot> {
  const client = botClient();
  if (!client) throw new Error('The Bot API is not connected from this origin.');
  const created = await apiCreate(
    client,
    appearanceWrite(name.trim() || 'Untitled mascot', look, face, computerKind),
  );
  const mascot = mapMascot(created);
  setMascots((current) => [mascot, ...current.filter((row) => row.id !== mascot.id)]);
  return mascot;
}

/**
 * Renames a mascot or changes its look and resting face.
 *
 * The settings screen was read-only: it printed the old shape and colour as prose
 * with no control to change either, even though `PATCH /v1/mascots/{id}` was
 * already in the client. The API's answer replaces the local row rather than the
 * requested patch being applied optimistically, so what is shown is what the
 * service stored.
 */
export async function updateMascot(
  id: string,
  patch: { name?: string; look?: MascotLook; face?: MascotFace },
): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('The Bot API is not connected from this origin.');
  const updated = await apiPatch(client, id, appearancePatch(patch));
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

/**
 * Loads one mascot and everything hanging off it.
 *
 * Adds the row when the list does not have it, rather than only patching an
 * existing one. Opening /bot/{id} directly — a reload, a bookmark, a link — is
 * the common case and there is no list in memory yet; the old behaviour patched
 * nothing and the screen said "Mascot not found" about a mascot the service was
 * perfectly willing to return. A mascot the service does not know still ends up
 * absent, which is what that message is for.
 */
export async function hydrateMascot(id: string): Promise<void> {
  const client = botClient();
  if (!client) return;
  const bundle = await loadMascotBundle(id);
  const base = mascotById(id) ?? (bundle.detail ? mapMascot(bundle.detail) : undefined);
  if (!base) return;
  const hydrated = mergeHydration(base, bundle);
  setMascots((current) =>
    current.some((mascot) => mascot.id === id)
      ? current.map((mascot) => (mascot.id === id ? hydrated : mascot))
      : [hydrated, ...current],
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

/**
 * Turns a failed list into the state the screen reports.
 *
 * The rows go too. Keeping the previous answer on screen under an error banner
 * would claim the account still owns mascots that the service just declined to
 * confirm — a farm scaled to zero and an expired session look identical from
 * here, and neither is evidence that anything exists.
 */
function applyListError(error: unknown): void {
  const classified = classifyBotError(error);
  setLoadState(isCortexApiError(error) && error.status === 404 ? 'unavailable' : 'error');
  setLoadError(classified.message);
  setMascots([]);
}

/** Send look/face and keep color/shape aliases so an older backend still stores identity. */
function appearanceWrite(
  name: string,
  look: MascotLook,
  face: MascotFace,
  computerKind?: ComputerKind,
) {
  return {
    name,
    look,
    face,
    color: look,
    shape: face,
    ...(computerKind ? { computer_kind: computerKind } : {}),
  };
}

function appearancePatch(patch: { name?: string; look?: MascotLook; face?: MascotFace }) {
  return {
    ...patch,
    ...(patch.look ? { color: patch.look } : {}),
    ...(patch.face ? { shape: patch.face } : {}),
  };
}
