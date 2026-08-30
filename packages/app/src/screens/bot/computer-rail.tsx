import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { HonestState } from '../shared/honest-state.tsx';
import { ComputerDesktop } from './computer-desktop.tsx';
import {
  computerIsMissing,
  computerIsOffline,
  computerLabel,
  type ComputerRuntime,
  type Mascot,
} from '../../state/bot-map.ts';
import type { ComputerInput } from '@cortex-ide/cortex-api';
import { hasElectronHost } from '../../state/electron-bridge.ts';

const RUNTIMES: readonly { id: ComputerRuntime; label: string }[] = [
  { id: 'this_pc', label: 'This PC' },
  { id: 'ssh', label: 'SSH' },
  { id: 'cloud', label: 'Cloud' },
];

export function ComputerRail(props: {
  mascot: Mascot;
  screenshot?: string;
  streamUrl?: string;
  hasControl: boolean;
  signedIn?: boolean;
  error?: string;
  onTakeControl: () => void;
  onRelease: () => void;
  onWake: () => void;
  onRuntime: (runtime: ComputerRuntime) => void;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  const asleep = () =>
    props.mascot.computer.status === 'hibernated' || props.mascot.computer.status === 'stopped';
  const offline = () => computerIsOffline(props.mascot.computer);
  const missing = () => computerIsMissing(props.mascot.computer);

  return (
    <aside class="cx-computer-rail" aria-label="Computer">
      <div class="cx-computer-rail__head">
        <span class="cx-computer-rail__title">Computer</span>
        <span class="cx-computer-rail__meta">{statusLine(props)}</span>
      </div>
      <Show when={props.error}>
        <HonestState kind="error" title="Computer error" body={props.error ?? ''} />
      </Show>
      <div class="cx-computer-rail__stage">
        <RailBody
          missing={missing()}
          offline={offline()}
          asleep={asleep()}
          screenshot={props.screenshot}
          streamUrl={props.streamUrl}
          hasControl={props.hasControl}
          onWake={props.onWake}
          onInput={props.onInput}
        />
      </div>
      <RailActions
        hasControl={props.hasControl}
        missing={missing()}
        onTakeControl={props.onTakeControl}
        onRelease={props.onRelease}
      />
      <RuntimePicker
        current={props.mascot.computer.runtime}
        signedIn={props.signedIn === true}
        onRuntime={props.onRuntime}
      />
    </aside>
  );
}

function statusLine(props: { mascot: Mascot; hasControl: boolean }): string {
  if (props.hasControl) return 'You have control';
  return computerLabel(props.mascot.computer);
}

function RailBody(props: {
  missing: boolean;
  offline: boolean;
  asleep: boolean;
  screenshot?: string;
  streamUrl?: string;
  hasControl: boolean;
  onWake: () => void;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  if (props.missing) return <MissingComputer />;
  if (props.offline) return <OfflineComputer onWake={props.onWake} />;
  if (props.asleep) return <AsleepComputer onWake={props.onWake} />;
  return (
    <ComputerDesktop
      src={props.screenshot}
      streamUrl={props.streamUrl}
      offline={false}
      interactive={props.hasControl}
      onInput={props.onInput}
    />
  );
}

function MissingComputer(): JSX.Element {
  return (
    <HonestState
      kind="empty"
      title="No computer yet"
      body="Cortex has not provisioned a machine for this mascot."
    />
  );
}

function OfflineComputer(props: { onWake: () => void }): JSX.Element {
  return (
    <HonestState
      kind="error"
      title="Computer offline"
      body="The farm or local daemon is not connected. This is not a live desktop."
      actionLabel="Retry wake"
      onAction={props.onWake}
    />
  );
}

function AsleepComputer(props: { onWake: () => void }): JSX.Element {
  return (
    <HonestState
      kind="empty"
      title="Asleep"
      body="Unused machines sleep. Take control to wake this mascot's box."
      actionLabel="Wake"
      onAction={props.onWake}
    />
  );
}

function RailActions(props: {
  hasControl: boolean;
  missing: boolean;
  onTakeControl: () => void;
  onRelease: () => void;
}): JSX.Element {
  return (
    <div class="cx-computer-rail__actions">
      <Show
        when={props.hasControl}
        fallback={
          <Button variant="primary" disabled={props.missing} onClick={() => props.onTakeControl()}>
            Take control
          </Button>
        }
      >
        <Button variant="secondary" onClick={() => props.onRelease()}>
          Release
        </Button>
      </Show>
    </div>
  );
}

function RuntimePicker(props: {
  current?: ComputerRuntime;
  signedIn: boolean;
  onRuntime: (runtime: ComputerRuntime) => void;
}): JSX.Element {
  return (
    <div class="cx-runtime-picker" role="group" aria-label="Runtime">
      <For each={RUNTIMES}>
        {(runtime) => {
          const locked = lockReason(runtime.id, props.signedIn);
          return (
            <button
              type="button"
              class="cx-runtime-picker__option"
              aria-pressed={props.current === runtime.id}
              aria-disabled={Boolean(locked)}
              title={locked}
              disabled={Boolean(locked)}
              onClick={() => {
                if (!locked) props.onRuntime(runtime.id);
              }}
            >
              {runtime.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}

export function lockReason(runtime: ComputerRuntime, signedIn: boolean): string | undefined {
  if (runtime === 'this_pc' && !hasElectronHost()) {
    return 'This PC runs in the Cortex desktop app.';
  }
  if ((runtime === 'ssh' || runtime === 'cloud') && !signedIn) {
    return 'Cloud and SSH need a Cortex account.';
  }
  return undefined;
}
