import { afterEach, describe, expect, it, vi } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import { requestVncTicket } from '../vnc-ticket.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestVncTicket', () => {
  it('returns the hash only when a live session exists', async () => {
    const { fetch } = stubFetch([{ body: { ticket_hash: 'abc', password: 'drop' } }]);
    vi.spyOn(await import('../realtime-session.ts'), 'liveSession').mockReturnValue({
      client: new CortexApiClient({ fetch }),
    } as never);
    expect(await requestVncTicket('mst_1')).toBe('abc');
  });

  it('returns undefined without a session or on a live 404', async () => {
    expect(await requestVncTicket('mst_1')).toBeUndefined();
    const { fetch } = stubFetch([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    vi.spyOn(await import('../realtime-session.ts'), 'liveSession').mockReturnValue({
      client: new CortexApiClient({ fetch }),
    } as never);
    expect(await requestVncTicket('mst_1')).toBeUndefined();
  });
});
