/**
 * Chat library — saved answers and uploads. Starts empty on purpose.
 */

import { createSignal } from 'solid-js';

import { readJson, writeJson } from './persist.ts';

export type LibraryKind = 'answer' | 'upload';

export interface LibraryItem {
  id: string;
  title: string;
  kind: LibraryKind;
  excerpt: string;
  savedAt: number;
}

const STORAGE_KEY = 'cortex.library.v1';

const [items, setItems] = createSignal<LibraryItem[]>(readJson(STORAGE_KEY, []));

export { items as libraryItems };

export function addLibraryItem(item: Omit<LibraryItem, 'id' | 'savedAt'>): LibraryItem {
  const next: LibraryItem = {
    ...item,
    id: `lib_${Date.now().toString(36)}`,
    savedAt: Date.now(),
  };
  const list = [next, ...items()];
  setItems(list);
  writeJson(STORAGE_KEY, list);
  return next;
}
