import { createMemo, createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { CommandPalette, type PaletteCommand } from '../overlays/command-palette.tsx';
import { Notifications, type AppNotification } from '../overlays/notifications.tsx';
import { UpgradeModal } from '../overlays/upgrade-modal.tsx';
import { useAccount } from '../state/session-context.tsx';
import { useSessions } from '../state/sessions-context.tsx';
import { formatAge } from '../state/session-view.ts';
import { navigableRoutes, routeBySlug } from '../routes.ts';

/**
 * The three overlays, and what opens them.
 *
 * They existed as components with their own tests and were mounted nowhere, so the
 * command palette had no shortcut, notifications had no bell, and the upgrade modal
 * could not be raised. A tested component that nothing renders is the most
 * convincing kind of dead code: the suite is green and the feature does not exist.
 *
 * Mounted here, above the routes, because all three are global — a palette that
 * unmounted with the current screen would close on the navigation it just
 * performed.
 */

type Overlay = 'palette' | 'notifications' | 'upgrade';

/** What raised the upgrade modal. The copy differs per reason, so it is carried. */
export interface UpgradeReason {
  title: string;
  body: string;
  benefits: readonly string[];
}

const DEFAULT_UPGRADE: UpgradeReason = {
  title: 'Sign in to use Cortex models',
  body: 'Cortex models, cloud runtimes and usage reporting need an account. Everything else works without one.',
  benefits: [
    'Cortex Codex and Cortex Opus',
    'Cloud and SSH runtimes',
    'Usage and review across your team',
  ],
};

/**
 * Which overlay is open, and why the upgrade one is.
 *
 * Module scope rather than a context, and that is not laziness: the things that
 * open these overlays sit *above* `OverlayHost` in the tree — the sidebar's bell,
 * a locked model in a picker — so they cannot consume a context it provides. There
 * is one of each overlay in the app and no reason for two.
 */
const [open, setOpen] = createSignal<Overlay | null>(null);
const [upgradeReason, setUpgradeReason] = createSignal<UpgradeReason | null>(null);

export function openOverlay(overlay: Overlay | null): void {
  setOpen(overlay);
}

export function requestUpgrade(reason: UpgradeReason = DEFAULT_UPGRADE): void {
  setUpgradeReason(reason);
}

/**
 * Notifications, derived from runs rather than from their own store.
 *
 * A run finishing is the only thing the app currently has to tell anyone about, and
 * inventing a second store to hold a restatement of the run list would mean two
 * things to keep in sync. When there are notifications with no run behind them, this
 * gains a real store.
 */
function toNotifications(
  sessions: readonly { id: string; title: string; status: string; updatedAt: number }[],
  now: number,
): AppNotification[] {
  return sessions
    .filter((session) => session.status === 'review' || session.status === 'failed')
    .slice(0, 20)
    .map((session) => ({
      id: session.id,
      message:
        session.status === 'failed'
          ? `${session.title} failed`
          : `${session.title} is ready to review`,
      age: formatAge(session.updatedAt, now),
      href: `/code/sessions/${session.id}`,
    }));
}

/**
 * The palette's commands.
 *
 * Built from the route table, so a destination cannot exist in the sidebar and be
 * missing here. Locked destinations appear disabled rather than absent — the same
 * reasoning as the sidebar: a hidden command is indistinguishable from one that does
 * not exist.
 */
function buildCommands(
  authenticated: boolean,
  sessions: readonly { id: string; title: string; repo?: string; branch?: string }[],
  unreadCount: number,
): PaletteCommand[] {
  const navigation = navigableRoutes()
    .filter((route) => route.path)
    .map((route) => ({
      id: `go:${route.slug}`,
      label: route.title,
      section: 'Navigate',
      ...(route.requiresAuth && !authenticated
        ? { disabled: true, hint: 'Needs an account' }
        : {}),
    }));

  const recent = sessions.slice(0, 8).map((session) => ({
    id: `open:${session.id}`,
    label: session.title,
    section: 'Sessions',
    ...(session.repo ? { hint: session.repo } : {}),
    keywords: [session.repo, session.branch].filter(Boolean) as string[],
  }));

  return [
    ...navigation,
    ...recent,
    { id: 'action:new-session', label: 'New session', section: 'Actions', hint: 'Home' },
    { id: 'action:open-folder', label: 'Open a folder…', section: 'Actions' },
    // Notifications are reached from here rather than from a bell in the chrome row.
    // The design's icon set has no bell, and inventing a glyph would put something on
    // screen that the Paper file does not contain — the one thing this UI may not do.
    {
      id: 'action:notifications',
      label: 'Notifications',
      section: 'Actions',
      ...(unreadCount > 0 ? { hint: `${unreadCount} unread` } : {}),
    },
  ];
}

interface DispatchTargets {
  navigate: (path: string) => void;
  openFolder: () => void;
  setOpen: (overlay: Overlay | null) => void;
}

function dispatch(id: string, targets: DispatchTargets): void {
  if (id.startsWith('go:')) {
    const route = routeBySlug(id.slice(3));
    if (route?.path) targets.navigate(route.path);
    return;
  }
  if (id.startsWith('open:')) {
    targets.navigate(`/code/sessions/${id.slice(5)}`);
    return;
  }
  if (id === 'action:new-session') {
    targets.navigate('/');
    return;
  }
  if (id === 'action:notifications') {
    targets.setOpen('notifications');
    return;
  }
  if (id === 'action:open-folder') targets.openFolder();
}

/**
 * The upgrade modal.
 *
 * The confirming action differs by state and both are honest: signed out, the way to
 * Cortex models is to sign in; signed in, it is the plan. A single "Upgrade" that
 * sent a signed-out user to a billing page would be a dead end.
 */
function Upgrade(props: {
  authenticated: boolean;
  navigate: (path: string) => void;
}): JSX.Element {
  return (
    <Show when={upgradeReason()}>
      {(reason) => (
        <UpgradeModal
          title={reason().title}
          body={reason().body}
          benefits={reason().benefits}
          confirmLabel={props.authenticated ? 'See plans' : 'Sign in'}
          onConfirm={() => {
            setUpgradeReason(null);
            props.navigate(props.authenticated ? '/usage' : '/sign-in');
          }}
          onDismiss={() => setUpgradeReason(null)}
        />
      )}
    </Show>
  );
}

export function OverlayHost(): JSX.Element {
  const account = useAccount();
  const runs = useSessions();
  const navigate = useNavigate();

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+K, the shortcut every tool with a palette uses. Registered on the
      // document rather than on a focused element: the point of a palette is to be
      // reachable without first clicking anything.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => (current === 'palette' ? null : 'palette'));
      }
    };

    document.addEventListener('keydown', onKeyDown);
    onCleanup(() => document.removeEventListener('keydown', onKeyDown));
  });

  const notifications = createMemo(() => toNotifications(runs.sessions() ?? [], Date.now()));

  const commands = createMemo(() =>
    buildCommands(account.capabilities().authenticated, runs.sessions() ?? [], notifications().length),
  );

  const run = (id: string) => {
    setOpen(null);
    dispatch(id, { navigate, openFolder: () => void runs.openWorkspace(), setOpen });
  };

  return (
    <>
      <Show when={open() === 'palette'}>
        <CommandPalette
          commands={commands()}
          onRun={run}
          onDismiss={() => setOpen(null)}
          placeholder="Search sessions and commands"
        />
      </Show>

      <Show when={open() === 'notifications'}>
        <Notifications
          notifications={notifications()}
          onOpen={(id) => {
            setOpen(null);
            navigate(`/code/sessions/${id}`);
          }}
          onDismiss={() => setOpen(null)}
        />
      </Show>

      <Upgrade authenticated={account.capabilities().authenticated} navigate={navigate} />

    </>
  );
}
