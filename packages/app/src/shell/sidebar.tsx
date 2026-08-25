import { For, type JSX, Show } from 'solid-js';

import { Icon, NavItem, useTheme } from '@cortex-ide/ui';
import type { Capabilities } from '@cortex-ide/cortex-api';

import { BrandTile } from './brand-mark.tsx';

import './sidebar.css';

export interface RecentRun {
  id: string;
  title: string;
  repo: string;
  /** Pre-formatted relative age, e.g. "4m". */
  age: string;
  /** Shows the muted clock glyph the design puts on runs still in progress. */
  running?: boolean;
}

export interface SidebarPlan {
  label: string;
  /** 0-1. Drives the meter under the label. */
  progress: number;
}

export interface SidebarUser {
  name: string;
  plan: string;
  /** Two-letter fallback when there is no avatar image. */
  initials: string;
}

export interface SidebarProps {
  workspace: string;
  capabilities: Capabilities;
  /** Slug of the active destination, from the route table. */
  activeSlug: string;
  recentRuns: readonly RecentRun[];
  plan?: SidebarPlan;
  user?: SidebarUser;
  unread?: Partial<Record<string, boolean>>;
  onNavigate: (slug: string) => void;
  onOpenRun: (id: string) => void;
  onSwitchWorkspace?: () => void;
  onOpenAccount?: () => void;
  onUpgrade?: () => void;
  onToggleSidebar?: () => void;
}

interface Destination {
  slug: string;
  label: string;
  icon: 'home' | 'sessions' | 'automations' | 'review' | 'usage';
  /** Read off `Capabilities`; a destination the plan does not include is shown locked. */
  capability?: keyof Capabilities;
}

/** The five primary destinations, in the order the design lists them. */
const DESTINATIONS: readonly Destination[] = [
  { slug: 'home', label: 'Home', icon: 'home' },
  { slug: 'sessions', label: 'Sessions', icon: 'sessions' },
  { slug: 'automations', label: 'Automations', icon: 'automations', capability: 'automations' },
  { slug: 'review', label: 'Review', icon: 'review', capability: 'review' },
  { slug: 'usage', label: 'Usage', icon: 'usage', capability: 'usageReporting' },
];

/** Groups runs under their repo, preserving the order they arrived in. */
function groupByRepo(runs: readonly RecentRun[]): Array<{ repo: string; runs: RecentRun[] }> {
  const groups: Array<{ repo: string; runs: RecentRun[] }> = [];

  for (const run of runs) {
    const existing = groups.find((group) => group.repo === run.repo);
    if (existing) existing.runs.push(run);
    else groups.push({ repo: run.repo, runs: [run] });
  }

  return groups;
}

function RecentRuns(props: { runs: readonly RecentRun[]; onOpen: (id: string) => void }): JSX.Element {
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
                    <Icon name="circle" size={10} label="Running" />
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

function UserRow(props: {
  user: SidebarUser;
  onOpenAccount?: () => void;
  onToggleTheme: () => void;
}): JSX.Element {
  return (
    <div class="cx-sidebar__user">
      <button
        type="button"
        class="cx-sidebar__identity"
        onClick={() => props.onOpenAccount?.()}
        aria-label={`Account: ${props.user.name}`}
      >
        <span class="cx-sidebar__avatar" aria-hidden="true">
          {props.user.initials}
        </span>
        <span class="cx-sidebar__identity-text">
          <span class="cx-sidebar__user-name">{props.user.name}</span>
          <span class="cx-sidebar__user-plan">{props.user.plan}</span>
        </span>
      </button>
      <button
        type="button"
        class="cx-sidebar__chrome-action"
        onClick={() => props.onToggleTheme()}
        aria-label="Toggle theme"
      >
        <Icon name="theme" size={14} />
      </button>
    </div>
  );
}

/**
 * The 240px sidebar, identical on every screen.
 *
 * Destinations the current plan does not include stay visible and locked rather than being
 * hidden. Hiding them would make the signed-out app look like a smaller product; showing
 * them locked is how the design advertises what an account adds, and it matches the model
 * picker, which lists Cortex models as locked for the same reason.
 */
export function Sidebar(props: SidebarProps): JSX.Element {
  const theme = useTheme();

  const lockReason = (destination: Destination): string | undefined => {
    if (!destination.capability) return undefined;
    if (props.capabilities[destination.capability]) return undefined;
    return `Sign in to Cortex to use ${destination.label}`;
  };

  return (
    <nav class="cx-sidebar" aria-label="Primary">
      <div class="cx-sidebar__chrome">
        <Show when={props.onToggleSidebar}>
          {(toggle) => (
            <button
              type="button"
              class="cx-sidebar__chrome-action"
              onClick={() => toggle()()}
              aria-label="Collapse sidebar"
            >
              <Icon name="sidebarToggle" size={16} />
            </button>
          )}
        </Show>
      </div>

      <button
        type="button"
        class="cx-sidebar__workspace"
        onClick={() => props.onSwitchWorkspace?.()}
        aria-label={`Workspace: ${props.workspace}`}
      >
        <BrandTile />
        <span class="cx-sidebar__workspace-name">{props.workspace}</span>
        <Icon name="chevronDown" size={12} />
      </button>

      <div class="cx-sidebar__nav">
        <For each={DESTINATIONS}>
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
        <div class="cx-sidebar__section">
          <span class="cx-sidebar__section-title">Recent sessions</span>
          <RecentRuns runs={props.recentRuns} onOpen={props.onOpenRun} />
        </div>
      </Show>

      <div class="cx-sidebar__spacer" />

      <Show when={props.plan}>
        {(plan) => (
          <button type="button" class="cx-sidebar__upgrade" onClick={() => props.onUpgrade?.()}>
            <span class="cx-sidebar__upgrade-label">{plan().label}</span>
            <span
              class="cx-sidebar__meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(plan().progress * 100)}
              aria-label={plan().label}
            >
              <span
                class="cx-sidebar__meter-fill"
                style={{ width: `${Math.min(100, Math.max(0, plan().progress * 100))}%` }}
              />
            </span>
          </button>
        )}
      </Show>

      <Show when={props.user}>
        {(user) => (
          <UserRow user={user()} onOpenAccount={props.onOpenAccount} onToggleTheme={theme.toggle} />
        )}
      </Show>
    </nav>
  );
}
