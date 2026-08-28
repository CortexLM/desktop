import { type JSX, Show } from 'solid-js';

import type { ComputerInput } from '@cortex-ide/cortex-api';

export function ComputerDesktop(props: {
  src?: string;
  offline: boolean;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  return (
    <Show
      when={!props.offline}
      fallback={
        <div class="cx-vnc" role="status">
          The farm or local daemon is not connected. This is not a live desktop.
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
