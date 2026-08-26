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
  /** Opens the sign-in flow. The only route to it from inside the workspace. */
  onSignIn?: () => void;
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

/**
 * The footer: who you are, or an invitation to say so.
 *
 * Rendered in both states, which it did not used to be. It only appeared when a user was
 * signed in, and the consequences were worse than a missing row:
 *
 *   - There was no way to sign in from anywhere in the running app. The only `onSignIn`
 *     handlers hang off Usage, Review and Automations, and all three are locked precisely
 *     because you are not signed in. Anonymous was a one-way door.
 *   - The theme toggle lived here too, so a signed-out user could not reach the dark palette
 *     at all, despite the design drawing every screen in it.
 */
function Footer(props: {
  user?: SidebarUser;
  onOpenAccount?: () => void;
  onSignIn?: () => void;
  onToggleTheme: () => void;
}): JSX.Element {
  return (
    <div class="cx-sidebar__user">
      <Show
        when={props.user}
        fallback={<SignInRow onSignIn={props.onSignIn} />}
      >
        {(user) => <IdentityRow user={user()} onOpenAccount={props.onOpenAccount} />}
      </Show>
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

function SignInRow(props: { onSignIn?: () => void }): JSX.Element {
  return (
    <button type="button" class="cx-sidebar__identity" onClick={() => props.onSignIn?.()}>
      <span class="cx-sidebar__avatar" aria-hidden="true">
        <Icon name="lock" size={11} />
      </span>
      <span class="cx-sidebar__identity-text">
        <span class="cx-sidebar__user-name">Sign in</span>
        {/*
          Says what signing in buys, in the slot the plan name occupies when signed in. The
          locked nav rows above advertise the same thing; this is the row that acts on it.
        */}
        <span class="cx-sidebar__user-plan">Unlock Cortex models</span>
      </span>
    </button>
  );
}

function IdentityRow(props: {
  user: SidebarUser;
  onOpenAccount?: () => void;
}): JSX.Element {
  return (
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
  );
}

function ChromeRow(props: { onToggle?: () => void }): JSX.Element {
  return (
    <div class="cx-sidebar__chrome">
      <Show when={props.onToggle}>
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
  );
}

function WorkspaceSwitcher(props: { workspace: string; onSwitch?: () => void }): JSX.Element {
  return (
    <button
      type="button"
      class="cx-sidebar__workspace"
      onClick={() => props.onSwitch?.()}
      aria-label={`Workspace: ${props.workspace}`}
    >
      <BrandTile />
      <span class="cx-sidebar__workspace-name">{props.workspace}</span>
      <Icon name="chevronDown" size={12} />
    </button>
  );
}

function PlanCard(props: { plan: SidebarPlan; onUpgrade?: () => void }): JSX.Element {
  // Clamped rather than trusted: a quota that has been exceeded reports a ratio above 1,
  // and letting that through would paint the fill past its track.
  const percent = () => Math.min(100, Math.max(0, props.plan.progress * 100));

  return (
    <button type="button" class="cx-sidebar__upgrade" onClick={() => props.onUpgrade?.()}>
      <span class="cx-sidebar__upgrade-label">{props.plan.label}</span>
      <span
        class="cx-sidebar__meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent())}
        aria-label={props.plan.label}
      >
        <span class="cx-sidebar__meter-fill" style={{ width: `${percent()}%` }} />
      </span>
    </button>
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
      <ChromeRow onToggle={props.onToggleSidebar} />
      <WorkspaceSwitcher workspace={props.workspace} onSwitch={props.onSwitchWorkspace} />

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
        {(plan) => <PlanCard plan={plan()} onUpgrade={props.onUpgrade} />}
      </Show>
      <Footer
        user={props.user}
        onOpenAccount={props.onOpenAccount}
        onSignIn={props.onSignIn}
        onToggleTheme={theme.toggle}
      />
    </nav>
  );
}
