import { afterEach, describe, expect, it, vi } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import { requestVncTicket } from '../vnc-ticket.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestVncTicket', () => {
  it('returns an https stream URL and never the ticket hash', async () => {
    const { fetch } = stubFetch([
      { body: { ticket_hash: 'abc', password: 'drop', stream_url: 'https://farm.example/vnc' } },
    ]);
    vi.spyOn(await import('../realtime-session.ts'), 'liveSession').mockReturnValue({
      client: new CortexApiClient({ fetch }),
    } as never);
    expect(await requestVncTicket('mst_1')).toBe('https://farm.example/vnc');
  });

  it('returns undefined without a session, on a live 404, or when only a hash arrives', async () => {
    expect(await requestVncTicket('mst_1')).toBeUndefined();
    const missing = stubFetch([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    vi.spyOn(await import('../realtime-session.ts'), 'liveSession').mockReturnValue({
      client: new CortexApiClient({ fetch: missing.fetch }),
    } as never);
    expect(await requestVncTicket('mst_1')).toBeUndefined();

    const hashOnly = stubFetch([{ body: { ticket_hash: 'abc' } }]);
    vi.spyOn(await import('../realtime-session.ts'), 'liveSession').mockReturnValue({
      client: new CortexApiClient({ fetch: hashOnly.fetch }),
    } as never);
    expect(await requestVncTicket('mst_1')).toBeUndefined();
  });
});
