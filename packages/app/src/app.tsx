import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { Navigate, Route, Router, useNavigate } from '@solidjs/router';

import { ThemeProvider } from '@cortex-ide/ui';
import type { RuntimeKind } from '@cortex-ide/cortex-api';

import { AccountProvider, useAccount } from './state/session-context.tsx';
import { AppShell } from './shell/app-shell.tsx';
import { Sidebar, type RecentRun } from './shell/sidebar.tsx';
import { HomeScreen, type SessionDraft } from './screens/home/home-screen.tsx';
import { SessionsScreen } from './screens/sessions/sessions-screen.tsx';
import { navigableRoutes, routeBySlug } from './routes.ts';

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

/** Maps a pathname back to the slug the sidebar highlights. */
function slugForPath(pathname: string): string {
  // Longest path first, so `/sessions/:id` is not shadowed by `/sessions`.
  const candidates = [...navigableRoutes()]
    .filter((route) => route.path)
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0));

  for (const route of candidates) {
    const pattern = route.path!;
    if (pattern === '/') continue;
    const base = pattern.split('/:')[0]!;
    if (pathname === base || pathname.startsWith(`${base}/`)) return route.slug;
  }

  return 'home';
}

/**
 * The shell around every routed screen.
 *
 * Sidebar state lives here rather than in each screen, because the sidebar is identical on
 * all of them and refetching its recent-runs list per navigation would make it flicker.
 */
function Workspace(props: { children: JSX.Element; pathname: () => string }): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  const [recentRuns] = createSignal<RecentRun[]>([]);
  const activeSlug = createMemo(() => slugForPath(props.pathname()));

  const user = createMemo(() => {
    const current = account.user();
    if (!current) return undefined;

    const name = current.name?.trim() || current.email || 'Signed in';
    return {
      name,
      plan: current.organization_id ? 'Cortex workspace' : 'Personal',
      initials: name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join(''),
    };
  });

  return (
    <AppShell
      sidebar={
        <Sidebar
          workspace="Cortex Code"
          capabilities={account.capabilities()}
          activeSlug={activeSlug()}
          recentRuns={recentRuns()}
          user={user()}
          onNavigate={(slug) => {
            const route = routeBySlug(slug);
            if (route?.path) navigate(route.path);
          }}
          onOpenRun={(id) => navigate(`/sessions/${id}`)}
        />
      }
    >
      {props.children}
    </AppShell>
  );
}

function HomeRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  // The runtime defaults to whatever the capabilities allow rather than to 'cloud': signed
  // out, a draft pointing at a runtime the user cannot reach would fail on send.
  const [draft, setDraft] = createSignal<SessionDraft>({
    prompt: '',
    runtime: account.capabilities().runtimes[0] ?? ('local' as RuntimeKind),
  });

  return (
    <HomeScreen
      capabilities={account.capabilities()}
      draft={draft()}
      onDraftChange={setDraft}
      onStart={() => navigate('/sessions')}
      recentSessions={[]}
      onOpenSession={(id) => navigate(`/sessions/${id}`)}
      onViewAllSessions={() => navigate('/sessions')}
    />
  );
}

function SessionsRoute(): JSX.Element {
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal('all');
  const [query, setQuery] = createSignal('');

  return (
    <SessionsScreen
      sessions={[]}
      filters={[
        { id: 'all', label: 'All' },
        { id: 'mine', label: 'Mine' },
        { id: 'archived', label: 'Archived' },
      ]}
      activeFilter={filter()}
      onFilterChange={setFilter}
      query={query()}
      onQueryChange={setQuery}
      onOpenSession={(id) => navigate(`/sessions/${id}`)}
      onNewSession={() => navigate('/')}
    />
  );
}

export interface AppProps {
  /** Injected by tests to start at a given route. */
  initialPath?: string;
}

/**
 * The application root.
 *
 * Screens not yet wired redirect to Home rather than rendering a blank pane. A route that
 * resolves to nothing looks like a crash; a redirect at least leaves the user somewhere
 * usable, and the route table's own suite is what tracks which screens still need wiring.
 */
export function App(props: AppProps): JSX.Element {
  const [pathname, setPathname] = createSignal(props.initialPath ?? '/');

  return (
    <ThemeProvider initial="system" storage={themeStorage}>
      <AccountProvider>
        <Router
          root={(routeProps) => {
            setPathname(routeProps.location.pathname);
            return (
              <Workspace pathname={pathname}>
                <Show when={routeProps.children}>{routeProps.children}</Show>
              </Workspace>
            );
          }}
        >
          <Route path="/" component={HomeRoute} />
          <Route path="/sessions" component={SessionsRoute} />
          <Route path="*" component={() => <Navigate href="/" />} />
        </Router>
      </AccountProvider>
    </ThemeProvider>
  );
}
