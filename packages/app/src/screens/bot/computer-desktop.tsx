import { type JSX, Show } from 'solid-js';

import type { ComputerInput } from '@cortex-ide/cortex-api';

import { NovncFrame } from './novnc-frame.tsx';

/**
 * How the desktop is being delivered.
 *
 * `screenshot` — poll a frame, send input back.
 * `vnc` — a signalling ticket exists; still frames until a page URL arrives.
 * `novnc` — the farm minted a noVNC page; that iframe is the live rail.
 * `unavailable` — no ticket and no stream.
 */
export type DesktopTransport = 'screenshot' | 'vnc' | 'novnc' | 'unavailable';

const TRANSPORT_NOTE: Record<DesktopTransport, string> = {
  screenshot: 'Screenshot stream. Clicks, drags, scrolls and keys are sent to the box.',
  vnc: 'Live desktop ticket issued. Waiting for a stream page from the farm.',
  novnc: 'Live desktop. This is the mascot’s computer, not a screenshot.',
  unavailable: 'This Cortex backend does not offer a live desktop stream. Screenshots only.',
};

export function ComputerDesktop(props: {
  src?: string;
  streamUrl?: string;
  offline: boolean;
  transport?: DesktopTransport;
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
      <DesktopSurface
        src={props.src}
        streamUrl={props.streamUrl}
        transport={props.transport}
        onInput={props.onInput}
      />
    </Show>
  );
}

function DesktopSurface(props: {
  src?: string;
  streamUrl?: string;
  transport?: DesktopTransport;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  const live = () => props.transport === 'novnc' && Boolean(props.streamUrl);
  return (
    <>
      <Show when={live()} fallback={<ScreenshotOrWait src={props.src} onInput={props.onInput} />}>
        <NovncFrame src={props.streamUrl!} />
      </Show>
      <Show when={props.transport}>
        {(transport) => <p class="cx-product-note">{TRANSPORT_NOTE[transport()]}</p>}
      </Show>
    </>
  );
}

function ScreenshotOrWait(props: {
  src?: string;
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
      <LiveFrame src={props.src!} onInput={props.onInput} />
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
