import { For, type JSX, Show } from 'solid-js';

import { Icon, NavItem, Segmented, useTheme } from '@cortex-ide/ui';
import type { Capabilities } from '@cortex-ide/cortex-api';

import type { Product } from '../routes.ts';

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

export interface RecentChat {
  id: string;
  title: string;
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
  product: Product;
  onSwitchProduct: (product: Product) => void;
  capabilities: Capabilities;
  /** Slug of the active destination, from the route table. */
  activeSlug: string;
  recentRuns: readonly RecentRun[];
  recentChats: readonly RecentChat[];
  plan?: SidebarPlan;
  user?: SidebarUser;
  unread?: Partial<Record<string, boolean>>;
  onNavigate: (slug: string) => void;
  onOpenRun: (id: string) => void;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onNewSession: () => void;
  /** Opens the command palette — the Search app row. */
  onOpenSearch?: () => void;
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

/** The Code product's WORKSPACE destinations, in the order the design lists them. */
const CODE_DESTINATIONS: readonly Destination[] = [
  { slug: 'code-home', label: 'Home', icon: 'home' },
  { slug: 'code-sessions', label: 'Sessions', icon: 'sessions' },
  { slug: 'code-automations', label: 'Automations', icon: 'automations', capability: 'automations' },
  { slug: 'code-review', label: 'Review', icon: 'review', capability: 'review' },
  { slug: 'code-usage', label: 'Usage', icon: 'usage', capability: 'usageReporting' },
];

/**
 * The Chat product's APPS. Search opens the palette; Code switches products; the
 * rest are the roadmap, shown locked rather than hidden so the row advertises
 * what is coming instead of pretending the product is smaller.
 */
const CHAT_APPS = [
  { id: 'search', label: 'Search', icon: 'search' as const },
  { id: 'research', label: 'Research', icon: 'research' as const, locked: 'Research is coming soon' },
  { id: 'docs', label: 'Docs', icon: 'docs' as const, locked: 'Docs is coming soon' },
  { id: 'agents', label: 'Agents', icon: 'agents' as const, locked: 'Agents is coming soon' },
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

function Header(props: { onToggle?: () => void }): JSX.Element {
  return (
    <div class="cx-sidebar__header">
      <Icon name="logo" size={22} width={43} label="Cortex" class="cx-sidebar__logo" />
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

function NewButton(props: { label: string; shortcut: string; onPress: () => void }): JSX.Element {
  return (
    <button type="button" class="cx-sidebar__new" onClick={() => props.onPress()}>
      <Icon name="plus" size={15} strokeWidth={1.75} />
      <span class="cx-sidebar__new-label">{props.label}</span>
      <kbd class="cx-sidebar__new-shortcut">{props.shortcut}</kbd>
    </button>
  );
}

function ChatSections(props: SidebarProps): JSX.Element {
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
              lockedReason={app.locked}
              onClick={() => (app.id === 'search' ? props.onOpenSearch?.() : undefined)}
            />
          )}
        </For>
      </div>

      <Show when={props.recentChats.length > 0}>
        <div class="cx-sidebar__section-title">Recents</div>
        <div class="cx-sidebar__recent">
          <For each={props.recentChats}>
            {(chat) => (
              <button
                type="button"
                class="cx-sidebar__run"
                aria-current={props.activeSlug === 'conversation' ? undefined : undefined}
                onClick={() => props.onOpenChat(chat.id)}
              >
                <span class="cx-sidebar__run-title">{chat.title}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

function CodeSections(props: SidebarProps): JSX.Element {
  const lockReason = (destination: Destination): string | undefined => {
    if (!destination.capability) return undefined;
    if (props.capabilities[destination.capability]) return undefined;
    return `Sign in to Cortex to use ${destination.label}`;
  };

  return (
    <>
      <NewButton label="New session" shortcut="⌘N" onPress={() => props.onNewSession()} />

      <div class="cx-sidebar__section-title">Workspace</div>
      <div class="cx-sidebar__nav">
        <For each={CODE_DESTINATIONS}>
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
        <div class="cx-sidebar__section-title">Recent sessions</div>
        <RecentRuns runs={props.recentRuns} onOpen={props.onOpenRun} />
      </Show>
    </>
  );
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

/**
 * The footer: who you are, or an invitation to say so.
 *
 * Rendered in both states. Anonymous keeps a way in — the locked rows above
 * advertise what an account adds, and this is the row that acts on it.
 */
function Footer(props: {
  user?: SidebarUser;
  onOpenAccount?: () => void;
  onSignIn?: () => void;
  onToggleTheme: () => void;
}): JSX.Element {
  return (
    <div class="cx-sidebar__user">
      <Show when={props.user} fallback={<SignInRow onSignIn={props.onSignIn} />}>
        {(user) => <IdentityRow user={user()} onOpenAccount={props.onOpenAccount} />}
      </Show>
      <button
        type="button"
        class="cx-sidebar__chrome-action"
        onClick={() => props.onToggleTheme()}
        aria-label="Toggle theme"
      >
        <Icon name="theme" size={15} />
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

function IdentityRow(props: { user: SidebarUser; onOpenAccount?: () => void }): JSX.Element {
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
 * The 260px sidebar (Concept 03): the bird mark, the Chat|Code product switcher,
 * then the active product's sections, with the account row pinned below.
 *
 * Destinations the current plan does not include stay visible and locked rather
 * than being hidden. Hiding them would make the signed-out app look like a
 * smaller product; showing them locked is how the design advertises what an
 * account adds.
 */
export function Sidebar(props: SidebarProps): JSX.Element {
  const theme = useTheme();

  return (
    <nav class="cx-sidebar" aria-label="Primary">
      <Header onToggle={props.onToggleSidebar} />

      <Segmented
        class="cx-sidebar__products"
        label="Product"
        value={props.product}
        onChange={(id) => props.onSwitchProduct(id as Product)}
        options={[
          { id: 'chat', label: 'Chat', icon: 'chat' },
          { id: 'code', label: 'Code', icon: 'code' },
        ]}
      />

      <Show when={props.product === 'chat'} fallback={<CodeSections {...props} />}>
        <ChatSections {...props} />
      </Show>

      <div class="cx-sidebar__spacer" />

      <Show when={props.plan}>{(plan) => <PlanCard plan={plan()} onUpgrade={props.onUpgrade} />}</Show>
      <Footer
        user={props.user}
        onOpenAccount={props.onOpenAccount}
        onSignIn={props.onSignIn}
        onToggleTheme={theme.toggle}
      />
    </nav>
  );
}
