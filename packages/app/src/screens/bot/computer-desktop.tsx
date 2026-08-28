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
        <button
          type="button"
          class="cx-vnc cx-vnc--live"
          onClick={(event) => props.onInput(clickFrom(event))}
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
      </Show>
    </Show>
  );
}

function pointFrom(event: MouseEvent): { x: number; y: number } {
  const target = event.currentTarget as HTMLElement;
  const box = target.getBoundingClientRect();
  const x = Math.round(((event.clientX - box.left) / box.width) * 1280);
  const y = Math.round(((event.clientY - box.top) / box.height) * 800);
  return { x, y };
}

function clickFrom(event: MouseEvent): ComputerInput {
  const point = pointFrom(event);
  if (event.detail >= 2) return { action: 'double_click', ...point };
  return { action: 'click', ...point };
}
