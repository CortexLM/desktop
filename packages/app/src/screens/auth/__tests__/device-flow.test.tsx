/**
 * `createDeviceFlow` — the renderer half of the device flow.
 *
 * The poll loop is in main, so what is worth testing here is the lifecycle, which is where the
 * two damaging bugs live:
 *
 *   1. A flow that cannot start must *say so*. Left in `starting`, the screen spins forever on
 *      a code that is never coming — and that is the state the API being unreachable produces,
 *      which is the most likely failure in the field.
 *   2. Leaving the screen must abandon the flow. Otherwise main keeps polling for up to 15
 *      minutes and can sign the user in from a screen they walked away from.
 *
 * The primitive registers cleanups on its owning scope, so every case runs it inside a real
 * component rather than calling it bare: `createRoot` would test a different lifecycle from the
 * one the route uses.
 */

import { render, waitFor } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { CortexApiError } from '@cortex-ide/cortex-api';
import type { CortexDeviceStatus } from '@cortex-ide/shared';

import { createDeviceFlow, type DeviceFlow } from '../device-flow.ts';
import type { CortexHost } from '../../../state/host.ts';

const STARTED = {
  userCode: 'WDJB-MJHT',
  verificationUri: 'https://auth.cortex.foundation/device',
  expiresIn: 900,
};

interface Harness {
  flow: DeviceFlow;
  host: {
    startDeviceFlow: ReturnType<typeof vi.fn>;
    cancelDeviceFlow: ReturnType<typeof vi.fn>;
    openVerificationPage: ReturnType<typeof vi.fn>;
  };
  /** Pushes a status as main would. */
  push: (status: CortexDeviceStatus) => void;
  onAuthorized: ReturnType<typeof vi.fn>;
  unmount: () => void;
}

function mount(hostOverrides: Partial<CortexHost> = {}): Harness {
  const listeners: ((status: CortexDeviceStatus) => void)[] = [];

  const host = {
    startDeviceFlow: vi.fn(async () => STARTED),
    cancelDeviceFlow: vi.fn(async () => {}),
    openVerificationPage: vi.fn(async () => true),
    getState: vi.fn(),
    listModels: vi.fn(),
    signOut: vi.fn(),
    onDeviceStatus: vi.fn((listener: (status: CortexDeviceStatus) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    }),
    onAccountChanged: vi.fn(() => () => {}),
    ...hostOverrides,
  } as unknown as CortexHost & Harness['host'];

  const onAuthorized = vi.fn();
  let flow!: DeviceFlow;

  const { unmount } = render(() => {
    flow = createDeviceFlow({ host, onAuthorized });
    return <span>mounted</span>;
  });

  return {
    flow,
    host: host as unknown as Harness['host'],
    push: (status) => listeners.forEach((listener) => listener(status)),
    onAuthorized,
    unmount,
  };
}

describe('starting a flow', () => {
  it('begins in starting, before any code exists', () => {
    const { flow } = mount();

    // There is nothing to display yet, and the screen must not render a placeholder code.
    expect(flow.status()).toBe('starting');
    expect(flow.userCode()).toBe('');
  });

  it('publishes what the screen displays', async () => {
    const { flow } = mount();

    await flow.start();

    expect(flow.status()).toBe('waiting');
    expect(flow.userCode()).toBe('WDJB-MJHT');
    expect(flow.verificationUri()).toBe('https://auth.cortex.foundation/device');
    expect(flow.secondsRemaining()).toBe(900);
  });

  it('reports a failure to start instead of spinning', async () => {
    const { flow } = mount({
      startDeviceFlow: vi.fn(() => Promise.reject(new Error('service unreachable'))),
    } as Partial<CortexHost>);

    await flow.start();

    expect(flow.status()).toBe('error');
    // The message is shown verbatim: "unreachable" and "declined" call for different actions,
    // and generic copy would hide which one happened.
    expect(flow.errorMessage()).toBe('service unreachable');
  });

  it('classifies a missing device route, not a vendor body', async () => {
    const { flow } = mount({
      startDeviceFlow: vi.fn(() =>
        Promise.reject(new CortexApiError('not_found', 'WorkOS is not configured', { status: 404 })),
      ),
    } as Partial<CortexHost>);

    await flow.start();

    expect(flow.status()).toBe('error');
    expect(flow.errorMessage()).toMatch(/not available on this workspace/);
    expect(flow.errorMessage()?.toLowerCase()).not.toContain('workos');
  });

  it('clears a previous error when retried', async () => {
    const startDeviceFlow = vi
      .fn()
      .mockRejectedValueOnce(new Error('service unreachable'))
      .mockResolvedValueOnce(STARTED);
    const { flow } = mount({ startDeviceFlow } as Partial<CortexHost>);

    await flow.start();
    await flow.start();

    expect(flow.status()).toBe('waiting');
    // Otherwise Start over would succeed while the old failure stayed on screen.
    expect(flow.errorMessage()).toBeUndefined();
  });
});

