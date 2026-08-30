import { For, type JSX, Show } from 'solid-js';

import { Icon, NavItem } from '@cortex-ide/ui';

import type { SidebarProps } from './sidebar-types.ts';

interface Destination {
  slug: string;
  label: string;
  icon: 'home' | 'sessions' | 'automations' | 'review' | 'usage' | 'docs' | 'server' | 'clock' | 'settings';
  capability?: keyof SidebarProps['capabilities'];
}

/** Top of the Code rail: start a session, scheduled runs, then settings. */
const CODE_ACTIONS: readonly Destination[] = [
  { slug: 'code-automations', label: 'Routines', icon: 'clock', capability: 'automations' },
  { slug: 'code-settings', label: 'Personalize', icon: 'settings' },
];

const CODE_WORKSPACE: readonly Destination[] = [
  { slug: 'code-sessions', label: 'Sessions', icon: 'sessions' },
  { slug: 'code-tickets', label: 'Tickets', icon: 'docs' },
  { slug: 'code-review', label: 'Review', icon: 'review', capability: 'review' },
  { slug: 'code-usage', label: 'Usage', icon: 'usage', capability: 'usageReporting' },
  { slug: 'code-runtimes', label: 'Runtimes', icon: 'server' },
];

const CHAT_APPS = [
  { id: 'search', slug: undefined, label: 'Search', icon: 'search' as const },
  { id: 'research', slug: 'research', label: 'Research', icon: 'research' as const },
  { id: 'planning', slug: 'planning', label: 'Planning', icon: 'clock' as const },
  { id: 'projects', slug: 'projects', label: 'Projects', icon: 'folder' as const },
  { id: 'library', slug: 'library', label: 'Library', icon: 'docs' as const },
  { id: 'plugins', slug: 'plugins', label: 'Plugins', icon: 'bolt' as const },
];

const BOT_DESTINATIONS = [
  { slug: 'bot-home', label: 'Mascots', icon: 'bot' as const },
];

const BOT_STUDIO = [
  { id: 'routines' as const, label: 'Routines', icon: 'clock' as const },
  { id: 'memory' as const, label: 'Memory', icon: 'docs' as const },
  { id: 'approvals' as const, label: 'Approvals', icon: 'review' as const },
];

function NewButton(props: { label: string; shortcut: string; onPress: () => void }): JSX.Element {
  return (
    <button type="button" class="cx-sidebar__new" onClick={() => props.onPress()}>
      <Icon name="plus" size={15} strokeWidth={1.75} />
      <span class="cx-sidebar__new-label">{props.label}</span>
      <kbd class="cx-sidebar__new-shortcut">{props.shortcut}</kbd>
    </button>
  );
}

