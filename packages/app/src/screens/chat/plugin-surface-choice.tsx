/**
 * Where one plugin's tools may be used: Cortex Chat, Cortex Bot, or both.
 *
 * Two real checkboxes rather than a drawn control, for the same reason the
 * Settings switch is one: they are focusable, they announce their own state,
 * and Space works without any of it being reimplemented here.
 *
 * The boxes are driven by the assignment the account holds, never by the click
 * — a connected plugin's change is a write to the service, and a switch that
 * moved before the service agreed would claim a filter the agent loops are not
 * applying yet. So the click is undone immediately and the box moves when the
 * assignment does.
 */

import { createSignal, createUniqueId, For, type JSX, Show } from 'solid-js';

import {
  PLUGIN_SURFACES,
  togglePluginSurface,
  type PluginSurface,
} from '../../state/plugin-surfaces.ts';

const SURFACE_LABELS: Record<PluginSurface, string> = {
  chat: 'Chat',
  bot: 'Bot',
};

export interface PluginSurfaceChoiceProps {
  /** The app's name, so each group and box says which plugin it belongs to. */
  appName: string;
  surfaces: readonly PluginSurface[];
  /** False while the app is still a catalogue row, which changes the wording only. */
  connected: boolean;
  onChange: (surfaces: readonly PluginSurface[]) => void;
}

export function PluginSurfaceChoice(props: PluginSurfaceChoiceProps): JSX.Element {
  const [refusal, setRefusal] = createSignal('');
  const labelId = createUniqueId();

  const choose = (surface: PluginSurface, input: HTMLInputElement): void => {
    const next = togglePluginSurface(props.surfaces, surface, input.checked);
    // The state decides what the box shows; the click only asks for a change.
    input.checked = props.surfaces.includes(surface);
    if (!next) {
      setRefusal(
        `${props.appName} stays in Chat or Bot. Disconnect it to stop using it in both.`,
      );
      return;
    }
    setRefusal('');
    props.onChange(next);
  };

  return (
    <div class="cx-plugin-card__surfaces">
      {/* `role="group"` rather than a fieldset: a `legend` is positioned by its
          fieldset and not by the fieldset's flex context, so at narrow widths it
          held its own line and the second switch wrapped underneath it. */}
      <div class="cx-surface-set" role="group" aria-labelledby={labelId}>
        {/* Short, because the card above it already names the app and each
            switch carries the full "Use Gmail in Cortex Chat" for a screen
            reader. A sentence here wrapped the pair apart at 768. */}
        <span class="cx-surface-set__legend" id={labelId}>
          {props.connected ? 'Used in' : 'Use in'}
        </span>
        <For each={PLUGIN_SURFACES}>
          {(surface) => (
            <label class="cx-surface-toggle">
              <input
                type="checkbox"
                checked={props.surfaces.includes(surface)}
                aria-label={`Use ${props.appName} in Cortex ${SURFACE_LABELS[surface]}`}
                onChange={(event) => choose(surface, event.currentTarget)}
              />
              <span>{SURFACE_LABELS[surface]}</span>
            </label>
          )}
        </For>
      </div>
      <Show when={refusal()}>
        {(message) => (
          <p class="cx-plugin-card__hint" role="status">
            {message()}
          </p>
        )}
      </Show>
    </div>
  );
}