describe('reacting to what main pushes', () => {
  it('leaves the status alone while the flow is merely pending', async () => {
    const { flow, push } = mount();
    await flow.start();

    push({ kind: 'pending' });
    push({ kind: 'slow-down' });

    // Both are the steady state of a device flow, not news.
    expect(flow.status()).toBe('waiting');
  });

  it('signs in on approval', async () => {
    const { flow, push, onAuthorized } = mount();
    await flow.start();

    push({ kind: 'authorized', user: { id: 'u', email: 'ada@example.com' } });

    expect(flow.status()).toBe('authorized');
    expect(onAuthorized).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['denied' as const, 'denied'],
    ['expired' as const, 'expired'],
  ])('surfaces %s', async (kind, expected) => {
    const { flow, push } = mount();
    await flow.start();

    push({ kind });

    expect(flow.status()).toBe(expected);
  });

  it('surfaces an unexpected failure with its reason', async () => {
    const { flow, push } = mount();
    await flow.start();

    // What an unrecognised device code produces: the service answers `invalid_grant`, which
    // is neither a decline nor an expiry.
    push({ kind: 'error', message: 'Invalid device code' });

    expect(flow.status()).toBe('error');
    expect(flow.errorMessage()).toBe('Invalid device code');
  });
});

describe('the expiry countdown', () => {
  it('ticks down once a second', async () => {
    vi.useFakeTimers();
    try {
      const { flow } = mount();
      await flow.start();

      vi.advanceTimersByTime(3000);

      expect(flow.secondsRemaining()).toBe(897);
    } finally {
      vi.useRealTimers();
    }
  });

  it('floors at zero rather than going negative', async () => {
    vi.useFakeTimers();
    try {
      const { flow } = mount({
        startDeviceFlow: vi.fn(async () => ({ ...STARTED, expiresIn: 2 })),
      } as Partial<CortexHost>);
      await flow.start();

      vi.advanceTimersByTime(10_000);

      // It waits for the service to confirm expiry instead of declaring it: a local clock
      // that ran fast would otherwise tell the user a still-valid code was dead.
      expect(flow.secondsRemaining()).toBe(0);
      expect(flow.status()).toBe('waiting');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('leaving the screen', () => {
  it('abandons the flow', async () => {
    const { flow, host, unmount } = mount();
    await flow.start();

    unmount();

    // Without this, main polls on for up to 15 minutes and could complete a sign-in for a
    // screen the user has closed.
    expect(host.cancelDeviceFlow).toHaveBeenCalled();
  });

  it('stops listening for pushed statuses', async () => {
    const { flow, push, onAuthorized, unmount } = mount();
    await flow.start();

    unmount();
    push({ kind: 'authorized', user: { id: 'u' } });

    // A leaked subscription would navigate from a component that no longer exists.
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it('stops the countdown', async () => {
    vi.useFakeTimers();
    try {
      const { flow, unmount } = mount();
      await flow.start();
      vi.advanceTimersByTime(1000);
      const atUnmount = flow.secondsRemaining();

      unmount();
      vi.advanceTimersByTime(5000);

      // An interval that outlives the component is a leak per visit to this screen.
      expect(flow.secondsRemaining()).toBe(atUnmount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the actions', () => {
  it('opens the approval page without passing a URL', async () => {
    const { flow, host } = mount();
    await flow.start();

    await flow.openBrowser();

    // Main opens the URL from the flow it started, so there is no renderer-supplied
    // destination to validate.
    expect(host.openVerificationPage).toHaveBeenCalledWith();
  });

  it('copies the code that is on screen', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const { flow } = mount();
    await flow.start();

    await flow.copyCode();

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('WDJB-MJHT'));
  });

  it('survives a missing clipboard', async () => {
    // Absent under jsdom and on an insecure origin. Failing to copy must not take the screen
    // down with it.
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    const { flow } = mount();
    await flow.start();

    await expect(flow.copyCode()).resolves.toBeUndefined();
  });
});
