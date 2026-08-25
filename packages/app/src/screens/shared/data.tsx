import { For, type JSX, Show } from 'solid-js';

import { Button, Icon, type IconName } from '@cortex-ide/ui';

import './data.css';

export interface StatProps {
  label: string;
  value: string;
  /** Change against the previous period, e.g. "+12% vs last month". */
  delta?: string;
  /** Which way the change reads. Omitted when a change is neither good nor bad. */
  direction?: 'up' | 'down';
}

/**
 * A single figure with its label.
 *
 * `direction` is separate from `delta` because up is not always good: more sessions is
 * healthy, more errors is not, and the caller is the only thing that knows which.
 */
export function Stat(props: StatProps): JSX.Element {
  const deltaClass = () =>
    props.direction ? `cx-stat__delta cx-stat__delta--${props.direction}` : 'cx-stat__delta';

  return (
    <div class="cx-stat">
      <span class="cx-stat__label">{props.label}</span>
      <span class="cx-stat__value">{props.value}</span>
      <Show when={props.delta}>{(delta) => <span class={deltaClass()}>{delta()}</span>}</Show>
    </div>
  );
}

export function StatRow(props: { stats: readonly StatProps[] }): JSX.Element {
  return (
    <div class="cx-stats">
      <For each={props.stats}>{(stat) => <Stat {...stat} />}</For>
    </div>
  );
}

export interface TableColumn {
  key: string;
  label: string;
  /** Right-aligns with tabular figures. */
  numeric?: boolean;
  mono?: boolean;
  muted?: boolean;
}

export interface TableProps {
  caption: string;
  columns: readonly TableColumn[];
  rows: readonly Record<string, JSX.Element>[];
  emptyMessage?: string;
}

/**
 * A data table.
 *
 * A real `<table>` rather than a grid of divs: the screens here show tabular data, and a
 * table gives row and column association to assistive technology for free. The caption is
 * required and visually hidden by the browser's own default only when a screen supplies its
 * heading elsewhere - here it names the table for a screen reader.
 */
export function Table(props: TableProps): JSX.Element {
  const cellClass = (column: TableColumn) =>
    [
      column.numeric ? 'cx-table__numeric' : '',
      column.mono ? 'cx-table__mono' : '',
      column.muted ? 'cx-table__muted' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <Show
      when={props.rows.length > 0}
      fallback={<p class="cx-table__empty">{props.emptyMessage ?? 'Nothing to show yet.'}</p>}
    >
      <table class="cx-table">
        <caption class="cx-visually-hidden">{props.caption}</caption>
        <thead>
          <tr>
            <For each={props.columns}>
              {(column) => (
                <th scope="col" class={column.numeric ? 'cx-table__numeric' : undefined}>
                  {column.label}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row) => (
              <tr>
                <For each={props.columns}>
                  {(column) => <td class={cellClass(column)}>{row[column.key]}</td>}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </Show>
  );
}

export interface SectionProps {
  title: string;
  note?: string;
  action?: JSX.Element;
  children: JSX.Element;
}

export function Section(props: SectionProps): JSX.Element {
  return (
    <section class="cx-section" aria-label={props.title}>
      <div class="cx-section__header">
        <h2 class="cx-section__title">{props.title}</h2>
        <Show when={props.note}>{(note) => <span class="cx-section__note">{note()}</span>}</Show>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

export interface TileProps {
  title: string;
  body: string;
  icon: IconName;
  /** Copy describing the current state, e.g. "Runs nightly" or "Not enabled". */
  state?: string;
  enabled?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  onOpen?: () => void;
}

export function Tile(props: TileProps): JSX.Element {
  return (
    <div
      class={props.enabled ? 'cx-tile cx-tile--enabled' : 'cx-tile'}
      role={props.onOpen ? 'button' : undefined}
      tabIndex={props.onOpen ? 0 : undefined}
      onClick={() => props.onOpen?.()}
      onKeyDown={(event) => {
        // A div given a button role has to answer to Enter and Space itself; a real button
        // is not usable here because the card contains its own action button.
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        props.onOpen?.();
      }}
    >
      <div class="cx-tile__illustration" aria-hidden="true">
        <Icon name={props.icon} size={28} />
      </div>
      <span class="cx-tile__title">{props.title}</span>
      <p class="cx-tile__body">{props.body}</p>
      <div class="cx-tile__footer">
        <Show when={props.state}>{(state) => <span class="cx-tile__state">{state()}</span>}</Show>
        <Show when={props.actionLabel}>
          {(label) => (
            <Button
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation();
                props.onAction?.();
              }}
            >
              {label()}
            </Button>
          )}
        </Show>
      </div>
    </div>
  );
}

export interface GateProps {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * What an account-only screen shows without an account.
 *
 * Reachable only by deep link, since the sidebar rows are already locked - so it explains
 * the gate and offers the way through rather than just refusing.
 */
export function Gate(props: GateProps): JSX.Element {
  return (
    <div class="cx-gate">
      <h2 class="cx-gate__title">{props.title}</h2>
      <p class="cx-gate__body">{props.body}</p>
      <Button variant="primary" onClick={() => props.onAction()}>
        {props.actionLabel}
      </Button>
    </div>
  );
}
