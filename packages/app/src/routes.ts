/**
 * The route table, keyed by the Paper screen slug.
 *
 * Every entry's `slug` matches an entry in `design/paper/screens.json`, and the suite
 * checks both directions: a screen in the design with no route here, and a route here with
 * no screen in the design, both fail. That is what stops a screen from being quietly
 * forgotten as the design grows.
 *
 * Not every screen is a destination. Command Palette, Notifications and the three Limits
 * screens are overlays or states layered onto another screen, so they carry no path - they
 * are still listed, because being listed is what makes them accounted for.
 */

export type ScreenKind =
  /** Reachable at its own path. */
  | 'route'
  /** Layered over whichever screen is beneath it. */
  | 'overlay'
  /** A variant of another screen rather than a place of its own. */
  | 'state';

export interface ScreenRoute {
  /** Matches the slug in design/paper/screens.json. */
  slug: string;
  kind: ScreenKind;
  /** Path, for `kind: 'route'` only. */
  path?: string;
  /** The screen this one layers over or varies, for overlays and states. */
  host?: string;
  /** True when the screen needs a Cortex account. */
  requiresAuth?: boolean;
  /** Window title fragment. */
  title: string;
}

export const SCREEN_ROUTES: readonly ScreenRoute[] = [
  // Primary destinations, in sidebar order.
  { slug: 'home', kind: 'route', path: '/', title: 'Home' },
  { slug: 'sessions', kind: 'route', path: '/sessions', title: 'Sessions' },
  { slug: 'automations', kind: 'route', path: '/automations', requiresAuth: true, title: 'Automations' },
  { slug: 'review', kind: 'route', path: '/review', requiresAuth: true, title: 'Review' },
  { slug: 'usage', kind: 'route', path: '/usage', requiresAuth: true, title: 'Usage' },

  // Session surfaces.
  { slug: 'session-detail', kind: 'route', path: '/sessions/:sessionId', title: 'Session' },
  {
    slug: 'session-detail-focus',
    kind: 'route',
    path: '/sessions/:sessionId/focus',
    title: 'Session',
  },
  { slug: 'session-states', kind: 'state', host: 'session-detail', title: 'Session' },
  { slug: 'empty-states', kind: 'state', host: 'sessions', title: 'Sessions' },

  // Configuration.
  { slug: 'settings', kind: 'route', path: '/settings', title: 'Settings' },
  {
    slug: 'settings-integrations',
    kind: 'route',
    path: '/settings/integrations',
    title: 'Integrations',
  },
  { slug: 'secrets', kind: 'route', path: '/secrets', title: 'Secrets' },
  { slug: 'new-automation', kind: 'route', path: '/automations/new', requiresAuth: true, title: 'New automation' },
  { slug: 'ssh-connect', kind: 'route', path: '/runtimes/ssh', requiresAuth: true, title: 'Connect a server' },

  // Onboarding and account.
  { slug: 'onboarding', kind: 'route', path: '/onboarding', title: 'Get started' },
  { slug: 'auth-sign-in', kind: 'route', path: '/sign-in', title: 'Sign in' },
  { slug: 'auth-device-code', kind: 'route', path: '/sign-in/device', title: 'Sign in' },
  { slug: 'auth-connect-github', kind: 'route', path: '/sign-in/github', title: 'Connect GitHub' },
  { slug: 'auth-workspace-setup', kind: 'route', path: '/sign-in/workspace', title: 'Set up workspace' },

  // Overlays.
  { slug: 'command-palette', kind: 'overlay', host: 'sessions', title: 'Command palette' },
  { slug: 'notifications', kind: 'overlay', host: 'home', title: 'Notifications' },
  { slug: 'limits-usage-warning', kind: 'state', host: 'home', title: 'Home' },
  { slug: 'limits-limit-reached', kind: 'state', host: 'home', title: 'Home' },
  { slug: 'limits-upgrade-modal', kind: 'overlay', host: 'usage', title: 'Upgrade' },
] as const;

/** Screens that have their own path. */
export function navigableRoutes(): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((route) => route.kind === 'route');
}

export function routeBySlug(slug: string): ScreenRoute | undefined {
  return SCREEN_ROUTES.find((route) => route.slug === slug);
}
