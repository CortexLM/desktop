import { Match, Switch, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';
import { farmOfflineCopy, type ComputerInput } from '@cortex-ide/cortex-api';

import { HonestState } from '../shared/honest-state.tsx';
import { ComputerDesktop } from './computer-desktop.tsx';
import {
  computerIsMissing,
  computerIsOffline,
  computerLabel,
  type ComputerRuntime,
  type Mascot,
} from '../../state/bot-map.ts';

type ComputerRailProps = {
  mascot: Mascot;
  screenshot?: string;
  streamUrl?: string;
  hasControl: boolean;
  signedIn?: boolean;
  error?: string;
  onTakeControl: () => void;
  onRelease: () => void;
  onWake: () => void;
  onRuntime?: (runtime: ComputerRuntime) => void;
  onInput: (input: ComputerInput) => void;
};

export function ComputerRail(props: ComputerRailProps): JSX.Element {
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
  return (
    <Switch
      fallback={
        <ComputerDesktop
          src={props.screenshot}
          streamUrl={props.streamUrl}
          offline={false}
          interactive={props.hasControl}
          onInput={props.onInput}
        />
      }
    >
      <Match when={props.missing}>
        <MissingComputer />
      </Match>
      <Match when={props.offline}>
        <OfflineComputer onWake={props.onWake} />
      </Match>
      <Match when={props.asleep}>
        <AsleepComputer onWake={props.onWake} />
      </Match>
    </Switch>
  );
}

function MissingComputer(): JSX.Element {
  return (
    <HonestState
      kind="empty"
      title="No computer yet"
      body="Cortex has not provisioned a cloud computer for this mascot."
    />
  );
}

function OfflineComputer(props: { onWake: () => void }): JSX.Element {
  const copy = farmOfflineCopy();
  return (
    <HonestState
      kind="error"
      title={copy.title}
      body={copy.body}
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

