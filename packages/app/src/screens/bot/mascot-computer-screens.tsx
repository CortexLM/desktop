import { type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import type { ComputerStatus, Mascot } from '../../state/bots.ts';

import '../chat/product-pages.css';

const COPY: Record<ComputerStatus, { title: string; body: string }> = {
  empty: {
    title: 'No computer yet',
    body: 'A mascot is always created with a machine. This state should only last through create.',
  },
  hibernated: {
    title: 'Hibernated',
    body: 'Unused farm machines sleep. x86_64, 4 vCPU, 16 GiB, browser preinstalled. Wake to resume.',
  },
  waking: {
    title: 'Waking',
    body: 'Asking the farm for this mascot’s dedicated box. Nothing is shared with another bot.',
  },
  running: {
    title: 'Awake',
    body: 'This computer belongs only to this mascot. VNC mounts when the farm stream is reachable.',
  },
  'wake-failed': {
    title: 'Wake failed',
    body: 'The farm did not come back. Retry, or leave it hibernated. A notification was posted.',
  },
};

export function BotComputerScreen(props: {
  mascot?: Mascot;
  onWake: () => void;
  onHibernate: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <Show
      when={props.mascot}
      fallback={
        <HonestState kind="error" title="Mascot not found" body="No computer without a mascot." actionLabel="Back" onAction={props.onBack} />
      }
    >
      {(mascot) => {
        const status = () => mascot().computer.status;
        const copy = () => COPY[status()];
        return (
          <>
            <PageHeader
              title="Computer"
              subtitle={`${mascot().name} · ${mascot().computer.spec.arch} · ${mascot().computer.spec.vcpu} vCPU · ${mascot().computer.spec.memoryGiB} GiB`}
            />
            <PageBody width="list">
              <HonestState
                kind={status() === 'wake-failed' ? 'error' : status() === 'waking' ? 'loading' : 'empty'}
                title={copy().title}
                body={mascot().computer.lastError ?? copy().body}
                actionLabel={status() === 'hibernated' || status() === 'wake-failed' ? 'Wake' : undefined}
                onAction={status() === 'hibernated' || status() === 'wake-failed' ? props.onWake : undefined}
              />
              <Show when={status() === 'running'}>
                <div class="cx-vnc" role="img" aria-label="Dedicated computer">
                  VNC stream is not attached. The farm did not return a display URL.
                </div>
                <div style={{ height: '12px' }} />
                <Button variant="secondary" onClick={() => props.onHibernate()}>
                  Hibernate
                </Button>
              </Show>
            </PageBody>
          </>
        );
      }}
    </Show>
  );
}

export function BotSettingsScreen(props: { mascot?: Mascot; onBack: () => void }): JSX.Element {
  return (
    <Show
      when={props.mascot}
      fallback={<HonestState kind="error" title="Mascot not found" body="Settings need a mascot." actionLabel="Back" onAction={props.onBack} />}
    >
      {(mascot) => (
        <>
          <PageHeader title="Mascot settings" subtitle={mascot().name} />
          <PageBody width="settings">
            <p class="cx-product-row__meta">
              Shape {mascot().shape} · colour {mascot().color}. The computer id {mascot().computer.id} is
              bound to this mascot and cannot be reassigned.
            </p>
          </PageBody>
        </>
      )}
    </Show>
  );
}
