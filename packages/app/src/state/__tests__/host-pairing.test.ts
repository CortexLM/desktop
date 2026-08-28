import { afterEach, describe, expect, it } from 'vitest';

import { consumePairingCode, rememberPairingCode, requestHostPairing, resetHostPairing } from '../host-pairing.ts';
import { liveProductSurface } from '../product-surface.ts';
import { resetLiveSession } from '../realtime-session.ts';

afterEach(() => {
  resetHostPairing();
  resetLiveSession();
});

describe('host pairing', () => {
  it('stays unset when there is no live API session', async () => {
    expect(await requestHostPairing()).toBeUndefined();
    expect(consumePairingCode()).toBeUndefined();
    expect(liveProductSurface()).toBeUndefined();
  });

  it('shows a pairing code once and then forgets it', () => {
    rememberPairingCode('AB12-CD34');
    expect(consumePairingCode()).toBe('AB12-CD34');
    expect(consumePairingCode()).toBeUndefined();
  });
});
