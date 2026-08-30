import { type JSX, Show } from 'solid-js';

import { farmOfflineCopy, type ComputerInput } from '@cortex-ide/cortex-api';

/**
 * How the desktop is being delivered.
 *
 * `screenshot` is the path that works today: a poll plus an input channel, which is
 * interactive but not a stream. `vnc` means the service issued a signalling ticket,
 * so a continuous stream is available for this box. `unavailable` means it declined
 * or has no such route.
 *
 * Named rather than implied because the two feel different at the keyboard, and a
 * user typing into a one-frame-per-second image deserves to know that is what it is.
 */
export type DesktopTransport = 'screenshot' | 'vnc' | 'unavailable';

const TRANSPORT_NOTE: Record<DesktopTransport, string> = {
  screenshot: 'Screenshot stream. Clicks, drags, scrolls and keys are sent to the box.',
  vnc: 'Live desktop stream available for this box.',
  unavailable: 'This Cortex backend does not offer a live desktop stream. Screenshots only.',
};

export function ComputerDesktop(props: {
  src?: string;
  offline: boolean;
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
      <Show
        when={props.src}
        fallback={
          <div class="cx-vnc" role="img" aria-label="Dedicated computer">
            Waiting for a screenshot from this mascot's computer.
          </div>
        }
      >
        <LiveFrame src={props.src!} onInput={props.onInput} />
      </Show>
      <Show when={props.transport}>
        {(transport) => <p class="cx-product-note">{TRANSPORT_NOTE[transport()]}</p>}
      </Show>
    </Show>
  );
}

function LiveFrame(props: { src: string; onInput: (input: ComputerInput) => void }): JSX.Element {
  let origin: { x: number; y: number } | undefined;
  return (
    <button
      type="button"
      class="cx-vnc cx-vnc--live"
      onPointerDown={(event) => {
        origin = pointFrom(event);
      }}
      onPointerUp={(event) => {
        const start = origin;
        origin = undefined;
        if (start) props.onInput(releaseFrom(start, event));
      }}
      onAuxClick={(event) => {
        event.preventDefault();
        props.onInput({ action: 'click', button: 'right', ...pointFrom(event) });
      }}
      onWheel={(event) => {
        event.preventDefault();
        props.onInput({ action: 'scroll', dx: event.deltaX, dy: event.deltaY });
      }}
      onKeyDown={(event) => {
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
