import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import { setBotClientForTests } from '../bot-client.ts';
import { probeDesktopTransport, requestVncTicket, resetDesktopTransportForTests, streamUrl } from '../vnc-ticket.ts';

afterEach(() => {
  setBotClientForTests(undefined);
  resetDesktopTransportForTests();
});

describe('requestVncTicket', () => {
  it('returns the hash only when a live session exists', async () => {
    const { fetch } = stubFetch([{ body: { ticket_hash: 'abc', password: 'drop' } }]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    expect(await requestVncTicket('mst_1')).toEqual({ ticket_hash: 'abc' });
  });

  it('returns undefined without a session or on a live 404', async () => {
    expect(await requestVncTicket('mst_1')).toBeUndefined();
    const { fetch } = stubFetch([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    expect(await requestVncTicket('mst_1')).toBeUndefined();
  });

  it('keeps a stream URL and drops password-shaped query keys', async () => {
    const { fetch } = stubFetch([
      {
        body: {
          ticket_hash: 'abc',
          password: 'drop',
          stream_url: 'https://farm.example/novnc/abc?password=nope',
        },
      },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    await probeDesktopTransport('mst_1');
    expect(streamUrl()).toBe('https://farm.example/novnc/abc');
  });
});
