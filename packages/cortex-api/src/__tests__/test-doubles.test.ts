import { describe, expect, it } from 'vitest';

import * as publicApi from '../index.ts';
import { withTestDoublesFlag } from '../test-flag.ts';
import { createMockProductSurface, createMockRealtime } from '../test-doubles.ts';

describe('public client', () => {
  it('does not export mock hosts from the production entry', () => {
    expect(publicApi).not.toHaveProperty('createMockProductSurface');
    expect(publicApi).not.toHaveProperty('createMockRealtime');
    expect(publicApi).toHaveProperty('createHttpProductSurface');
  });
});

describe('test doubles', () => {
  it('refuse to look like a live farm without the test flag', () => {
    withTestDoublesFlag(undefined, () => {
      expect(() => createMockProductSurface()).toThrow(/test double/i);
      expect(() => createMockRealtime()).toThrow(/test double/i);
    });
  });

  it('seed a surface only when the flag is set', async () => {
    const surface = withTestDoublesFlag('1', () =>
      createMockProductSurface({
        tasks: [{ id: 'todays-notes', title: "Today's notes" }],
        mascots: [{ id: 'mst_1', name: 'Scout' }],
        hosts: [{ id: 'h1', name: 'ana-mbp' }],
        sessions: [{ id: 'ses_1' }],
        library: [{ id: 'lib_1' }],
        plugins: [{ id: 'drive' }],
        notifications: [{ id: 'ntf_1' }],
      }),
    );
    expect(await surface.listPlanningTasks()).toEqual([
      { id: 'todays-notes', title: "Today's notes" },
    ]);
    expect((await surface.listMascots())[0]?.id).toBe('mst_1');
    expect((await surface.listCodeHosts())[0]?.name).toBe('ana-mbp');
    expect((await surface.listCodeSessions())[0]?.id).toBe('ses_1');
    expect((await surface.listLibraryItems())[0]?.id).toBe('lib_1');
    expect((await surface.listPlugins())[0]?.id).toBe('drive');
    expect((await surface.listNotifications())[0]?.id).toBe('ntf_1');
    expect(await surface.createVncTicket('mst_1')).toEqual({ ticket_hash: 'ticket-hash-only' });
    expect(await surface.pairCodeHost()).toEqual({ pairing_code: 'PAIR-TEST' });
    expect(await surface.createMascot({ name: 'New' })).toEqual({ id: 'mst_mock', name: 'New' });
    await surface.postScheduledResult('cnv_1', { task_id: 'todays-notes' });
    await surface.heartbeatCodeHost({ device_token: 'dev_1' });
    await surface.deleteMascot('mst_1');
    expect(await surface.listMascotVideos('mst_1')).toEqual([]);
    await surface.markNotificationRead('ntf_1');
  });
});
