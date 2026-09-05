import { type JSX, Show } from 'solid-js';

import { farmOfflineCopy, type ComputerInput } from '@cortex-ide/cortex-api';

/**
 * How the desktop is being delivered.
 *
 * `vnc` is a live noVNC stream. `screenshot` is a poll plus an input channel.
 * `unavailable` means the service declined a stream.
 */
export type DesktopTransport = 'screenshot' | 'vnc' | 'unavailable';

export function ComputerDesktop(props: {
  src?: string;
  streamUrl?: string;
  offline: boolean;
  interactive?: boolean;
  transport?: DesktopTransport;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  return (
    <Show
      when={!props.offline}
      fallback={
        <div class="cx-vnc" role="status">
          {farmOfflineCopy().body}
        </div>
      }
    >
      <Show when={props.streamUrl} fallback={<ScreenshotFrame {...props} />}>
        <NovncFrame src={props.streamUrl!} interactive={props.interactive === true} />
      </Show>
    </Show>
  );
}

function ScreenshotFrame(props: {
  src?: string;
  interactive?: boolean;
  transport?: DesktopTransport;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  return (
    <Show
      when={props.src}
      fallback={
        <div class="cx-vnc" role="img" aria-label="Dedicated computer">
          Waiting for a screenshot from this mascot's computer.
        </div>
      }
    >
      <LiveFrame
        src={props.src!}
        interactive={props.interactive === true}
        onInput={props.onInput}
      />
    </Show>
  );
}

function NovncFrame(props: { src: string; interactive: boolean }): JSX.Element {
  return (
    <iframe
      title="Computer"
      src={withViewOnly(props.src, !props.interactive)}
      class="cx-vnc cx-vnc--live cx-vnc--stream"
      sandbox="allow-scripts allow-same-origin"
      allow="clipboard-read; clipboard-write; fullscreen"
      style={{ 'pointer-events': props.interactive ? 'auto' : 'none' }}
    />
  );
}

function LiveFrame(props: {
  src: string;
  interactive: boolean;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  let origin: { x: number; y: number } | undefined;
  return (
    <button
      type="button"
      class="cx-vnc cx-vnc--live"
      disabled={!props.interactive}
      onPointerDown={(event) => {
        if (props.interactive) origin = pointFrom(event);
      }}
      onPointerUp={(event) => {
        const start = origin;
        origin = undefined;
        if (start && props.interactive) props.onInput(releaseFrom(start, event));
      }}
      onAuxClick={(event) => {
        event.preventDefault();
        if (props.interactive) {
          props.onInput({ action: 'click', button: 'right', ...pointFrom(event) });
        }
      }}
      onWheel={(event) => {
        event.preventDefault();
        if (props.interactive) {
          props.onInput({ action: 'scroll', dx: event.deltaX, dy: event.deltaY });
        }
      }}
      onKeyDown={(event) => {
        if (!props.interactive) return;
        if (event.key.length === 1) props.onInput({ action: 'type', text: event.key });
        else props.onInput({ action: 'key', key: event.key });
      }}
    >
      <img src={props.src} alt="Live computer" class="cx-vnc__image" />
    </button>
  );
}

export function releaseFrom(start: { x: number; y: number }, event: MouseEvent): ComputerInput {
  const end = pointFrom(event);
  if (Math.abs(end.x - start.x) > 4 || Math.abs(end.y - start.y) > 4) {
    return { action: 'drag', x: start.x, y: start.y, x2: end.x, y2: end.y };
  }
  if (event.detail >= 2) return { action: 'double_click', ...end };
  return { action: 'click', ...end };
}

function pointFrom(event: MouseEvent): { x: number; y: number } {
  const target = event.currentTarget as HTMLElement;
  const box = target.getBoundingClientRect();
  const x = Math.round(((event.clientX - box.left) / box.width) * 1280);
  const y = Math.round(((event.clientY - box.top) / box.height) * 800);
  return { x, y };
}

function withViewOnly(url: string, viewOnly: boolean): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('view_only', viewOnly ? 'true' : 'false');
    return parsed.toString();
  } catch {
    return url;
  }
}
