/**
 * Drives the RFC 8628 device flow for the Auth Device Code screen.
 *
 * The poll loop itself lives in the main process — the renderer cannot reach the API from a
 * `file://` origin — so this is not a reimplementation of the flow. It starts one, holds what
 * the screen displays, and reacts to the status main pushes.
 *
 * Separated from the route component because it is state with a lifecycle (a subscription, an
 * interval, and a cancellation on unmount) rather than markup, and because the two failure
 * modes worth getting right are both here: a flow abandoned when the screen closes, and a
 * countdown that must not claim the code is dead before the service says so.
 */

import { createSignal, onCleanup, type Accessor } from 'solid-js';

import { describeSignInError } from '@cortex-ide/cortex-api';
import type { CortexDeviceStatus } from '@cortex-ide/shared';

import type { DeviceCodeStatus } from './device-code-screen.tsx';
import type { CortexHost } from '../../state/host.ts';

export interface DeviceFlow {
  status: Accessor<DeviceCodeStatus>;
  userCode: Accessor<string>;
  verificationUri: Accessor<string>;
  secondsRemaining: Accessor<number>;
  errorMessage: Accessor<string | undefined>;
  /** Starts a flow, replacing any in progress. Also the Start over action. */
  start: () => Promise<void>;
  cancel: () => Promise<void>;
  openBrowser: () => Promise<void>;
  copyCode: () => Promise<void>;
}

export interface DeviceFlowOptions {
  host: CortexHost;
  /** Called once the service confirms the device was approved. */
  onAuthorized: () => void;
}

/**
 * Translates a pushed status into what the screen shows, or `undefined` to leave it alone.
 *
 * `pending` and `slow-down` map to nothing on purpose: they are the steady state of a device
 * flow, and the screen already says it is waiting. Rewriting the status on each poll would
 * only churn the reactive graph.
 */
function screenStatusFor(kind: CortexDeviceStatus['kind']): DeviceCodeStatus | undefined {
  switch (kind) {
    case 'authorized':
      return 'authorized';
    case 'denied':
      return 'denied';
    case 'expired':
      return 'expired';
    case 'error':
      return 'error';
    default:
      return undefined;
  }
}

/**
 * Wires the flow up. Must be called during a component's initialisation, since it registers
 * cleanups on the owning scope.
 */
export function createDeviceFlow(options: DeviceFlowOptions): DeviceFlow {
  const { host } = options;

  const [status, setStatus] = createSignal<DeviceCodeStatus>('starting');
  const [userCode, setUserCode] = createSignal('');
  const [verificationUri, setVerificationUri] = createSignal('');
  const [secondsRemaining, setSecondsRemaining] = createSignal(0);
  const [errorMessage, setErrorMessage] = createSignal<string>();

  const start = async () => {
    setStatus('starting');
    setErrorMessage(undefined);
    try {
      const flow = await host.startDeviceFlow();
      setUserCode(flow.userCode);
      setVerificationUri(flow.verificationUri);
      setSecondsRemaining(flow.expiresIn);
      setStatus('waiting');
    } catch (error) {
      // A flow that cannot start has to say so. Left in `starting`, the screen would spin on
      // a code that is never coming.
      setErrorMessage(describeSignInError(error));
      setStatus('error');
    }
  };

  onCleanup(
    host.onDeviceStatus((update) => {
      if (update.kind === 'error') setErrorMessage(update.message);

      const next = screenStatusFor(update.kind);
      if (next) setStatus(next);

      if (update.kind === 'authorized') options.onAuthorized();
    }),
  );

  // The countdown is local: main reports the expiry once, and ticking over IPC every second
  // would be a message per second to recompute a number the renderer already has. It floors
  // at zero and waits for the service to confirm expiry rather than declaring it.
  const tick = setInterval(() => {
    setSecondsRemaining((current) => Math.max(0, current - 1));
  }, 1000);
  onCleanup(() => clearInterval(tick));

  // Leaving the screen abandons the flow. Without this the loop keeps polling in main for up
  // to 15 minutes and could sign the user in from a screen they walked away from.
  onCleanup(() => void host.cancelDeviceFlow());

  return {
    status,
    userCode,
    verificationUri,
    secondsRemaining,
    errorMessage,
    start,
    cancel: () => host.cancelDeviceFlow(),
    openBrowser: async () => {
      await host.openVerificationPage();
    },
    copyCode: async () => {
      // Optional chaining because the clipboard API is absent under jsdom and on an insecure
      // origin; failing to copy must not take the screen down with it.
      await navigator.clipboard?.writeText(userCode());
    },
  };
}
