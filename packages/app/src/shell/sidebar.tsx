import { Match, Show, Switch, type JSX } from 'solid-js';

import { Icon, Segmented, useTheme } from '@cortex-ide/ui';

import { SHELL_PRODUCTS, type Product } from '../routes.ts';
import { BotSections, ChatSections, CodeSections } from './sidebar-sections.tsx';
import type { SidebarPlan, SidebarProps, SidebarUser } from './sidebar-types.ts';

export type { RecentChat, RecentRun, SidebarPlan, SidebarProps, SidebarUser } from './sidebar-types.ts';

import './sidebar.css';

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
 * `<Switch>` rather than a bare `if` in the function body. A Solid component
 * runs once, so a ternary here would freeze the Chat apps on screen after the
 * product switcher moved to Code — the same class of bug as the shell `<Show>`
 * in `app.tsx`.
 */
function ProductSections(props: SidebarProps): JSX.Element {
  return (
    <Switch fallback={<ChatSections {...props} />}>
      <Match when={props.product === 'bot'}>
        <BotSections {...props} />
      </Match>
      <Match when={props.product === 'code'}>
        <CodeSections {...props} />
      </Match>
    </Switch>
  );
}

/**
 * The 260px sidebar: bird mark, Chat | Code, then the active product.
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
        options={SHELL_PRODUCTS}
      />
      <ProductSections {...props} />
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
