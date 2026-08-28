import { describe, expect, it } from 'vitest';

import { CortexApiClient, createStreamTransport } from '@cortex-ide/cortex-api';
import { createMockRealtime } from '@cortex-ide/cortex-api/test-doubles';

import { createCloudSessionHost } from '../cloud-session-host.ts';

describe('cloud session host', () => {
  it('refuses a local runtime so the browser never starts a harness', async () => {
    const mock = createMockRealtime('unavailable');
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: (async () => new Response('{}')) as typeof fetch }),
      transport: createStreamTransport(mock),
    });

    await expect(host.start({ prompt: 'fix lint', runtime: 'local' })).rejects.toThrow(
      /cannot start a local harness/i,
    );
    expect(mock.sent).toHaveLength(0);
  });

  it('sends a cloud turn and permission on the socket', async () => {
    const mock = createMockRealtime();
    await mock.connect();
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: (async () => new Response('{}')) as typeof fetch }),
      transport: createStreamTransport(mock),
    });

    const session = await host.start({ prompt: 'fix lint', runtime: 'cloud' });
    expect(session.runtime).toBe('cloud');
    expect(mock.sent[0]).toMatchObject({ type: 'code.turn', message: 'fix lint' });

    await host.resolvePermission(session.id, 'req_1', 'allow-always');
    expect(mock.sent[1]).toMatchObject({
      type: 'code.permission',
      decision: 'always',
      request_permission_id: 'req_1',
    });
  });

  it('treats a missing sessions route as an empty inbox', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ code: 'not_found', title: 'Not found', detail: 'No such endpoint.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: fetchImpl }),
      transport: createStreamTransport(createMockRealtime('unavailable')),
    });

    await expect(host.list()).resolves.toEqual([]);
  });
});
