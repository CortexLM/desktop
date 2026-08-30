import { type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { HonestState } from '../shared/honest-state.tsx';
import { MascotIdentityFields } from './mascot-identity.tsx';
import { ComputerHostPicker } from './computer-host-picker.tsx';
import type { ComputerHostOption, ComputerKind } from './computer-host.ts';
import type { MascotFace, MascotLook } from '../../state/bot-map.ts';

import '../chat/product-pages.css';
import './bot-workbench.css';

export function FirstBotSetup(props: {
  name: string;
  onName: (value: string) => void;
  look: MascotLook;
  onLook: (look: MascotLook) => void;
  face: MascotFace;
  onFace: (face: MascotFace) => void;
  computerKind?: ComputerKind;
  onComputerKind: (kind: ComputerKind) => void;
  hosts: readonly ComputerHostOption[];
  onCreate: () => void;
  creating?: boolean;
  error?: string;
  signedOut?: boolean;
  onSignIn?: () => void;
}): JSX.Element {
  return (
    <Show when={!props.signedOut} fallback={<SignedOutFirstBot onSignIn={props.onSignIn} />}>
      <SetupForm {...props} />
    </Show>
  );
}

export function SignedOutFirstBot(props: { onSignIn?: () => void }): JSX.Element {
  return (
    <HonestState
      kind="signed-out"
      title="Bot needs a Cortex account"
      body="A mascot is a persistent teammate with its own computer. Sign in to create one; Chat and Code on this machine keep working either way."
      actionLabel="Sign in"
      onAction={props.onSignIn}
    />
  );
}

function SetupForm(props: {
  name: string;
  onName: (value: string) => void;
  look: MascotLook;
  onLook: (look: MascotLook) => void;
  face: MascotFace;
  onFace: (face: MascotFace) => void;
  computerKind?: ComputerKind;
  onComputerKind: (kind: ComputerKind) => void;
  hosts: readonly ComputerHostOption[];
  onCreate: () => void;
  creating?: boolean;
  error?: string;
}): JSX.Element {
  const locked = () => props.hosts.find((host) => host.id === props.computerKind)?.lockedReason;
  return (
    <div class="cx-first-bot">
      <h2 class="cx-honest__title">Create your first mascot</h2>
      <p class="cx-honest__body">
        Name, look, face, and where its computer runs. Cortex does not invent a teammate for you.
      </p>
      <label class="cx-product-row__title" for="first-mascot-name">
        Name
      </label>
      <input
        id="first-mascot-name"
        class="cx-product-row"
        value={props.name}
        onInput={(event) => props.onName(event.currentTarget.value)}
        placeholder="Name this teammate"
        autocomplete="off"
      />
      <MascotIdentityFields look={props.look} face={props.face} onLook={props.onLook} onFace={props.onFace} />
      <ComputerHostPicker value={props.computerKind} options={props.hosts} onChange={props.onComputerKind} />
      <Show when={props.error}>
        <HonestState kind="error" title="Could not create" body={props.error ?? ''} />
      </Show>
      <Button
        variant="primary"
        disabled={!props.name.trim() || !props.computerKind || Boolean(locked()) || props.creating}
        onClick={() => props.onCreate()}
      >
        Create mascot
      </Button>
    </div>
  );
}
