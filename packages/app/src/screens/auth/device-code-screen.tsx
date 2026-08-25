import { type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { BrandMark } from '../../shell/brand-mark.tsx';

import './auth.css';

export type DeviceCodeStatus = 'waiting' | 'authorized' | 'denied' | 'expired';

export interface DeviceCodeScreenProps {
  /** The short code the user types at the verification URL. */
  userCode: string;
  verificationUri: string;
  status: DeviceCodeStatus;
  /** Seconds left before the code expires. */
  secondsRemaining: number;
  onOpenBrowser: () => void;
  onCopyCode: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

/** `900` -> `15:00`. */
function formatRemaining(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  return `${minutes}:${String(clamped % 60).padStart(2, '0')}`;
}

const STATUS_COPY: Record<DeviceCodeStatus, string> = {
  waiting: 'Waiting for you to approve this device…',
  authorized: 'Approved. Signing you in…',
  denied: 'That request was declined.',
  expired: 'This code expired before it was approved.',
};

/**
 * The action row.
 *
 * Once the flow is over, Copy code is dropped rather than disabled: copying a code that can
 * no longer be redeemed is a dead end, and Start over is the only useful move left.
 */
function DeviceActions(props: {
  finished: boolean;
  onOpenBrowser: () => void;
  onCopyCode: () => void;
  onCancel: () => void;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div class="cx-device__actions">
      <Show
        when={props.finished}
        fallback={
          <>
            <Button variant="primary" onClick={() => props.onOpenBrowser()}>
              Open browser
            </Button>
            <Button variant="secondary" onClick={() => props.onCopyCode()}>
              Copy code
            </Button>
            <Button variant="ghost" onClick={() => props.onCancel()}>
              Cancel
            </Button>
          </>
        }
      >
        <Button variant="primary" onClick={() => props.onRetry()}>
          Start over
        </Button>
        <Button variant="ghost" onClick={() => props.onCancel()}>
          Cancel
        </Button>
      </Show>
    </div>
  );
}

/**
 * Auth Device Code.
 *
 * This is the desktop sign-in path: the service issues a short code, the user approves it
 * in a browser, and the app polls until a token comes back. It avoids hosting a redirect
 * listener inside Electron.
 *
 * The wait has no known duration, so the indicator is a spinner rather than a progress bar.
 * A bar that cannot report progress makes a claim about how much is left that it cannot
 * keep. The expiry countdown is the honest number, and it is shown separately.
 */
export function DeviceCodeScreen(props: DeviceCodeScreenProps): JSX.Element {
  const finished = () => props.status === 'denied' || props.status === 'expired';

  return (
    <div class="cx-auth">
      <div class="cx-auth__card cx-auth__card--wide">
        <span class="cx-auth__mark">
          <BrandMark width={34} height={17} />
        </span>

        <h1 class="cx-auth__title">Approve this device</h1>
        <p class="cx-auth__subtitle">Enter this code to finish signing in</p>

        <p class="cx-device__code" aria-label={`Device code ${props.userCode.split('').join(' ')}`}>
          {props.userCode}
        </p>

        <p class="cx-device__url">
          Go to <strong>{props.verificationUri}</strong>
        </p>

        {/*
          `role="status"` so the outcome is announced without interrupting: the user is
          looking at their browser, not at this window, for most of the wait.
        */}
        <p class="cx-device__status" role="status">
          <Show when={props.status === 'waiting'}>
            <span class="cx-device__spinner" aria-hidden="true" />
          </Show>
          {STATUS_COPY[props.status]}
        </p>

        <Show when={props.status === 'waiting'}>
          <p class="cx-device__expiry">Expires in {formatRemaining(props.secondsRemaining)}</p>
        </Show>

        <DeviceActions
          finished={finished()}
          onOpenBrowser={props.onOpenBrowser}
          onCopyCode={props.onCopyCode}
          onCancel={props.onCancel}
          onRetry={props.onRetry}
        />
      </div>
    </div>
  );
}
