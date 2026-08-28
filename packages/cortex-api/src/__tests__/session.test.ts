import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { stubFetch } from './fixtures.ts';

describe('session writes', () => {
  it('unwraps API keys from a bare array, { data }, or { api_keys }', async () => {
    const { fetch, calls } = stubFetch([
      { body: [{ id: 'key_1', name: 'ci' }] },
      { body: { data: [{ id: 'key_2' }] } },
      { body: { api_keys: [{ id: 'key_3', last_four: 'abcd' }] } },
    ]);
    const client = new CortexApiClient({ fetch });

    expect((await client.listApiKeys())[0]?.id).toBe('key_1');
    expect((await client.listApiKeys())[0]?.id).toBe('key_2');
    expect((await client.listApiKeys())[0]?.last_four).toBe('abcd');
    expect(calls[0]!.url).toBe('https://api.cortex.foundation/auth/api-keys');
  });

  it('creates and revokes a key, then lists orgs and logs out', async () => {
    const { fetch, calls } = stubFetch([
      { body: { id: 'key_new', name: 'desktop', key: 'sk-once' } },
      { body: {} },
      { body: [{ id: 'org_1', name: 'Cortex' }] },
      { body: {} },
    ]);
    const client = new CortexApiClient({ fetch });

    expect((await client.createApiKey('desktop')).key).toBe('sk-once');
    await client.revokeApiKey('key_new');
    expect((await client.listOrganizations())[0]?.id).toBe('org_1');
    await client.logout();

    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.body).toEqual({ name: 'desktop' });
    expect(calls[1]!.method).toBe('DELETE');
    expect(calls[1]!.url).toContain('/auth/api-keys/key_new');
    expect(calls[2]!.url).toContain('/organizations');
    expect(calls[3]!.url).toContain('/v1/auth/logout');
    expect(calls[3]!.method).toBe('POST');
  });

  it('returns 4xx from exchange so the Electron proxy can reconstruct them', async () => {
    const { fetch } = stubFetch([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
      { body: { items: [], has_more: false } },
    ]);
    const client = new CortexApiClient({ fetch });

    const missing = await client.exchange('/v1/mascots');
    expect(missing.status).toBe(404);
    expect(missing.ok).toBe(false);

    const ok = await client.exchange('/v1/skills');
    expect(ok.status).toBe(200);
  });

  it('raises when a completion stream has no body', async () => {
    const fetchImpl = (async () => new Response(null, { status: 200 })) as typeof fetch;
    const client = new CortexApiClient({ fetch: fetchImpl, credentials: { apiKey: 'sk' } });
    const iterator = client.streamChatCompletion({ model: 'm', messages: [] });
    const error = await iterator.next().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'NO_STREAM_BODY' });
  });
});
