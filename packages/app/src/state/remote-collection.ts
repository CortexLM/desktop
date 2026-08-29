/**
 * A list that lives on the account, not in this browser.
 *
 * Planning, Projects, Library and Research all used to be `localStorage` signals.
 * That reads as working and is not: a scheduled job that only exists in one
 * browser profile has not been scheduled, a project a second device cannot see is
 * not a project, and a library that a cleared cache deletes was never saved.
 *
 * So every one of them is a remote collection. The shared part is the lifecycle,
 * because getting it wrong is what makes a broken screen look empty:
 *
 *   - `loading` while the first read is in flight, so the empty state does not
 *     flash before the data arrives;
 *   - `empty` only when the service actually answered with nothing;
 *   - `unsupported` when the route 404s — this backend has no such feature, which
 *     is not the same as an account with nothing in it;
 *   - `disconnected` when there is no client at all, which is the browser on an
 *     origin that may not call the API;
 *   - `error` for everything else, carrying the message rather than swallowing it.
 *
 * Writes go through `mutate`, which re-reads afterwards. Optimistic local edits
 * are deliberately not offered: the whole point is that the service is the record,
 * and a row that appears before the service accepted it is the localStorage bug
 * with extra steps.
 */

import { createSignal, type Accessor } from 'solid-js';

import type { CortexApiClient } from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import { isRouteMissing, missingRouteCopy } from './surface-error.ts';

export type RemoteState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unsupported'
  | 'disconnected'
  | 'error';

export interface RemoteCollection<T> {
  items: Accessor<readonly T[]>;
  state: Accessor<RemoteState>;
  error: Accessor<string>;
  /** Re-reads from the service. Safe to call from a route effect. */
  reload: () => Promise<void>;
  /**
   * Runs a write and then re-reads.
   *
   * Rethrows so a caller can show the failure next to the control that caused it;
   * the collection's own `error` describes the *list*, which is a different
   * message from "this save did not go through".
   */
  mutate: (work: (client: CortexApiClient) => Promise<unknown>) => Promise<void>;
  /** Test seam: drops everything back to `idle`. */
  reset: () => void;
}

export interface RemoteCollectionOptions<T> {
  /** What this list is, for the copy: "Planning", "Your library". */
  label: string;
  load: (client: CortexApiClient) => Promise<T[]>;
}

export function createRemoteCollection<T>(
  options: RemoteCollectionOptions<T>,
): RemoteCollection<T> {
  const [items, setItems] = createSignal<readonly T[]>([]);
  const [state, setState] = createSignal<RemoteState>('idle');
  const [error, setError] = createSignal('');

  const fail = (next: RemoteState, message: string) => {
    setItems([]);
    setState(next);
    setError(message);
  };

  const reload = async (): Promise<void> => {
    const client = botClient();
    if (!client) {
      fail('disconnected', `${options.label} needs a connection to Cortex.`);
      return;
    }

    setState('loading');
    setError('');
    try {
      const rows = await options.load(client);
      setItems(rows);
      setState(rows.length === 0 ? 'empty' : 'ready');
    } catch (caught) {
      if (isRouteMissing(caught)) {
        fail('unsupported', missingRouteCopy(options.label));
        return;
      }
      fail('error', caught instanceof Error ? caught.message : String(caught));
    }
  };

  return {
    items,
    state,
    error,
    reload,
    mutate: async (work) => {
      const client = botClient();
      if (!client) throw new Error(`${options.label} needs a connection to Cortex.`);
      await work(client);
      await reload();
    },
    reset: () => {
      setItems([]);
      setState('idle');
      setError('');
    },
  };
}

/**
 * Maps a collection's state onto what `HonestState` renders.
 *
 * `unsupported` and `disconnected` both render as errors rather than as empty,
 * which is the whole reason they are distinct states: a screen that showed its
 * empty state for a missing route would be claiming the account has nothing.
 */
export function honestStateFor(
  state: RemoteState,
): 'loading' | 'empty' | 'error' | 'none' {
  if (state === 'loading' || state === 'idle') return 'loading';
  if (state === 'empty') return 'empty';
  if (state === 'ready') return 'none';
  return 'error';
}
