import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { isProductPath, proxyProductRequest } from '../cortex-product-proxy';

const exchange = vi.fn();

vi.mock('../cortex-account-service', () => ({
  getCortexAccountService: () => ({
    getApiClient: () => ({ exchange }),
  }),
}));

beforeEach(() => {
  exchange.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('product path allowlist', () => {
  it('allows mascot, skill, and plugin routes only', () => {
    expect(isProductPath('/v1/mascots')).toBe(true);
    expect(isProductPath('/v1/mascots/mst_1/messages')).toBe(true);
    expect(isProductPath('/v1/skills/research')).toBe(true);
    expect(isProductPath('/v1/plugins/connections')).toBe(true);
    expect(isProductPath('/v1/mascots/mst_1/memory?tier=profile')).toBe(true);
    expect(isProductPath('/v1/conversations')).toBe(false);
    expect(isProductPath('/auth/me')).toBe(false);
  });
});

describe('proxyProductRequest', () => {
  it('forwards an allowlisted call and returns status plus body', async () => {
    exchange.mockResolvedValue(
      new Response(JSON.stringify({ id: 'mst_1' }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' },
      }),
    );

    const result = await proxyProductRequest({
      method: 'POST',
      path: '/v1/mascots',
      body: { name: 'Scout' },
    });

    expect(exchange).toHaveBeenCalledWith('/v1/mascots', {
      method: 'POST',
      body: { name: 'Scout' },
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.bodyText)).toEqual({ id: 'mst_1' });
    expect(result.headers['x-request-id']).toBe('req-1');
  });

  it('rejects a path outside the Bot surface', async () => {
    await expect(
      proxyProductRequest({ method: 'GET', path: '/v1/conversations' }),
    ).rejects.toThrow(/not allowlisted/);
    expect(exchange).not.toHaveBeenCalled();
  });
});

describe('client exchange', () => {
  it('returns a 404 Response instead of throwing', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ code: 'not_found', title: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = new CortexApiClient({ fetch: fetchImpl });
    const response = await client.exchange('/v1/mascots');
    expect(response.status).toBe(404);
    expect(response.ok).toBe(false);
  });
});
