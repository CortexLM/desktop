import { For, type JSX, Show } from 'solid-js';

import { Button, Icon, SESSION_STATUS_TONES, type SessionStatus } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';

import './sessions.css';

export interface InboxSession {
  id: string;
  title: string;
  branch: string;
  repo: string;
  status: SessionStatus;
  diff?: { added: number; removed: number };
  /** Pre-formatted, e.g. "4m ago". */
  age: string;
  /** Shows the 7px lane dot. */
  unread?: boolean;
}

export interface SessionFilter {
  id: string;
  label: string;
  /** Shown after the label. Omitted rather than rendered as 0 when there is no count. */
  count?: number;
}

export interface SessionsScreenProps {
  sessions: readonly InboxSession[];
  filters: readonly SessionFilter[];
  activeFilter: string;
  onFilterChange: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenSession: (id: string) => void;
  onNewSession?: () => void;
  /** Copy for the empty state, which changes with the active filter. */
  emptyState?: { title: string; body: string };
}

interface RepoGroup {
  repo: string;
  sessions: InboxSession[];
}

/** Groups by repo, preserving arrival order both between and within groups. */
function groupByRepo(sessions: readonly InboxSession[]): RepoGroup[] {
  const groups: RepoGroup[] = [];

  for (const session of sessions) {
    const existing = groups.find((group) => group.repo === session.repo);
    if (existing) existing.sessions.push(session);
    else groups.push({ repo: session.repo, sessions: [session] });
  }

  return groups;
}

function SegmentedFilter(props: {
  filters: readonly SessionFilter[];
  active: string;
  onChange: (id: string) => void;
}): JSX.Element {
  return (
    <div class="cx-segmented" role="group" aria-label="Filter sessions">
      <For each={props.filters}>
        {(filter) => (
          <button
            type="button"
            class="cx-segmented__option"
            aria-pressed={filter.id === props.active}
            onClick={() => props.onChange(filter.id)}
          >
            {filter.label}
            <Show when={filter.count !== undefined}>{` ${filter.count}`}</Show>
          </button>
        )}
      </For>
    </div>
  );
}

function InboxRow(props: { session: InboxSession; onOpen: (id: string) => void }): JSX.Element {
  const tone = () => SESSION_STATUS_TONES[props.session.status].tone;

  return (
    <button
      type="button"
      class="cx-inbox__row"
      onClick={() => props.onOpen(props.session.id)}
      aria-label={`${props.session.title}, ${SESSION_STATUS_TONES[props.session.status].label}`}
    >
      <span class="cx-inbox__unread">
        <Show when={props.session.unread}>
          <span class="cx-inbox__unread-dot" role="img" aria-label="Unread" />
        </Show>
      </span>

      <span class="cx-inbox__title-column">
        <span class="cx-inbox__title">{props.session.title}</span>
        <span class="cx-inbox__branch">{props.session.branch}</span>
      </span>

      <span class="cx-inbox__status">
        <span class={`cx-inbox__status-dot cx-inbox__status-dot--${tone()}`} aria-hidden="true" />
        {SESSION_STATUS_TONES[props.session.status].label}
      </span>

      <span class="cx-inbox__diff">
        <Show when={props.session.diff}>
          {(diff) => (
            <>
              <span class="cx-inbox__added">+{diff().added}</span>
              <span class="cx-inbox__removed">
                {'\u2212'}
                {diff().removed}
              </span>
            </>
          )}
        </Show>
      </span>

      <span class="cx-inbox__age">{props.session.age}</span>
    </button>
  );
}

function ControlsRow(props: {
  filters: readonly SessionFilter[];
  activeFilter: string;
  onFilterChange: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
}): JSX.Element {
  return (
    <div class="cx-sessions__controls">
      <SegmentedFilter
        filters={props.filters}
        active={props.activeFilter}
        onChange={props.onFilterChange}
      />
      <span class="cx-sessions__spacer" />
      <div class="cx-sessions__search">
        <Icon name="search" size={13} />
        <input
          type="search"
          class="cx-sessions__search-input"
          placeholder="Search sessions"
          value={props.query}
          aria-label="Search sessions"
          onInput={(event) => props.onQueryChange(event.currentTarget.value)}
        />
      </div>
    </div>
  );
}

function EmptyState(props: { title?: string; body?: string }): JSX.Element {
  return (
    <div class="cx-empty">
      <p class="cx-empty__title">{props.title ?? 'No sessions yet'}</p>
      <p class="cx-empty__body">
        {props.body ??
          'Start one from the composer on Home, and it will show up here as it runs.'}
      </p>
    </div>
  );
}

function Inbox(props: { groups: RepoGroup[]; onOpen: (id: string) => void }): JSX.Element {
  return (
    <div class="cx-inbox">
      <For each={props.groups}>
        {(group) => (
          <>
            <div class="cx-inbox__group">
              <Icon name="folder" size={12} />
              <span class="cx-inbox__group-name">{group.repo}</span>
              <span class="cx-inbox__group-count">
                {group.sessions.length}
                {group.sessions.length === 1 ? ' session' : ' sessions'}
              </span>
            </div>
            <For each={group.sessions}>
              {(session) => <InboxRow session={session} onOpen={props.onOpen} />}
            </For>
          </>
        )}
      </For>
    </div>
  );
}

/**
 * Sessions: the inbox of everything running or finished, grouped by repo.
 *
 * The Empty States artboard is this screen with nothing in the list, so it is a branch here
 * rather than a route of its own. The controls stay mounted in that branch: hiding them
 * would trap the user in an empty filter with no way back.
 */
export function SessionsScreen(props: SessionsScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Sessions"
        actions={
          <Show when={props.onNewSession}>
            {(start) => (
              <Button variant="primary" icon="plusSmall" onClick={() => start()()}>
                New session
              </Button>
            )}
          </Show>
        }
      />

      <PageBody width="list">
        <div class="cx-sessions">
          <ControlsRow
            filters={props.filters}
            activeFilter={props.activeFilter}
            onFilterChange={props.onFilterChange}
            query={props.query}
            onQueryChange={props.onQueryChange}
          />

          <Show
            when={props.sessions.length > 0}
            fallback={
              <EmptyState title={props.emptyState?.title} body={props.emptyState?.body} />
            }
          >
            <Inbox groups={groupByRepo(props.sessions)} onOpen={props.onOpenSession} />
          </Show>
        </div>
      </PageBody>
    </>
  );
}
