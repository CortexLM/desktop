import { type JSX, Match, Show, Switch } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import type { ComputerInput } from '@cortex-ide/cortex-api';

import { HonestState } from '../shared/honest-state.tsx';
import { ComputerDesktop, type DesktopTransport } from './computer-desktop.tsx';
import { computerIsMissing, computerIsOffline, computerLabel, type Mascot } from '../../state/bot-map.ts';

export function ComputerRail(props: {
  mascot: Mascot;
  screenshot?: string;
  streamUrl?: string;
  transport?: DesktopTransport;
  error?: string;
  onWake: () => void;
  onHibernate: () => void;
  onInput: (input: ComputerInput) => void;
  onOpenPage: () => void;
  onClose?: () => void;
}): JSX.Element {
  return (
    <aside class="cx-computer-rail" aria-label="Computer">
      <div class="cx-computer-rail__head">
        <div>
          <div class="cx-product-row__title">Computer</div>
          <p class="cx-product-row__meta">{computerLabel(props.mascot.computer)}</p>
        </div>
        <Show when={props.onClose}>
          <Button variant="ghost" onClick={() => props.onClose?.()}>
            Hide
          </Button>
        </Show>
      </div>
      <Show when={props.error}>
        <HonestState kind="error" title="Computer error" body={props.error ?? ''} />
      </Show>
      <RailStates
        mascot={props.mascot}
        screenshot={props.screenshot}
        streamUrl={props.streamUrl}
        transport={props.transport}
        onWake={props.onWake}
        onHibernate={props.onHibernate}
        onInput={props.onInput}
      />
      <Button variant="secondary" onClick={() => props.onOpenPage()}>
        Open computer
      </Button>
    </aside>
  );
}

function RailStates(props: {
  mascot: Mascot;
  screenshot?: string;
  streamUrl?: string;
  transport?: DesktopTransport;
  onWake: () => void;
  onHibernate: () => void;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  const missing = () => computerIsMissing(props.mascot.computer);
  const offline = () => computerIsOffline(props.mascot.computer);
  const asleep = () =>
    props.mascot.computer.status === 'hibernated' || props.mascot.computer.status === 'stopped';

  return (
    <Switch fallback={<RunningRail {...props} />}>
      <Match when={missing()}>
        <HonestState
          kind="empty"
          title="No computer yet"
          body="Cortex has not provisioned a machine for this mascot."
        />
      </Match>
      <Match when={offline()}>
        <HonestState
          kind="error"
          title="Computer offline"
          body="The farm or local daemon is not connected. This is not a live desktop."
          actionLabel="Retry wake"
          onAction={props.onWake}
        />
      </Match>
      <Match when={asleep()}>
        <HonestState
          kind="empty"
          title="Hibernated"
          body="Wake to resume this mascot’s dedicated box."
          actionLabel="Wake"
          onAction={props.onWake}
        />
      </Match>
    </Switch>
  );
}

function RunningRail(props: {
  screenshot?: string;
  streamUrl?: string;
  transport?: DesktopTransport;
  onHibernate: () => void;
  onInput: (input: ComputerInput) => void;
}): JSX.Element {
  return (
    <>
      <ComputerDesktop
        src={props.screenshot}
        streamUrl={props.streamUrl}
        offline={false}
        transport={props.transport}
        onInput={props.onInput}
      />
      <Button variant="secondary" onClick={() => props.onHibernate()}>
        Hibernate
      </Button>
    </>
  );
}
