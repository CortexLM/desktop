import { Show, type JSX } from 'solid-js';
import {
  createMemoryHistory,
  HashRouter,
  MemoryRouter,
  useLocation,
  useNavigate,
  type RouteSectionProps,
} from '@solidjs/router';

import { ThemeProvider } from '@cortex-ide/ui';

import { AccountProvider, useAccount } from './state/session-context.tsx';
import { SessionsProvider, useSessions } from './state/sessions-context.tsx';
import { ConversationsProvider, useConversations } from './state/conversations-context.tsx';
import { AppShell } from './shell/app-shell.tsx';
import { ConnectionBanner } from './shell/connection-banner.tsx';
import { TitleBar } from './shell/title-bar.tsx';
import { UpdateBanner } from './shell/update-banner.tsx';
import { OverlayHost, openOverlay } from './shell/overlay-host.tsx';
import { Sidebar, type RecentChat, type RecentRun } from './shell/sidebar.tsx';
import { navigableRoutes, productForPath, productHome, routeBySlug } from './routes.ts';
import { hasElectronHost } from './state/electron-bridge.ts';
import { realtimeStatus } from './state/realtime-bridge.ts';
import { bootLiveRealtime, liveSession } from './state/realtime-session.ts';
import { formatAge } from './state/session-view.ts';
import type { ConversationSummary, SessionSummary } from '@cortex-ide/shared';
import { appRoutes } from './route-tree.tsx';

import '@cortex-ide/ui/styles.css';

/**
 * Persists the theme preference across launches.
 *
 * Reads and writes fail silently. In Electron `localStorage` is always available, but the
 * app also renders in tests and under a preview server, and a missing store is not worth
 * failing a launch over - the preference just resets.
 */
const themeStorage = {
  read: () => {
    try {
      const value = globalThis.localStorage?.getItem('cortex.theme');
      return value === 'light' || value === 'dark' || value === 'system' ? value : null;
    } catch {
      return null;
    }
  },
  write: (preference: string) => {
    try {
      globalThis.localStorage?.setItem('cortex.theme', preference);
    } catch {
      // No store; the preference lasts for this launch only.
    }
  },
};

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/**
 * Whether a concrete pathname matches a route pattern, treating `:param` as a wildcard.
 *
 * Segment-wise rather than by prefix. Truncating a pattern at its first parameter and
 * prefix-matching that would make `/code/sessions/:id/focus` match every
 * `/code/sessions/...` path, because its usable prefix is just `/code/sessions`.
 */
function matchesPattern(pathname: string, pattern: string): boolean {
  const actual = segments(pathname);
  const expected = segments(pattern);
  if (actual.length !== expected.length) return false;

  return expected.every(
    (segment, index) => segment.startsWith(':') || segment === actual[index],
  );
}

/**
 * Maps a pathname back to the slug the sidebar highlights.
 *
 * Most specific first: a pattern with fewer parameters wins over one with more at the same
 * depth, so `/code/sessions/:id/focus` is preferred over a hypothetical two-parameter one.
 */
export function slugForPath(pathname: string): string {
  const parameterCount = (pattern: string) =>
    segments(pattern).filter((segment) => segment.startsWith(':')).length;

  const candidates = [...navigableRoutes()]
    .filter((route) => route.path)
    .sort((a, b) => parameterCount(a.path!) - parameterCount(b.path!));

  for (const route of candidates) {
    if (matchesPattern(pathname, route.path!)) return route.slug;
  }

  return 'home';
}

/**
 * The five most recent runs, for the Code sidebar.
 *
 * Sliced from the store rather than asked of main with a limit: the list is
 * already held for the inbox, so a second query would be a round trip to learn
 * something in hand — and the two would disagree for as long as it took to settle.
 */
function toRecentRuns(sessions: readonly SessionSummary[]): RecentRun[] {
  return sessions
    .filter((session) => !session.archived)
    .slice(0, 5)
    .map((session) => ({
      id: session.id,
      title: session.title,
      repo: session.repo ?? 'Local folder',
      age: formatAge(session.updatedAt),
      running: session.status === 'running' || session.status === 'queued',
    }));
}

/** The five most recent conversations, for the Chat sidebar's RECENTS. */
function toRecentChats(conversations: readonly ConversationSummary[]): RecentChat[] {
  return conversations.slice(0, 5).map((chat) => ({ id: chat.id, title: chat.title }));
}

/**
 * The shell around every routed screen.
 *
 * The auth and flow screens deliberately render outside it: they have no workspace to show a
 * sidebar for, and a locked navigation rail beside a sign-in form would be noise.
 */
/** The footer identity, from the reconciled account. */
function toUser(current: { displayName?: string; email?: string; organizationId?: string } | null) {
  if (!current) return undefined;

  // `displayName` is already reconciled in main, which knows how inconsistently the
  // upstream identity providers fill in the name fields. Only the last-resort fallback
  // lives here, for an account with neither a name nor an email.
  const name = current.displayName ?? current.email ?? 'Signed in';
  return {
    name,
    plan: current.organizationId ? 'Cortex workspace' : 'Personal',
    initials: name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
  };
}

