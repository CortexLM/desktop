/**
 * The Bot roster is whatever the API just said it was, and nothing else.
 *
 * These are regression tests for a store that seeded itself from
 * `localStorage['cortex.bots.cache.v2']` at module load. A first visit, a signed
 * out account and a farm scaled to zero all rendered whichever mascots the
 * browser happened to be holding — rows that opened a conversation and a
 * computer that no service had confirmed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import { setBotClientForTests } from '../bot-client.ts';
import {
  hydrateMascot,
  loadError,
  loadState,
  mascotById,
  mascots,
  reconcileMascots,
  resetBotsForTests,
} from '../bots.ts';

const CACHE_KEYS = ['cortex.bots.cache.v2', 'cortex.bots.cache', 'cortex.bots'];

beforeEach(() => {
  globalThis.localStorage?.clear();
  resetBotsForTests();
});

afterEach(() => {
  globalThis.localStorage?.clear();
  setBotClientForTests(undefined);
  resetBotsForTests();
});

function clientFor(responses: Parameters<typeof stubFetch>[0]) {
  const stub = stubFetch(responses);
  setBotClientForTests(new CortexApiClient({ fetch: stub.fetch }));
  return stub;
}

describe('the mascot list has no seed', () => {
  it('starts empty on a first visit', () => {
    expect(mascots()).toEqual([]);
    expect(loadState()).toBe('idle');
  });

  it('ignores a roster left in localStorage by an older build', async () => {
    for (const key of CACHE_KEYS) {
      globalThis.localStorage?.setItem(
        key,
        JSON.stringify([
          { id: 'mst_sprite', name: 'Sprite', shape: 'round', color: 'green' },
          { id: 'mst_finch', name: 'Finch', shape: 'tall', color: 'ink' },
        ]),
      );
    }
    resetBotsForTests();
    expect(mascots()).toEqual([]);

    clientFor([{ body: { items: [], has_more: false } }]);
    await reconcileMascots();

    expect(loadState()).toBe('ready');
    expect(mascots()).toEqual([]);
  });

  it('writes nothing to localStorage when the API answers with mascots', async () => {
    clientFor([{ body: { items: [{ id: 'mst_1', name: 'Scout' }], has_more: false } }]);
    await reconcileMascots();

    expect(mascots().map((mascot) => mascot.id)).toEqual(['mst_1']);
    expect(globalThis.localStorage?.length ?? 0).toBe(0);
  });

  it('shows the error and drops the rows when the API fails', async () => {
    clientFor([
      { body: { items: [{ id: 'mst_1', name: 'Scout' }], has_more: false } },
      { status: 401, body: { code: 'unauthenticated', message: 'Sign in first.' } },
    ]);
    await reconcileMascots();
    expect(mascots()).toHaveLength(1);

    await reconcileMascots();

    expect(loadState()).toBe('error');
    expect(loadError()).not.toBe('');
    expect(mascots()).toEqual([]);
  });

  it('reports an unreachable Bot service rather than a remembered list', async () => {
    clientFor([{ body: { items: [{ id: 'mst_1', name: 'Scout' }], has_more: false } }]);
    await reconcileMascots();
    expect(mascots()).toHaveLength(1);

    setBotClientForTests(undefined);
    await reconcileMascots();

    expect(loadState()).toBe('unavailable');
    expect(mascots()).toEqual([]);
  });
});

describe('opening a mascot directly', () => {
  it('fetches it from the API when no list has been loaded', async () => {
    clientFor([
      { body: { id: 'mst_1', name: 'Scout', computer: { id: 'pc_1', status: 'running' } } },
      { body: { items: [{ id: 'msg_1', kind: 'send_to_user', text: 'hi' }], has_more: false } },
      { body: { items: [], has_more: false } },
      { body: { id: 'pc_1', status: 'running' } },
    ]);

    await hydrateMascot('mst_1');

    expect(mascotById('mst_1')?.name).toBe('Scout');
    expect(mascotById('mst_1')?.messages[0]?.content).toBe('hi');
  });

  it('leaves the list empty when the service does not know the mascot', async () => {
    clientFor([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such mascot.' } },
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such mascot.' } },
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such mascot.' } },
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such mascot.' } },
    ]);

    await hydrateMascot('mst_missing');

    expect(mascotById('mst_missing')).toBeUndefined();
    expect(mascots()).toEqual([]);
  });
});
