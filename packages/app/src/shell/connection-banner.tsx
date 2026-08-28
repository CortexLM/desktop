import { type JSX, Show } from 'solid-js';

import type { RealtimeStatus } from '@cortex-ide/cortex-api';

import './connection-banner.css';

export interface ConnectionBannerProps {
  status: RealtimeStatus;
  /** False in Electron and on origins that may not call the API. */
  live: boolean;
  onRetry: () => void;
}

/**
 * Whether this tab is still hearing from Cortex.
 *
 * `realtimeStatus` already existed and only the Code home read it, so a socket that
 * dropped was invisible on Chat and Bot — the two products whose whole interaction is
 * a stream. A mascot that stops answering and a socket that closed look identical
 * from the composer, and the difference is the only thing the user can act on.
 *
 * Silent while connected, because a permanent "everything is fine" strip is noise.
 * Silent too when there is no live session at all: in Electron the socket is main's
 * concern, and telling a desktop user their browser socket is idle would be reporting
 * on something that was never meant to be up.
 */
export function ConnectionBanner(props: ConnectionBannerProps): JSX.Element {
  const visible = () =>
    props.live && (props.status === 'disconnected' || props.status === 'unavailable');

  return (
    <Show when={visible()}>
      <div class="cx-connection" role="status">
        <span class="cx-connection__dot" aria-hidden="true" />
        <span>
          {props.status === 'unavailable'
            ? 'Live updates are unavailable on this connection. Replies and runs may lag.'
            : 'Disconnected from Cortex. Reconnecting will resume live replies and runs.'}
        </span>
        <button type="button" class="cx-connection__retry" onClick={() => props.onRetry()}>
          Reconnect
        </button>
      </div>
    </Show>
  );
}