/** The sidebar, wired to the stores and the router. */
function WorkspaceSidebar(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();
  const location = useLocation();

  const runs = useSessions();
  const chats = useConversations();

  return (
    <Sidebar
      product={productForPath(location.pathname)}
      onSwitchProduct={(next) => navigate(productHome(next))}
      capabilities={account.capabilities()}
      activeSlug={slugForPath(location.pathname)}
      recentRuns={toRecentRuns(runs.sessions() ?? [])}
      recentChats={toRecentChats(chats.conversations() ?? [])}
      user={toUser(account.user())}
      onNavigate={(slug) => {
        const route = routeBySlug(slug);
        if (route?.path) navigate(route.path);
      }}
      onOpenRun={(id) => navigate(`/code/sessions/${id}`)}
      onOpenChat={(id) => navigate(`/chat/${id}`)}
      onNewChat={() => navigate('/')}
      onNewSession={() => navigate('/code')}
      onNewMascot={() => navigate('/bot/new')}
      onOpenSearch={() => openOverlay('palette')}
      onOpenAccount={() => navigate('/code/settings')}
      onSignIn={() => navigate('/sign-in')}
      // The unread dot is driven by runs that finished and have not been opened,
      // which is the only thing the app currently has to draw attention to.
      unread={{ 'code-sessions': runs.awaitingReview().length > 0 }}
    />
  );
}

function Workspace(props: { children: JSX.Element }): JSX.Element {
  return (
    <AppShell sidebar={<WorkspaceSidebar />}>
      {/* Above the routes so it is the same strip on every surface rather than
          something each screen has to remember to render. */}
      <ConnectionBanner
        status={realtimeStatus()}
        live={liveSession() !== undefined && !hasElectronHost()}
        onRetry={() => void bootLiveRealtime()}
      />
      {props.children}
      {/* Inside the shell so the overlays can navigate, and above the routes so a
          palette does not unmount on the navigation it just performed. */}
      <OverlayHost />
    </AppShell>
  );
}

/** Routes that render on a bare page rather than inside the workspace shell. */
const BARE_PATHS = ['/sign-in', '/onboarding', '/code/runtimes/ssh'];

function isBarePath(pathname: string): boolean {
  return BARE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export interface AppProps {
  /**
   * Starts at a given route under an in-memory history.
   *
   * Used by tests. A memory router rather than pushing onto `window.history` keeps each test
   * isolated - a shared history would leak the previous test's location into the next one.
   */
  initialPath?: string;
}

/** The route tree lives in `route-tree.tsx` so this file stays inside the line budget. */

/**
 * An in-memory history seeded to a starting path.
 *
 * `createMemoryHistory` always begins at `/`, so the entry is replaced rather than pushed -
 * pushing would leave `/` behind it and make the first Back go somewhere the test never
 * visited.
 */
function seededHistory(initialPath: string) {
  const history = createMemoryHistory();
  history.set({ value: initialPath, replace: true });
  return history;
}

export function App(props: AppProps): JSX.Element {
  /**
   * `<Show>` on a reactive read, not a ternary in the function body: a Solid
   * component runs once, so a bare `if` here would freeze the shell decision at
   * whatever the first route was — which is exactly the bug that kept the Chat
   * sidebar on screen after switching to /code.
   *
   * The title bar sits OUTSIDE the shell decision: bare screens (sign-in,
   * onboarding) have no sidebar but still live in a frameless window that needs
   * its drag region and controls.
   */
  const root = (routeProps: RouteSectionProps): JSX.Element => (
    <div class="cx-root">
      <TitleBar />
      <UpdateBanner />
      <div class="cx-root__content">
        <Show
          when={!isBarePath(routeProps.location.pathname)}
          fallback={routeProps.children}
        >
          <Workspace>{routeProps.children}</Workspace>
        </Show>
      </div>
    </div>
  );

  return (
    <ThemeProvider initial="system" storage={themeStorage}>
      <AccountProvider>
        <SessionsProvider>
        <ConversationsProvider>
        {/*
          HashRouter, not the history router. The renderer loads from file:// in Electron,
          where a nested path like /sign-in/device is not a resolvable file - the history
          router would produce a hard 404 on every route but the root, on first load and on
          reload alike. A hash keeps the whole route in the fragment, which never reaches the
          filesystem. It also means the preview server needs no SPA fallback.
        */}
        <Show when={props.initialPath} fallback={<HashRouter root={root}>{appRoutes()}</HashRouter>}>
          {(initialPath) => (
            <MemoryRouter root={root} history={seededHistory(initialPath())}>
              {appRoutes()}
            </MemoryRouter>
          )}
        </Show>
        </ConversationsProvider>
        </SessionsProvider>
      </AccountProvider>
    </ThemeProvider>
  );
}
