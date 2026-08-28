import { For, type JSX, Show } from 'solid-js';

import { Button, Segmented } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import type { Mascot, MascotColor, MascotShape } from '../../state/bots.ts';

import '../chat/product-pages.css';

export function MascotListScreen(props: {
  mascots: readonly Mascot[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}): JSX.Element {
  return (
    <>
      <PageHeader
        title="Bot"
        subtitle="Each mascot owns one dedicated computer. Machines are never shared."
        actions={<Button variant="primary" onClick={() => props.onCreate()}>New mascot</Button>}
      />
      <PageBody width="list">
        <Show
          when={props.mascots.length > 0}
          fallback={
            <HonestState
              kind="empty"
              title="No mascots"
              body="Create a shape and a colour. Cortex provisions a computer that belongs only to that mascot."
              actionLabel="New mascot"
              onAction={props.onCreate}
            />
          }
        >
          <div class="cx-mascot-grid">
            <For each={props.mascots}>
              {(mascot) => (
                <button type="button" class="cx-product-row" onClick={() => props.onOpen(mascot.id)}>
                  <span class={`cx-mascot-swatch cx-mascot-swatch--${mascot.shape} cx-mascot-swatch--${mascot.color}`} />
                  <div>
                    <div class="cx-product-row__title">{mascot.name}</div>
                    <p class="cx-product-row__meta">{mascot.computer.status.replace('-', ' ')}</p>
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </PageBody>
    </>
  );
}

const SHAPES = [
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'tall', label: 'Tall' },
  { id: 'wide', label: 'Wide' },
];

const COLOURS = [
  { id: 'green', label: 'Green' },
  { id: 'terracotta', label: 'Terracotta' },
  { id: 'ink', label: 'Ink' },
];

export function CreateMascotScreen(props: {
  name: string;
  onName: (value: string) => void;
  shape: MascotShape;
  onShape: (shape: MascotShape) => void;
  color: MascotColor;
  onColor: (color: MascotColor) => void;
  onCreate: () => void;
}): JSX.Element {
  return (
    <>
      <PageHeader title="New mascot" subtitle="Shape and colour. A dedicated computer is created with it." />
      <PageBody width="settings">
        <label class="cx-product-row__title" for="mascot-name">Name</label>
        <input
          id="mascot-name"
          class="cx-product-row"
          value={props.name}
          onInput={(event) => props.onName(event.currentTarget.value)}
          placeholder="Ana's researcher"
        />
        <Segmented label="Shape" value={props.shape} onChange={(id) => props.onShape(id as MascotShape)} options={SHAPES} />
        <Segmented label="Colour" value={props.color} onChange={(id) => props.onColor(id as MascotColor)} options={COLOURS} />
        <Button variant="primary" onClick={() => props.onCreate()}>Create mascot</Button>
      </PageBody>
    </>
  );
}
