import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import { setBotClientForTests } from '../bot-client.ts';
import {
  attachComputer,
  refreshScreenshot,
  shot,
  shotFor,
} from '../bot-computer-live.ts';
import {
  attachDesktopStream,
  requestDesktopStream,
  resetDesktopTransportForTests,
  streamUrlFor,
} from '../vnc-ticket.ts';

afterEach(() => {
  attachComputer(undefined);
  resetDesktopTransportForTests();
  setBotClientForTests(undefined);
});

function clientFor(body: unknown): CortexApiClient {
  const { fetch } = stubFetch([{ body }]);
  const client = new CortexApiClient({ fetch });
  setBotClientForTests(client);
  return client;
}

describe('live computer ownership', () => {
  it('drops mascot A screenshot when the workbench binds mascot B', async () => {
    clientFor({ image_base64: 'aaaa', content_type: 'image/png' });
    attachComputer('mst_a');
    await refreshScreenshot('mst_a');
    expect(shotFor('mst_a')).toBeDefined();

    attachComputer('mst_b');
    expect(shot()).toBeUndefined();
    expect(shotFor('mst_a')).toBeUndefined();
    expect(shotFor('mst_b')).toBeUndefined();
  });

  it('does not keep mascot A stream URL on mascot B', async () => {
    clientFor({ ticket_hash: 'abc', stream_url: 'https://farm.example/a' });
    attachDesktopStream('mst_a');
    await requestDesktopStream('mst_a');
    expect(streamUrlFor('mst_a')).toBe('https://farm.example/a');

    attachDesktopStream('mst_b');
    expect(streamUrlFor('mst_a')).toBeUndefined();
    expect(streamUrlFor('mst_b')).toBeUndefined();
  });

  it('drops an in-flight screenshot for A after the workbench binds B', async () => {
    const later = deferredJson({ image_base64: 'aaaa', content_type: 'image/png' });
    setBotClientForTests(new CortexApiClient({ fetch: later.fetch }));
    attachComputer('mst_a');
    const pending = refreshScreenshot('mst_a');
    attachComputer('mst_b');
    later.resolve();
    await pending;
    expect(shot()).toBeUndefined();
    expect(shotFor('mst_a')).toBeUndefined();
    expect(shotFor('mst_b')).toBeUndefined();
  });
});

function deferredJson(body: unknown): { fetch: typeof globalThis.fetch; resolve: () => void } {
  let resolve: (value: Response) => void = () => undefined;
  const pending = new Promise<Response>((next) => {
    resolve = next;
  });
  return {
    fetch: (async () => pending) as typeof globalThis.fetch,
    resolve: () =>
      resolve(
        new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }),
      ),
  };
}
