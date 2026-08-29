import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { MascotRail, mascotLinks } from './mascot-rail.tsx';
import type { Mascot, MascotColor, MascotShape } from '../../state/bot-map.ts';

import '../chat/product-pages.css';

const SHAPES: readonly MascotShape[] = ['round', 'square', 'tall', 'wide'];
const COLORS: readonly MascotColor[] = ['green', 'terracotta', 'ink'];

/**
 * Shape and colour, editable.
 *
 * The same segmented controls the create screen uses, so a mascot is not permanently
 * whatever it was made as. `PATCH /v1/mascots/{id}` has always been in the client;
 * this screen simply printed the values as prose and offered no way to change them.
 */
function Appearance(props: {
  shape: MascotShape;
  color: MascotColor;
  onShape: (shape: MascotShape) => void;
  onColor: (color: MascotColor) => void;
}): JSX.Element {
  return (
    <>
      <h3 class="cx-product-section">Shape</h3>
      <div class="cx-mascot-rail">
        <For each={SHAPES}>
          {(shape) => (
            <Button
              variant={props.shape === shape ? 'primary' : 'secondary'}
              aria-pressed={props.shape === shape}
              onClick={() => props.onShape(shape)}
            >
              {shape}
            </Button>
          )}
        </For>
      </div>
      <h3 class="cx-product-section">Colour</h3>
      <div class="cx-mascot-rail">
        <For each={COLORS}>
          {(color) => (
            <Button
              variant={props.color === color ? 'primary' : 'secondary'}
              aria-pressed={props.color === color}
              onClick={() => props.onColor(color)}
            >
              {color}
            </Button>
          )}
        </For>
      </div>
    </>
  );
}

export interface BotSettingsScreenProps {
  mascot?: Mascot;
  error?: string;
  saving?: boolean;
  onRename: (name: string) => void;
  onShape: (shape: MascotShape) => void;
  onColor: (color: MascotColor) => void;
  onDelete: () => void;
  onBack: () => void;
  onGo: (path: string) => void;
}

function RenameForm(props: {
  mascot: Mascot;
  saving?: boolean;
  onRename: (name: string) => void;
}): JSX.Element {
  const [name, setName] = createSignal<string | undefined>();

  return (
    <form
      class="cx-product-form"
      onSubmit={(event) => {
        event.preventDefault();
        props.onRename(name() ?? props.mascot.name);
      }}
    >
      <input
        type="text"
        value={name() ?? props.mascot.name}
        aria-label="Mascot name"
        onInput={(event) => setName(event.currentTarget.value)}
      />
      <Button variant="secondary" type="submit" disabled={props.saving}>Rename</Button>
    </form>
  );
}

/**
 * Deleting, behind a confirmation.
 *
 * Confirmed because the mascot's dedicated computer goes with it and this client
 * cannot undo either.
 */
function DeleteMascot(props: { mascot: Mascot; onDelete: () => void }): JSX.Element {
  const [confirming, setConfirming] = createSignal(false);

  return (
    <>
      <h3 class="cx-product-section">Delete</h3>
      <Show
        when={confirming()}
        fallback={
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Delete mascot
          </Button>
        }
      >
        <p class="cx-product-row__meta">
          Deleting {props.mascot.name} also destroys its dedicated computer and everything on it.
        </p>
        <div class="cx-mascot-rail">
          <Button variant="destructive" onClick={() => props.onDelete()}>
            Delete permanently
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      </Show>
    </>
  );
}

export function BotSettingsScreen(props: BotSettingsScreenProps): JSX.Element {
  return (
    <Show
      when={props.mascot}
      fallback={<HonestState kind="error" title="Mascot not found" body="Settings need a mascot." actionLabel="Back" onAction={props.onBack} />}
    >
      {(mascot) => (
        <>
          <PageHeader title="Mascot settings" subtitle={mascot().name} />
          <PageBody width="settings">
            <MascotRail links={mascotLinks(mascot().id, 'settings', props.onGo)} />
            <Show when={props.error}>
              <p class="cx-product-error" role="alert">{props.error}</p>
            </Show>

            <RenameForm mascot={mascot()} saving={props.saving} onRename={props.onRename} />
            <Appearance
              shape={mascot().shape}
              color={mascot().color}
              onShape={props.onShape}
              onColor={props.onColor}
            />

            <h3 class="cx-product-section">Computer</h3>
            <p class="cx-product-row__meta">
              The computer id {mascot().computer.id} is bound to this mascot and cannot be
              reassigned.
            </p>

            <DeleteMascot mascot={mascot()} onDelete={props.onDelete} />
          </PageBody>
        </>
      )}
    </Show>
  );
}
