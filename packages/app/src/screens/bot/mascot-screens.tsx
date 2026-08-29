import { For, type JSX, Match, Show, Switch } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { computerLabel, isPendingAsk, isPendingSecret, type Mascot, type MascotFace, type MascotLook } from '../../state/bot-map.ts';
import { MascotIdentityFields } from './mascot-identity.tsx';
import { resolveMascotMotion } from './mascot-looks.ts';
import { MascotMark } from './mascot-mark.tsx';

import '../chat/product-pages.css';

export function MascotListScreen(props: {
  mascots: readonly Mascot[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  loading?: boolean;
  error?: string;
  unavailable?: boolean;
}): JSX.Element {
  return (
    <>
      <PageHeader
        title="Bot"
        subtitle="Each mascot owns one dedicated computer. Machines are never shared."
        actions={<Button variant="primary" onClick={() => props.onCreate()}>New mascot</Button>}
      />
      <PageBody width="list">
        <MascotListBody
          mascots={props.mascots}
          loading={props.loading}
          error={props.error}
          unavailable={props.unavailable}
          onOpen={props.onOpen}
          onCreate={props.onCreate}
        />
      </PageBody>
    </>
  );
}

/**
 * Which state the list is in.
 *
 * `Switch` / `Match` rather than a chain of early `return`s: a component body runs
 * once in Solid, so the `if` chain this replaced froze whichever branch was true at
 * first paint. The first paint is always "no mascots yet", so a signed-in account
 * with mascots kept showing the empty state after the list arrived — the reconcile
 * worked and the screen never reflected it.
 */
function MascotListBody(props: {
  mascots: readonly Mascot[];
  loading?: boolean;
  error?: string;
  unavailable?: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
}): JSX.Element {
  return (
    <Switch fallback={<MascotGrid mascots={props.mascots} onOpen={props.onOpen} />}>
      <Match when={props.loading}>
        <HonestState kind="loading" title="Loading mascots" body="Asking the Bot API." />
      </Match>
      <Match when={props.unavailable}>
        <HonestState
          kind="error"
          title="Bot API not connected"
          body={props.error || 'This origin cannot reach the mascot service. Nothing is stored locally as a stand-in.'}
        />
      </Match>
      <Match when={props.error}>
        <HonestState kind="error" title="Could not load mascots" body={props.error ?? ''} />
      </Match>
      <Match when={props.mascots.length === 0}>
        <HonestState
          kind="empty"
          title="No mascots"
          body="Create a look and a face. Cortex provisions a computer that belongs only to that mascot."
          actionLabel="New mascot"
          onAction={props.onCreate}
        />
      </Match>
    </Switch>
  );
}

function MascotGrid(props: {
  mascots: readonly Mascot[];
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <div class="cx-mascot-grid">
      <For each={props.mascots}>
        {(mascot) => (
          <button type="button" class="cx-product-row" onClick={() => props.onOpen(mascot.id)}>
            <MascotMark
              look={mascot.look}
              face={mascot.face}
              seed={mascot.id}
              size={48}
              state={rowMotion(mascot)}
            />
            <div>
              <div class="cx-product-row__title">{mascot.name}</div>
              <p class="cx-product-row__meta">{computerLabel(mascot.computer)}</p>
            </div>
          </button>
        )}
      </For>
    </div>
  );
}

function rowMotion(mascot: Mascot) {
  const waiting = mascot.messages.some((message) => isPendingAsk(message) || isPendingSecret(message));
  return resolveMascotMotion({
    computer: mascot.computer.status,
    unread: mascot.unread || waiting,
  });
}

export function CreateMascotScreen(props: {
  name: string;
  onName: (value: string) => void;
  look: MascotLook;
  onLook: (look: MascotLook) => void;
  face: MascotFace;
  onFace: (face: MascotFace) => void;
  onCreate: () => void;
  error?: string;
}): JSX.Element {
  return (
    <>
      <PageHeader title="New mascot" subtitle="Look and face. A dedicated computer is created with it." />
      <PageBody width="settings">
        <label class="cx-product-row__title" for="mascot-name">Name</label>
        <input
          id="mascot-name"
          class="cx-product-row"
          value={props.name}
          onInput={(event) => props.onName(event.currentTarget.value)}
          placeholder="Ana's researcher"
        />
        <MascotIdentityFields look={props.look} face={props.face} onLook={props.onLook} onFace={props.onFace} />
        <Show when={props.error}>
          <HonestState kind="error" title="Could not create" body={props.error ?? ''} />
        </Show>
        <Button variant="primary" onClick={() => props.onCreate()}>Create mascot</Button>
      </PageBody>
    </>
  );
}
