import type { JSX } from 'solid-js';

import type { HarnessStatus } from '../../state/harness.ts';

import '../chat/product-pages.css';

const LABELS: Record<HarnessStatus['kind'], string> = {
  'cloud-only': 'Cloud only',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Disconnected',
  'cloud-session-running': 'Cloud session running',
  'permission-blocked': 'Permission blocked',
  'failed-wake': 'Failed wake',
};

export function HarnessBanner(props: {
  status: HarnessStatus;
  remoteHost?: string;
  onRemoteHostChange?: (value: string) => void;
}): JSX.Element {
  const label = () =>
    props.status.kind === 'connected' && props.status.hostLabel
      ? `Connected · ${props.status.hostLabel}`
      : LABELS[props.status.kind];

  return (
    <div class={`cx-harness cx-harness--${props.status.kind}`} role="status">
      <strong>{label()}</strong>
      {props.status.detail ? <span>{props.status.detail}</span> : null}
      {props.onRemoteHostChange ? (
        <input
          aria-label="Remote Cortex Code host"
          placeholder="https://code.example"
          value={props.remoteHost ?? ''}
          onChange={(event) => props.onRemoteHostChange?.(event.currentTarget.value)}
        />
      ) : null}
    </div>
  );
}
