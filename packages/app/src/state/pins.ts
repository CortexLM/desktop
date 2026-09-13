/**
 * Pinned chats and Code sessions.
 *
 * Pins are a local preference over rows the service already returned — never a
 * source of conversations or sessions. An id that is no longer in the live list is
 * simply omitted.
 */

import { createSignal } from 'solid-js';

import { readJson, writeJson } from './persist.ts';

const KEY = 'cortex.pins';

export interface PinLists {
  chats: readonly string[];
  sessions: readonly string[];
}

const empty: PinLists = { chats: [], sessions: [] };

const [pins, setPins] = createSignal<PinLists>(readJson<PinLists>(KEY, empty));

function persist(next: PinLists): void {
  setPins(next);
  writeJson(KEY, next);
}

function toggleId(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [id, ...ids];
}

export function pinnedIds(kind: keyof PinLists): readonly string[] {
  return pins()[kind];
}

export function isPinned(kind: keyof PinLists, id: string): boolean {
  return pins()[kind].includes(id);
}

export function togglePin(kind: keyof PinLists, id: string): void {
  persist({ ...pins(), [kind]: toggleId(pins()[kind], id) });
}

export function splitPinned<T extends { id: string }>(
  rows: readonly T[],
  kind: keyof PinLists,
): { pinned: T[]; recents: T[] } {
  const order = pins()[kind];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pinned = order.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
  const pinnedIds = new Set(pinned.map((row) => row.id));
  return { pinned, recents: rows.filter((row) => !pinnedIds.has(row.id)) };
}

export function resetPinsForTests(): void {
  persist(empty);
}
