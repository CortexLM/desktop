import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { CortexApiError } from '../errors.ts';
import { createHttpProductSurface, createMockProductSurface } from '../pending.ts';
import { stubFetch } from './fixtures.ts';

describe('product surface', () => {
  it('lists pending routes through the items envelope', async () => {
    const { fetch, calls } = stubFetch([
      { body: { items: [{ id: 'm1', name: 'Scout' }], has_more: false } },
      { body: { items: [{ id: 'h1', name: 'ana-mbp', status: 'connected' }], has_more: false } },
    ]);
    const surface = createHttpProductSurface(new CortexApiClient({ fetch }));

    const mascots = await surface.listMascots();
    const hosts = await surface.listCodeHosts();

    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/mascots');
    expect(calls[1]!.url).toBe('https://api.cortex.foundation/v1/code/hosts');
    expect(mascots[0]).toMatchObject({ id: 'm1', name: 'Scout' });
    expect(hosts[0]).toMatchObject({ name: 'ana-mbp' });
  });

  it('surfaces a live 404 instead of inventing an empty farm', async () => {
    const { fetch } = stubFetch([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    const surface = createHttpProductSurface(new CortexApiClient({ fetch }));
    const error = await surface.listNotifications().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CortexApiError);
    expect((error as CortexApiError).code).toBe('not_found');
  });

  it('keeps the mock behind the same interface', async () => {
    const surface = createMockProductSurface({
      tasks: [{ id: 'todays-notes', title: "Today's notes", cadence: 'daily' }],
    });
    expect(await surface.listMascots()).toEqual([]);
    expect(await surface.listPlanningTasks()).toEqual([
      { id: 'todays-notes', title: "Today's notes", cadence: 'daily' },
    ]);
  });
});
