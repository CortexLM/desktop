/**
 * Chat library — saved answers and uploads, held on the account.
 *
 * This was the emptiest of the `localStorage` stores: `addLibraryItem` existed and
 * nothing ever called it, so the screen's empty state was permanent and its copy
 * ("Save an answer from a conversation and it will land here") described something
 * no control could do.
 *
 * Now the conversation screen can actually save, and it saves to the account —
 * which is what "kept" has to mean for a library whose promise is that it carries
 * across machines.
 */

import {
  createLibraryItem,
  deleteLibraryItem,
  listLibraryItems,
  type ApiLibraryItem,
} from '@cortex-ide/cortex-api';

import { createRemoteCollection } from './remote-collection.ts';

export type LibraryKind = 'answer' | 'upload';

export interface LibraryItem {
  id: string;
  title: string;
  kind: LibraryKind;
  excerpt: string;
  savedAt: number;
}

function readString(row: ApiLibraryItem, key: string): string | undefined {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export function toLibraryItem(row: ApiLibraryItem): LibraryItem {
  const created = readString(row, 'created_at');
  const parsed = created ? Date.parse(created) : Number.NaN;
  return {
    id: row.id,
    title: row.title ?? 'Saved item',
    kind: row.kind === 'upload' ? 'upload' : 'answer',
    excerpt: readString(row, 'excerpt') ?? '',
    savedAt: Number.isNaN(parsed) ? 0 : parsed,
  };
}

const collection = createRemoteCollection<LibraryItem>({
  label: 'Your library',
  load: async (client) => (await listLibraryItems(client)).map(toLibraryItem),
});

export const libraryItems = collection.items;
export const libraryState = collection.state;
export const libraryError = collection.error;
export const loadLibrary = collection.reload;
export const resetLibraryForTests = collection.reset;

/**
 * Saves an answer.
 *
 * `conversationId` is carried so a saved answer stays linked to the thread it came
 * from — a library of orphaned excerpts is a worse library.
 */
export function saveToLibrary(item: {
  title: string;
  kind?: LibraryKind;
  excerpt?: string;
  conversationId?: string;
}): Promise<void> {
  return collection.mutate((client) =>
    createLibraryItem(client, {
      title: item.title,
      kind: item.kind ?? 'answer',
      ...(item.excerpt ? { excerpt: item.excerpt } : {}),
      ...(item.conversationId ? { conversation_id: item.conversationId } : {}),
    }),
  );
}

export function removeLibraryItem(id: string): Promise<void> {
  return collection.mutate((client) => deleteLibraryItem(client, id));
}