export function ChatSections(props: SidebarProps): JSX.Element {
  return (
    <>
      <NewButton label="New chat" shortcut="⌘K" onPress={() => props.onNewChat()} />
      <div class="cx-sidebar__section-title">Apps</div>
      <div class="cx-sidebar__nav">
        <For each={CHAT_APPS}>
          {(app) => (
            <NavItem
              icon={app.icon}
              label={app.label}
              active={app.slug ? props.activeSlug === app.slug : false}
              onClick={() => {
                if (app.id === 'search') props.onOpenSearch?.();
                else if (app.slug) props.onNavigate(app.slug);
              }}
            />
          )}
        </For>
      </div>
      <Show when={props.recentChats.length > 0}>
        <div class="cx-sidebar__section-title">Recents</div>
        <div class="cx-sidebar__recent">
          <For each={props.recentChats}>
            {(chat) => (
              <button type="button" class="cx-sidebar__run" onClick={() => props.onOpenChat(chat.id)}>
                <span class="cx-sidebar__run-title">{chat.title}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

export function CodeSections(props: SidebarProps): JSX.Element {
  const lockReason = (destination: Destination): string | undefined => {
    if (!destination.capability) return undefined;
    if (props.capabilities[destination.capability]) return undefined;
    return `Sign in to Cortex to use ${destination.label}`;
  };

  return (
    <>
      <NewButton label="New session" shortcut="⌘N" onPress={() => props.onNewSession()} />
      <div class="cx-sidebar__nav">
        <For each={CODE_ACTIONS}>
          {(destination) => (
            <NavItem
              icon={destination.icon}
              label={destination.label}
              active={props.activeSlug === destination.slug}
              unread={props.unread?.[destination.slug]}
              lockedReason={lockReason(destination)}
              onClick={() => props.onNavigate(destination.slug)}
            />
          )}
        </For>
      </div>
      <div class="cx-sidebar__section-title">Workspace</div>
      <div class="cx-sidebar__nav">
        <For each={CODE_WORKSPACE}>
          {(destination) => (
            <NavItem
              icon={destination.icon}
              label={destination.label}
              active={props.activeSlug === destination.slug}
              unread={props.unread?.[destination.slug]}
              lockedReason={lockReason(destination)}
              onClick={() => props.onNavigate(destination.slug)}
            />
          )}
        </For>
      </div>
      <Show when={props.recentRuns.length > 0}>
        <div class="cx-sidebar__section-title">Recents</div>
        <RecentRuns runs={props.recentRuns} onOpen={props.onOpenRun} />
      </Show>
    </>
  );
}

export function BotSections(props: SidebarProps): JSX.Element {
  const roster = () => props.mascots ?? [];

  return (
    <>
      <NewButton label="New mascot" shortcut="⌘N" onPress={() => props.onNewMascot()} />
      <div class="cx-sidebar__section-title">Mascots</div>
      <div class="cx-sidebar__nav">
        <For each={BOT_DESTINATIONS}>
          {(destination) => (
            <NavItem
              icon={destination.icon}
              label={destination.label}
              active={props.activeSlug === destination.slug}
              onClick={() => props.onNavigate(destination.slug)}
            />
          )}
        </For>
      </div>
      <MascotRoster
        mascots={roster()}
        activeId={props.activeMascotId}
        onOpen={(id) => props.onOpenMascot?.(id)}
      />
      <div class="cx-sidebar__section-title">Studio</div>
      <div class="cx-sidebar__nav">
        <For each={BOT_STUDIO}>
          {(item) => (
            <NavItem
              icon={item.icon}
              label={item.label}
              active={studioActive(item.id, props.activeSlug)}
              onClick={() => props.onOpenStudio?.(item.id)}
            />
          )}
        </For>
      </div>
    </>
  );
}

function studioActive(id: 'routines' | 'memory' | 'approvals', slug: string): boolean {
  if (id === 'routines') return slug === 'bot-routines';
  if (id === 'memory') return slug === 'bot-memory';
  return slug === 'bot-approvals';
}

function MascotRoster(props: {
  mascots: readonly { id: string; name: string; unread?: boolean }[];
  activeId?: string;
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <Show
      when={props.mascots.length > 0}
      fallback={<p class="cx-sidebar__empty">No mascots yet. Create one to start.</p>}
    >
      <div class="cx-sidebar__recent">
        <For each={props.mascots}>
          {(mascot) => (
            <button
              type="button"
              class="cx-sidebar__run"
              aria-current={props.activeId === mascot.id ? 'page' : undefined}
              onClick={() => props.onOpen(mascot.id)}
            >
              <span class="cx-sidebar__run-title">{mascot.name}</span>
              <Show when={mascot.unread}>
                <span class="cx-sidebar__run-live" role="img" aria-label="Unread" />
              </Show>
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}

function groupByRepo(runs: SidebarProps['recentRuns']) {
  const groups: Array<{ repo: string; runs: SidebarProps['recentRuns'][number][] }> = [];
  for (const run of runs) {
    const existing = groups.find((group) => group.repo === run.repo);
    if (existing) existing.runs.push(run);
    else groups.push({ repo: run.repo, runs: [run] });
  }
  return groups;
}

function RecentRuns(props: { runs: SidebarProps['recentRuns']; onOpen: (id: string) => void }): JSX.Element {
  return (
    <div class="cx-sidebar__recent">
      <For each={groupByRepo(props.runs)}>
        {(group) => (
          <>
            <div class="cx-sidebar__repo">
              <Icon name="repo" size={11} />
              <span class="cx-sidebar__repo-name">{group.repo}</span>
            </div>
            <For each={group.runs}>
              {(run) => (
                <button type="button" class="cx-sidebar__run" onClick={() => props.onOpen(run.id)}>
                  <span class="cx-sidebar__run-title">{run.title}</span>
                  <Show when={run.running}>
                    <span class="cx-sidebar__run-live" role="img" aria-label="Running" />
                  </Show>
                  <span class="cx-sidebar__run-age">{run.age}</span>
                </button>
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
}
