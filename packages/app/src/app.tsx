import { createMemo, createSignal, Show, type JSX } from 'solid-js';
import {
  createMemoryHistory,
  HashRouter,
  MemoryRouter,
  Navigate,
  Route,
  useNavigate,
  type RouteSectionProps,
} from '@solidjs/router';

import { ThemeProvider } from '@cortex-ide/ui';

import { AccountProvider, useAccount } from './state/session-context.tsx';
import { AppShell } from './shell/app-shell.tsx';
import { Sidebar, type RecentRun } from './shell/sidebar.tsx';
import { navigableRoutes, routeBySlug } from './routes.ts';
import {
  AutomationsRoute,
  ConnectGitHubRoute,
  DeviceCodeRoute,
  HomeRoute,
  IntegrationsRoute,
  ReviewRoute,
  SecretsRoute,
  SessionDetailRoute,
  SessionsRoute,
  SettingsRoute,
  SignInRoute,
  SshConnectRoute,
  UsageRoute,
  WorkspaceSetupRoute,
} from './route-components.tsx';

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
 * prefix-matching that would make `/sessions/:id/focus` match every `/sessions/...` path,
 * because its usable prefix is just `/sessions`.
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
 * depth, so `/sessions/:id/focus` is preferred over a hypothetical `/sessions/:a/:b`.
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
 * The shell around every routed screen.
 *
 * The auth and flow screens deliberately render outside it: they have no workspace to show a
 * sidebar for, and a locked navigation rail beside a sign-in form would be noise.
 */
function Workspace(props: { children: JSX.Element; pathname: () => string }): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  const [recentRuns] = createSignal<RecentRun[]>([]);
  const activeSlug = createMemo(() => slugForPath(props.pathname()));

  const user = createMemo(() => {
    const current = account.user();
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
          onSignIn={() => navigate('/sign-in')}
        />
      }
    >
      {props.children}
    </AppShell>
  );
}

/** Routes that render on a bare page rather than inside the workspace shell. */
const BARE_PATHS = ['/sign-in', '/onboarding', '/runtimes/ssh'];

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

/** The route tree, shared by both router flavours. */
function routes(): JSX.Element {
  return (
    <>
      <Route path="/" component={HomeRoute} />
      <Route path="/sessions" component={SessionsRoute} />
      <Route path="/sessions/:sessionId" component={SessionDetailRoute} />
      <Route path="/sessions/:sessionId/focus" component={SessionDetailRoute} />
      <Route path="/automations" component={AutomationsRoute} />
      <Route path="/automations/new" component={AutomationsRoute} />
      <Route path="/review" component={ReviewRoute} />
      <Route path="/usage" component={UsageRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/settings/integrations" component={IntegrationsRoute} />
      <Route path="/secrets" component={SecretsRoute} />
      <Route path="/runtimes/ssh" component={SshConnectRoute} />
      <Route path="/sign-in" component={SignInRoute} />
      <Route path="/sign-in/device" component={DeviceCodeRoute} />
      <Route path="/sign-in/github" component={ConnectGitHubRoute} />
      <Route path="/sign-in/workspace" component={WorkspaceSetupRoute} />
      <Route path="/onboarding" component={ConnectGitHubRoute} />
      {/* An unknown path lands on Home rather than a blank pane: a route that resolves to
          nothing looks like a crash. */}
      <Route path="*" component={() => <Navigate href="/" />} />
    </>
  );
}

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
  const [pathname, setPathname] = createSignal(props.initialPath ?? '/');

  const root = (routeProps: RouteSectionProps): JSX.Element => {
    setPathname(routeProps.location.pathname);
    return isBarePath(routeProps.location.pathname) ? (
      routeProps.children
    ) : (
      <Workspace pathname={pathname}>{routeProps.children}</Workspace>
    );
  };

  return (
    <ThemeProvider initial="system" storage={themeStorage}>
      <AccountProvider>
        {/*
          HashRouter, not the history router. The renderer loads from file:// in Electron,
          where a nested path like /sign-in/device is not a resolvable file - the history
          router would produce a hard 404 on every route but the root, on first load and on
          reload alike. A hash keeps the whole route in the fragment, which never reaches the
          filesystem. It also means the preview server needs no SPA fallback.
        */}
        <Show when={props.initialPath} fallback={<HashRouter root={root}>{routes()}</HashRouter>}>
          {(initialPath) => (
            <MemoryRouter root={root} history={seededHistory(initialPath())}>
              {routes()}
            </MemoryRouter>
          )}
        </Show>
      </AccountProvider>
    </ThemeProvider>
  );
}
