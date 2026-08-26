import { For, type JSX, Show, splitProps } from 'solid-js';

import { Icon, type IconName } from '../icons/icon.tsx';
import type { IconKey } from '../icons/geometry.generated.ts';

import './tabs.css';

export interface TabDefinition {
  id: string;
  label: string;
  icon?: IconName | IconKey;
  /** Shown as a pill after the label. The Changes tab carries a file count. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  tabs: readonly TabDefinition[];
  active: string;
  onChange: (id: string) => void;
  /** Accessible name for the tab strip, e.g. "Session workbench". */
  label: string;
}

interface TabButtonProps {
  tab: TabDefinition;
  selected: boolean;
  onSelect: () => void;
}

function TabButton(props: TabButtonProps): JSX.Element {
  return (
    <button
      type="button"
      class="cx-tabs__tab"
      role="tab"
      id={`tab-${props.tab.id}`}
      aria-selected={props.selected}
      aria-controls={`panel-${props.tab.id}`}
      // Only the selected tab is reachable by Tab; arrow keys move within the strip.
      tabIndex={props.selected ? 0 : -1}
      disabled={props.tab.disabled}
      onClick={() => props.onSelect()}
    >
      <span class="cx-tabs__label">
        <Show when={props.tab.icon}>{(name) => <Icon name={name()} size={15} strokeWidth={1.75} />}</Show>
        {props.tab.label}
        <Show when={props.tab.count !== undefined}>
          <span class="cx-tabs__count">{props.tab.count}</span>
        </Show>
      </span>
      <span class="cx-tabs__indicator" aria-hidden="true" />
    </button>
  );
}

/**
 * The tab strip from the session workbench: Shell, Changes, PR, Browser.
 *
 * Keyboard handling follows the ARIA tabs pattern - arrow keys move selection, Home and End
 * jump to the ends - because a `<button>` list alone gives you Tab-through-each, which is
 * tedious once the strip has four entries and a panel beneath it.
 */
export function Tabs(props: TabsProps): JSX.Element {
  const [local, rest] = splitProps(props, ['tabs', 'active', 'onChange', 'label', 'class']);

  const selectable = () => local.tabs.filter((tab) => !tab.disabled);

  const move = (offset: number) => {
    const options = selectable();
    if (options.length === 0) return;
    const current = options.findIndex((tab) => tab.id === local.active);
    // Wraps rather than clamping: with four tabs, stopping at the ends means the user has
    // to reverse direction to reach the one next to where they started.
    const next = (current + offset + options.length) % options.length;
    local.onChange(options[next]!.id);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const handlers: Record<string, () => void> = {
      ArrowRight: () => move(1),
      ArrowLeft: () => move(-1),
      Home: () => local.onChange(selectable()[0]?.id ?? local.active),
      End: () => local.onChange(selectable().at(-1)?.id ?? local.active),
    };

    const handler = handlers[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  return (
    <div class={local.class ? `cx-tabs ${local.class}` : 'cx-tabs'} {...rest}>
      <div class="cx-tabs__list" role="tablist" aria-label={local.label} onKeyDown={onKeyDown}>
        <For each={local.tabs}>
          {(tab) => (
            <TabButton
              tab={tab}
              selected={tab.id === local.active}
              onSelect={() => local.onChange(tab.id)}
            />
          )}
        </For>
      </div>
    </div>
  );
}

export interface TabPanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  tabId: string;
  active: string;
}

/** The panel a tab controls. Unmounts when inactive rather than hiding with CSS. */
export function TabPanel(props: TabPanelProps): JSX.Element {
  const [local, rest] = splitProps(props, ['tabId', 'active', 'children']);

  return (
    <Show when={local.tabId === local.active}>
      <div id={`panel-${local.tabId}`} role="tabpanel" aria-labelledby={`tab-${local.tabId}`} {...rest}>
        {local.children}
      </div>
    </Show>
  );
}
