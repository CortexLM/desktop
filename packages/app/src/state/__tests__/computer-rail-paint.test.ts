import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import { attachComputer, refreshScreenshot, shotFor } from '../bot-computer-live.ts';
import { liveRailPaint } from '../computer-rail-paint.ts';
import { setBotClientForTests } from '../bot-client.ts';
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

describe('liveRailPaint', () => {
  it('does not paint mascot A computer on mascot B route', async () => {
    clientFor({ image_base64: 'aaaa', content_type: 'image/png' });
    attachComputer('mst_a');
    await refreshScreenshot('mst_a');
    clientFor({ ticket_hash: 'abc', stream_url: 'https://farm.example/a' });
    attachDesktopStream('mst_a');
    await requestDesktopStream('mst_a');

    expect(shotFor('mst_a')).toBeDefined();
    expect(streamUrlFor('mst_a')).toBe('https://farm.example/a');

    const onB = liveRailPaint('mst_b', { id: 'mst_b' });
    expect(onB.screenshotUrl).toBeUndefined();
    expect(onB.streamUrl).toBeUndefined();

    const staleObject = liveRailPaint('mst_b', { id: 'mst_a' });
    expect(staleObject.screenshotUrl).toBeUndefined();
    expect(staleObject.streamUrl).toBeUndefined();
  });
});
