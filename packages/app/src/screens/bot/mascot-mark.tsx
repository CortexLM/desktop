import { createEffect, onCleanup, type JSX } from 'solid-js';

import type { MascotFace } from '../../state/bot-map.ts';
import {
  displayFace,
  lookCssVars,
  PEBBLE_PATH,
  restingTilt,
  type MascotLook,
  type MascotMotion,
} from './mascot-looks.ts';

import './mascot-mark.css';

export interface MascotMarkProps {
  look: MascotLook;
  face: MascotFace;
  state?: MascotMotion;
  size?: number;
  seed?: string;
  label?: string;
  onSettled?: () => void;
}

export function MascotMark(props: MascotMarkProps): JSX.Element {
  const size = () => props.size ?? 48;
  const motion = () => props.state ?? 'idle';
  const shown = () => displayFace(props.face, motion());
  const tilt = () => restingTilt(props.seed ?? '', size());
  let blink: SVGGElement | undefined;

  createEffect(() => runIdleBlink(blink, shown(), motion()));
  createEffect(() => watchSuccess(motion(), props.onSettled));

  return (
    <svg
      class="cx-mascot"
      data-look={props.look}
      data-face={shown()}
      data-state={motion()}
      data-tilt={String(tilt())}
      width={size()}
      height={size()}
      viewBox="0 0 100 100"
      style={lookCssVars(props.look) as JSX.CSSProperties}
      aria-hidden={props.label ? undefined : true}
      aria-label={props.label}
      role={props.label ? 'img' : undefined}
    >
      <g class="cx-mascot__tilt" transform={`rotate(${tilt()} 50 52)`}>
        <g class="cx-mascot__actor">
          <path class="cx-mascot__body" d={PEBBLE_PATH} />
          <g class="cx-mascot__gaze">
            <g class="cx-mascot__blink" ref={blink}>
              <FaceLayer face={shown()} />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

function FaceLayer(props: { face: MascotFace | 'smile' }): JSX.Element {
  if (props.face === 'slit') return <EyesSlit />;
  if (props.face === 'wink') return <EyesWink />;
  if (props.face === 'smile') return <EyesSmile />;
  return <EyesIdle />;
}

function EyesIdle(): JSX.Element {
  return (
    <>
      <ellipse class="cx-mascot__eye" cx="39" cy="44" rx="6.2" ry="6.2" />
      <ellipse class="cx-mascot__pupil" cx="39" cy="44" rx="2" ry="2" />
      <ellipse class="cx-mascot__eye" cx="59" cy="44" rx="6.2" ry="6.2" />
      <ellipse class="cx-mascot__pupil" cx="59" cy="44" rx="2" ry="2" />
    </>
  );
}

function EyesSlit(): JSX.Element {
  return (
    <>
      <rect class="cx-mascot__eye" x="32.5" y="42.6" width="13" height="3.2" rx="1.6" />
      <rect class="cx-mascot__eye" x="52.5" y="42.6" width="13" height="3.2" rx="1.6" />
    </>
  );
}

function EyesWink(): JSX.Element {
  return (
    <>
      <ellipse class="cx-mascot__eye" cx="39" cy="44" rx="6.2" ry="6.2" />
      <ellipse class="cx-mascot__pupil" cx="39" cy="44" rx="2" ry="2" />
      <rect class="cx-mascot__eye" x="52.5" y="42.6" width="13" height="3.2" rx="1.6" />
    </>
  );
}

function EyesSmile(): JSX.Element {
  return (
    <>
      <path class="cx-mascot__smile" d="M33 48 Q39 40 45 48" />
      <path class="cx-mascot__smile" d="M53 48 Q59 40 65 48" />
    </>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function runIdleBlink(node: SVGGElement | undefined, face: MascotFace | 'smile', motion: MascotMotion): void {
  if (!node || face !== 'idle' || (motion !== 'idle' && motion !== 'thinking')) return;
  if (prefersReducedMotion() || typeof node.animate !== 'function') return;
  let timer = 0;
  const tick = () => {
    node.animate(
      [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.08)', offset: 0.45 }, { transform: 'scaleY(1)' }],
      { duration: 140, easing: 'ease-in-out' },
    );
    timer = window.setTimeout(tick, 4000 + Math.random() * 3000);
  };
  timer = window.setTimeout(tick, 4000 + Math.random() * 3000);
  onCleanup(() => window.clearTimeout(timer));
}

function watchSuccess(motion: MascotMotion, onSettled?: () => void): void {
  if (motion !== 'success' || !onSettled) return;
  const timer = window.setTimeout(onSettled, 900);
  onCleanup(() => window.clearTimeout(timer));
}
