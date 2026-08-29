import { For, type JSX } from 'solid-js';

import type { MascotFace, MascotLook } from '../../state/bot-map.ts';
import { MASCOT_FACES, MASCOT_LOOKS } from './mascot-looks.ts';
import { MascotMark } from './mascot-mark.tsx';

export function MascotIdentityFields(props: {
  look: MascotLook;
  face: MascotFace;
  onLook: (look: MascotLook) => void;
  onFace: (face: MascotFace) => void;
}): JSX.Element {
  return (
    <div class="cx-mascot-identity">
      <div class="cx-mascot-identity__preview">
        <MascotMark look={props.look} face={props.face} size={96} seed="preview" />
      </div>
      <LookField look={props.look} face={props.face} onLook={props.onLook} />
      <FaceField look={props.look} face={props.face} onFace={props.onFace} />
    </div>
  );
}

function LookField(props: {
  look: MascotLook;
  face: MascotFace;
  onLook: (look: MascotLook) => void;
}): JSX.Element {
  return (
    <fieldset class="cx-mascot-identity__fieldset">
      <legend class="cx-mascot-identity__legend">Look</legend>
      <div class="cx-mascot-identity__grid" role="group" aria-label="Look">
        <For each={MASCOT_LOOKS}>
          {(look) => (
            <button
              type="button"
              class="cx-mascot-identity__choice"
              aria-pressed={props.look === look.id}
              aria-label={look.label}
              onClick={() => props.onLook(look.id)}
            >
              <MascotMark look={look.id} face={props.face} size={40} />
              {look.label}
            </button>
          )}
        </For>
      </div>
    </fieldset>
  );
}

function FaceField(props: {
  look: MascotLook;
  face: MascotFace;
  onFace: (face: MascotFace) => void;
}): JSX.Element {
  return (
    <fieldset class="cx-mascot-identity__fieldset">
      <legend class="cx-mascot-identity__legend">Face</legend>
      <div class="cx-mascot-identity__grid" role="group" aria-label="Face">
        <For each={MASCOT_FACES}>
          {(face) => (
            <button
              type="button"
              class="cx-mascot-identity__choice"
              aria-pressed={props.face === face.id}
              aria-label={face.label}
              onClick={() => props.onFace(face.id)}
            >
              <MascotMark look={props.look} face={face.id} size={40} />
              {face.label}
            </button>
          )}
        </For>
      </div>
    </fieldset>
  );
}
