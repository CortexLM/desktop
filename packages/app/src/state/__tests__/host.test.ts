/**
 * `resolveHost` — the renderer's only route to the Cortex API.
 *
 * Two behaviours are load-bearing and neither is visible to TypeScript:
 *
 *   1. **Failures must throw.** Every handler answers `{ success, data }`. A façade that
 *      returned `response.data` unconditionally would hand callers `undefined` on failure, and
 *      `undefined` reads as "no models" rather than as "the call failed" — which is exactly
 *      the bug this layer was built to fix.
 *   2. **No bridge is not the same as signed out.** Under the suites and the preview server
 *      `window.cortex` does not exist. Reporting that as a signed-out, reachable session would
 *      make the UI invite the user to sign in through a path that cannot work.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { detachedHost, hasElectronHost, resolveHost } from '../host.ts';

type Bridge = Record<string, ReturnType<typeof vi.fn>>;

function installBridge(overrides: Partial<Bridge> = {}): Bridge {
  const ok = <T>(data: T) => vi.fn(async () => ({ success: true, data }));

  const bridge: Bridge = {
    getState: ok({ user: null, reachable: true, credentialsEncrypted: true }),
    listModels: ok({ models: [{ id: 'cortex-codex', requiresAccount: false }] }),
    deviceStart: ok({ userCode: 'WDJB-MJHT', verificationUri: 'https://x/device', expiresIn: 900 }),
    deviceCancel: ok({ cancelled: true }),
    openVerification: ok({ opened: true }),
    signOut: ok({ user: null, reachable: true, credentialsEncrypted: true }),
    onDeviceStatus: vi.fn(() => () => {}),
    onAccountChanged: vi.fn(() => () => {}),
    onAuthComplete: vi.fn(() => () => {}),
    startBrowserLogin: ok({ opened: true }),
    signInWithEmail: ok({ user: null, reachable: true, credentialsEncrypted: true }),
    ...overrides,
  };

  (globalThis as { cortex?: unknown }).cortex = { cortex: bridge };
  return bridge;
}

afterEach(() => {
  delete (globalThis as { cortex?: unknown }).cortex;
  vi.restoreAllMocks();
});

describe('detecting the host', () => {
  it('finds the bridge when Electron installed it', () => {
    installBridge();
    expect(hasElectronHost()).toBe(true);
  });

  it('reports no bridge outside Electron', () => {
    expect(hasElectronHost()).toBe(false);
  });

  it('does not mistake an unrelated global for the bridge', () => {
    // The namespace is `window.cortex.cortex`; the outer object carries every other domain
    // too, so its mere presence says nothing about this one.
    (globalThis as { cortex?: unknown }).cortex = { fs: {} };
    expect(hasElectronHost()).toBe(false);
  });
});

describe('unwrapping the IPC envelope', () => {
  it('returns the payload on success', async () => {
    installBridge();

    const result = await resolveHost().listModels();

    expect(result.models).toEqual([{ id: 'cortex-codex', requiresAccount: false }]);
  });

  it('throws the message main produced on failure', async () => {
    installBridge({
      listModels: vi.fn(async () => ({
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'getaddrinfo ENOTFOUND' },
      })),
    });

    // Throwing rather than resolving to a sentinel: a caller cannot then treat the failure as
    // an empty catalogue, which looks identical to a signed-out account.
    await expect(resolveHost().listModels()).rejects.toThrow('getaddrinfo ENOTFOUND');
  });

  it('reduces the verification call to whether it opened', async () => {
    installBridge({ openVerification: vi.fn(async () => ({ success: true, data: { opened: false } })) });

    // `false` when no flow is in progress, so the screen can say so instead of appearing to
    // have worked.
    await expect(resolveHost().openVerificationPage()).resolves.toBe(false);
  });

  it('opens system-browser login through the bridge', async () => {
    const bridge = installBridge();
    await expect(resolveHost().startBrowserLogin('github')).resolves.toBe(true);
    expect(bridge.startBrowserLogin).toHaveBeenCalledWith({ provider: 'github' });
  });

  it('forwards no argument to the bridge', async () => {
    const bridge = installBridge();

    await resolveHost().getState();

    // Main validates these with an optional schema precisely because the bridge sends nothing.
    // Passing `{}` or `null` would be a different wire message.
    expect(bridge.getState.mock.calls[0]).toEqual([]);
  });

  it('unwraps the event payload so callers see a status, not an envelope', () => {
    const bridge = installBridge();
    const seen: unknown[] = [];

    resolveHost().onDeviceStatus((status) => seen.push(status));

    const forward = bridge.onDeviceStatus.mock.calls[0][0] as (event: unknown) => void;
    forward({ status: { kind: 'denied' } });

    expect(seen).toEqual([{ kind: 'denied' }]);
  });
});

describe('the detached host', () => {
  it('is what resolves with no bridge', async () => {
    const state = await resolveHost().getState();

    expect(state.user).toBeNull();
    // Not `reachable: true`. "Offline" and "signed out" call for different copy, and this
    // environment is genuinely the former.
    expect(state.reachable).toBe(false);
  });

  it('explains why the catalogue is empty', async () => {
    const result = await detachedHost().listModels();

    expect(result.models).toEqual([]);
    expect(result.error).toMatch(/desktop app/i);
  });

  it('rejects a sign-in attempt rather than hanging', async () => {
    // A promise that can never settle would leave the screen spinning with no explanation.
    await expect(detachedHost().startDeviceFlow()).rejects.toThrow(/desktop app/i);
  });

  it('makes cancelling and unsubscribing harmless no-ops', async () => {
    const host = detachedHost();

    await expect(host.cancelDeviceFlow()).resolves.toBeUndefined();
    await expect(host.openVerificationPage()).resolves.toBe(false);
    expect(() => host.onDeviceStatus(() => {})()).not.toThrow();
    expect(() => host.onAccountChanged(() => {})()).not.toThrow();
    expect(() => host.onAuthComplete(() => {})()).not.toThrow();
    await expect(host.startBrowserLogin('github')).rejects.toThrow(/desktop app/i);
  });
});
