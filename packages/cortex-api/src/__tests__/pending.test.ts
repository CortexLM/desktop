import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { CortexApiError } from '../errors.ts';
import { createMockProductSurface } from '../test-doubles.ts';
import { createHttpProductSurface } from '../pending.ts';
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
    expect(await surface.createVncTicket('mst_1')).toEqual({ ticket_hash: 'ticket-hash-only' });
    expect(await surface.pairCodeHost()).toEqual({ pairing_code: 'PAIR-TEST' });
  });
});

describe('control plane', () => {
  it('posts a scheduled result onto a known conversation', async () => {
    const { fetch, calls } = stubFetch([{ body: {} }]);
    const surface = createHttpProductSurface(new CortexApiClient({ fetch }));
    await surface.postScheduledResult('cnv_01ABC', { task_id: 'todays-notes', message: 'done' });
    expect(calls[0]!.url).toContain('/v1/conversations/cnv_01ABC/scheduled-results');
    expect(calls[0]!.body).toEqual({ task_id: 'todays-notes', message: 'done' });
  });

  it('returns a pairing code and drops a stored hash', async () => {
    const { fetch } = stubFetch([
      { body: { pairing_code: 'AB12-CD34', pairing_hash: 'should-not-leave', expires_in: 60 } },
    ]);
    const surface = createHttpProductSurface(new CortexApiClient({ fetch }));
    expect(await surface.pairCodeHost()).toEqual({ pairing_code: 'AB12-CD34', expires_in: 60 });
  });

  it('heartbeats with a device token only', async () => {
    const { fetch, calls } = stubFetch([{ body: {} }]);
    const surface = createHttpProductSurface(new CortexApiClient({ fetch }));
    await surface.heartbeatCodeHost({ device_token: 'dev_1', host_id: 'host_1' });
    expect(calls[0]!.url).toContain('/v1/code/hosts/heartbeat');
    expect(calls[0]!.body).toEqual({ device_token: 'dev_1', host_id: 'host_1' });
  });

  it('returns a VNC ticket hash and never a password', async () => {
    const { fetch } = stubFetch([{ body: { ticket_hash: 'abc', password: 'secret', vnc_password: 'nope' } }]);
    const surface = createHttpProductSurface(new CortexApiClient({ fetch }));
    expect(await surface.createVncTicket('mst_1')).toEqual({ ticket_hash: 'abc' });
  });

  it('keeps a live 404 as not_found on control-plane writes', async () => {
    const { fetch } = stubFetch([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    const surface = createHttpProductSurface(new CortexApiClient({ fetch }));
    const error = await surface.markNotificationRead('ntf_1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CortexApiError);
    expect((error as CortexApiError).code).toBe('not_found');
  });

  it('lists remaining product rows and writes mascots through the HTTP surface', async () => {
    const { fetch, calls } = stubFetch([
      { body: { items: [{ id: 'ses_1', title: 'Fix auth' }], has_more: false } },
      { body: { items: [{ id: 'todays-notes', title: "Today's notes" }], has_more: false } },
      { body: { items: [{ id: 'lib_1', title: 'Spec' }], has_more: false } },
      { body: { items: [], has_more: false } },
      { body: { id: 'mst_2', name: 'Scout' } },
      { body: {} },
      { body: { items: [{ id: 'vid_1', title: 'Clip' }], has_more: false } },
      { body: { pairing_code: 'ZX99', host_id: 'host_9' } },
    ]);
    const surface = createHttpProductSurface(new CortexApiClient({ fetch }));

    expect((await surface.listCodeSessions())[0]?.id).toBe('ses_1');
    expect((await surface.listPlanningTasks())[0]?.id).toBe('todays-notes');
    expect((await surface.listLibraryItems())[0]?.title).toBe('Spec');
    expect(await surface.listPlugins()).toEqual([]);
    expect((await surface.createMascot({ name: 'Scout' })).id).toBe('mst_2');
    await surface.deleteMascot('mst_2');
    expect((await surface.listMascotVideos('mst_2'))[0]?.id).toBe('vid_1');
    expect(await surface.pairCodeHost()).toEqual({ pairing_code: 'ZX99', host_id: 'host_9' });
    expect(calls[4]!.method).toBe('POST');
    expect(calls[5]!.method).toBe('DELETE');
  });
});
