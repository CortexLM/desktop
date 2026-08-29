/**
 * Where a connected plugin is used, as the store reads it and as it writes it.
 *
 * The reading is the subtle half. A service with no notion of surfaces answers
 * a connection with no `surfaces` on it, and that has to project as "usable in
 * both" — the tools really are reachable from a Cortex Chat turn and a Cortex
 * Bot turn. Reading it as "neither" would draw two empty switches over a
 * connection that is in fact wide open.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import { setBotClientForTests } from '../bot-client.ts';
import {
  assignPluginSurfaces,
  classifyPluginWrite,
  pluginApps,
  reconcilePlugins,
  resetPluginsForTests,
} from '../plugins.ts';
import { readPluginSurfaces, togglePluginSurface } from '../plugin-surfaces.ts';

afterEach(() => {
  setBotClientForTests(undefined);
  resetPluginsForTests();
});

function clientFor(responses: Parameters<typeof stubFetch>[0]) {
  const stub = stubFetch(responses);
  setBotClientForTests(new CortexApiClient({ fetch: stub.fetch }));
  return stub;
}

const catalogue = (items: unknown[]) => ({
  body: { items, is_live: true, provider: 'composio', source: 'marketplace' },
});

describe('reading an assignment', () => {
  it('treats a service that says nothing as filtering nothing', () => {
    expect(readPluginSurfaces(undefined)).toEqual(['chat', 'bot']);
    expect(readPluginSurfaces([])).toEqual(['chat', 'bot']);
  });

  it('keeps the assignment the service did make, in page order', () => {
    expect(readPluginSurfaces(['chat'])).toEqual(['chat']);
    expect(readPluginSurfaces(['bot', 'chat'])).toEqual(['chat', 'bot']);
  });

  it('says neither when the only surfaces named are ones this page has no switch for', () => {
    expect(readPluginSurfaces(['inbox'])).toEqual([]);
  });
});

describe('changing an assignment', () => {
  it('adds and removes one surface', () => {
    expect(togglePluginSurface(['chat'], 'bot', true)).toEqual(['chat', 'bot']);
    expect(togglePluginSurface(['chat', 'bot'], 'chat', false)).toEqual(['bot']);
  });

  it('refuses to leave a connection on no surface at all', () => {
    expect(togglePluginSurface(['bot'], 'bot', false)).toBeUndefined();
  });
});

describe('the store', () => {
  it('projects the connection row onto its catalogue card', async () => {
    clientFor([
      catalogue([{ slug: 'gmail', name: 'Gmail', connected: true }]),
      { body: { items: [{ id: 'con_1', toolkit_slug: 'gmail', surfaces: ['bot'] }] } },
    ]);

    await reconcilePlugins();

    expect(pluginApps()[0]?.surfaces).toEqual(['bot']);
  });

  it('shows both surfaces when the service carries no assignment', async () => {
    clientFor([
      catalogue([{ slug: 'gmail', name: 'Gmail', connected: true }]),
      { body: { items: [{ id: 'con_1', toolkit_slug: 'gmail' }] } },
    ]);

    await reconcilePlugins();

    expect(pluginApps()[0]?.surfaces).toEqual(['chat', 'bot']);
  });

  it('writes the change, then re-reads what the account actually holds', async () => {
    const stub = clientFor([
      { body: {} },
      catalogue([{ slug: 'gmail', name: 'Gmail', connected: true }]),
      { body: { items: [{ id: 'con_1', toolkit_slug: 'gmail', surfaces: ['chat'] }] } },
    ]);

    await assignPluginSurfaces('gmail', ['chat']);

    expect(stub.calls[0]!.method).toBe('PATCH');
    expect(stub.calls[0]!.body).toEqual({ surfaces: ['chat'] });
    expect(pluginApps()[0]?.surfaces).toEqual(['chat']);
  });

  it('leaves the page untouched when the write fails', async () => {
    clientFor([
      catalogue([{ slug: 'gmail', name: 'Gmail', connected: true }]),
      { body: { items: [{ id: 'con_1', toolkit_slug: 'gmail', surfaces: ['chat', 'bot'] }] } },
      { status: 500, body: { code: 'boom', message: 'down' } },
    ]);

    await reconcilePlugins();
    await expect(assignPluginSurfaces('gmail', ['chat'])).rejects.toThrow();

    expect(pluginApps()[0]?.surfaces).toEqual(['chat', 'bot']);
  });
});

describe('classifying a failed write', () => {
  it('separates a backend without the route from a save that went wrong', async () => {
    const notThere = await failure(404, 'not_found');
    const notAllowed = await failure(405, 'method_not_allowed');
    const broken = await failure(500, 'boom');
    const down = await failure(503, 'unavailable');

    expect(classifyPluginWrite(notThere, 'assign')).toBe('assign-unsupported');
    expect(classifyPluginWrite(notAllowed, 'assign')).toBe('assign-unsupported');
    expect(classifyPluginWrite(broken, 'assign')).toBe('assign');
    expect(classifyPluginWrite(down, 'assign')).toBe('unavailable');
    // A connect against a backend with no route is still just a failed connect.
    expect(classifyPluginWrite(notThere, 'connect')).toBe('connect');
  });
});

/** A real `CortexApiError`, raised the way the client raises one. */
async function failure(status: number, code: string): Promise<unknown> {
  clientFor([{ status, body: { code, message: 'nope' } }]);
  return assignPluginSurfaces('gmail', ['chat']).catch((error: unknown) => error);
}
