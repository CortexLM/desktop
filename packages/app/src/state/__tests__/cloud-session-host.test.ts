import { describe, expect, it, vi } from 'vitest';

import { CortexApiClient, createStreamTransport } from '@cortex-ide/cortex-api';
import { createMockRealtime } from '@cortex-ide/cortex-api/test-doubles';

import { createCloudSessionHost } from '../cloud-session-host.ts';

/** A backend with none of the Code control-plane routes. */
function notFound(): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({ code: 'not_found', title: 'Not found', detail: 'No such endpoint.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('cloud session host', () => {
  it('refuses a local runtime so the browser never starts a harness', async () => {
    const mock = createMockRealtime('unavailable');
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: notFound() }),
      transport: createStreamTransport(mock),
    });

    await expect(host.start({ prompt: 'fix lint', runtime: 'local' })).rejects.toThrow(
      /cannot start a local harness/i,
    );
    expect(mock.sent).toHaveLength(0);
  });

  it('starts over HTTP so the run keeps the id the service assigned', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ id: 'ses_live', title: 'fix lint', status: 'running', runtime: 'cloud' }),
    ) as unknown as typeof fetch;
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: fetchImpl }),
      transport: createStreamTransport(createMockRealtime('unavailable')),
    });

    const session = await host.start({ prompt: 'fix lint', runtime: 'cloud', repo: 'a/b' });

    // The service's id, not a locally minted one: a client-invented id cannot be
    // followed up on or reopened later.
    expect(session.id).toBe('ses_live');
    expect(session.status).toBe('running');
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(url).toContain('/v1/code/sessions');
    expect(JSON.parse(init.body)).toMatchObject({ prompt: 'fix lint', repository: 'a/b' });
  });

  it('falls back to the socket when the backend has no sessions route', async () => {
    const mock = createMockRealtime();
    await mock.connect();
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: notFound() }),
      transport: createStreamTransport(mock),
    });

    const session = await host.start({ prompt: 'fix lint', runtime: 'cloud' });

    // `queued`, not `running`: nothing confirmed the run began.
    expect(session.status).toBe('queued');
    expect(session.runtime).toBe('cloud');
    expect(mock.sent[0]).toMatchObject({ type: 'code.turn', message: 'fix lint' });

    await host.resolvePermission(session.id, 'req_1', 'allow-always');
    expect(mock.sent[1]).toMatchObject({
      type: 'code.permission',
      decision: 'always',
      request_permission_id: 'req_1',
    });
  });

  it('answers a permission over HTTP when the socket cannot carry it', async () => {
    const fetchImpl = vi.fn(async () => json({})) as unknown as typeof fetch;
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: fetchImpl }),
      // An SSE fallback is read-only, so a blocked run could not otherwise be answered.
      transport: createStreamTransport(createMockRealtime('unavailable')),
    });

    await host.resolvePermission('ses_1', 'req_9', 'deny');

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(url).toContain('/v1/code/sessions/ses_1/permissions');
    expect(JSON.parse(init.body)).toEqual({
      request_permission_id: 'req_9',
      decision: 'deny',
    });
  });

  it('reads a session detail so the workbench survives a reload', async () => {
    const host = createCloudSessionHost({
      client: new CortexApiClient({
        fetch: (async () =>
          json({
            id: 'ses_1',
            title: 'fix lint',
            status: 'review',
            runtime: 'cloud',
            repository: 'cortex/app',
            timeline: [
              { id: 'e1', kind: 'prompt', text: 'fix lint' },
              { id: 'e2', kind: 'reply', text: 'done' },
            ],
            changes: [{ path: 'a.ts', additions: 2, deletions: 1, patch: '@@' }],
            permission_request: { id: 'req_2', summary: 'run tests' },
          })) as typeof fetch,
      }),
      transport: createStreamTransport(createMockRealtime('unavailable')),
    });

    const detail = await host.get('ses_1');

    expect(detail?.status).toBe('review');
    expect(detail?.repo).toBe('cortex/app');
    expect(detail?.events.map((event) => event.kind)).toEqual(['prompt', 'reply', 'permission']);
    expect(detail?.files[0]).toMatchObject({ path: 'a.ts', additions: 2 });
  });

  it('treats a missing sessions route as an empty inbox and a stale link as null', async () => {
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: notFound() }),
      transport: createStreamTransport(createMockRealtime('unavailable')),
    });

    await expect(host.list()).resolves.toEqual([]);
    await expect(host.get('ses_gone')).resolves.toBeNull();
    await expect(host.stop('ses_gone')).resolves.toBeNull();
    await expect(host.archive('ses_gone', true)).resolves.toBeNull();
    await expect(host.listRepositories()).resolves.toEqual([]);
    // A browser has no folder picker, and it says so rather than appearing to work.
    await expect(host.openWorkspace()).resolves.toEqual({ cancelled: true, repositories: [] });
  });

  it('maps repositories and drops rows with no usable identifier', async () => {
    const host = createCloudSessionHost({
      client: new CortexApiClient({
        fetch: (async () =>
          json({
            items: [
              { full_name: 'cortex/app', name: 'app', default_branch: 'main' },
              { default_branch: 'main' },
            ],
          })) as typeof fetch,
      }),
      transport: createStreamTransport(createMockRealtime('unavailable')),
    });

    const repositories = await host.listRepositories();

    expect(repositories).toEqual([
      { id: 'cortex/app', name: 'app', branches: ['main'], dirty: false, branch: 'main' },
    ]);
  });

  it('reports progress to subscribers until they unsubscribe', () => {
    const host = createCloudSessionHost({
      client: new CortexApiClient({ fetch: notFound() }),
      transport: createStreamTransport(createMockRealtime('unavailable')),
    });

    const stop = host.onProgress(() => {});
    expect(stop()).toBe(true);
  });
});
