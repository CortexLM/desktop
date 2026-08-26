/**
 * The route table, keyed by the Paper screen slug.
 *
 * Every entry's `slug` matches an entry in `design/paper/screens.json`, and the suite
 * checks both directions: a screen in the design with no route here, and a route here with
 * no screen in the design, both fail. That is what stops a screen from being quietly
 * forgotten as the design grows.
 *
 * Concept 03 splits the app into two products behind one shell: Chat owns `/` and the
 * conversation view; Code owns everything under `/code`. The auth screens are drawn on
 * the Code page of the design but serve both products, so their paths stay unprefixed.
 *
 * Not every screen is a destination. Command Palette and the Limits screens are overlays
 * or states layered onto another screen, so they carry no path — they are still listed,
 * because being listed is what makes them accounted for.
 */

export type ScreenKind =
  /** Reachable at its own path. */
  | 'route'
  /** Layered over whichever screen is beneath it. */
  | 'overlay'
  /** A variant of another screen rather than a place of its own. */
  | 'state';

export type Product = 'chat' | 'code';

export interface ScreenRoute {
  /** Matches the slug in design/paper/screens.json. */
  slug: string;
  kind: ScreenKind;
  /** Which product's sidebar frames this screen. */
  product: Product;
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
  // ── Chat ──────────────────────────────────────────────────────────────────
  { slug: 'home', kind: 'route', product: 'chat', path: '/', title: 'Cortex' },
  { slug: 'conversation', kind: 'route', product: 'chat', path: '/chat/:conversationId', title: 'Chat' },

  // ── Code: primary destinations, in sidebar order ─────────────────────────
  { slug: 'code-home', kind: 'route', product: 'code', path: '/code', title: 'Code' },
  { slug: 'code-sessions', kind: 'route', product: 'code', path: '/code/sessions', title: 'Sessions' },
  { slug: 'code-automations', kind: 'route', product: 'code', path: '/code/automations', requiresAuth: true, title: 'Automations' },
  { slug: 'code-review', kind: 'route', product: 'code', path: '/code/review', requiresAuth: true, title: 'Review' },
  { slug: 'code-usage', kind: 'route', product: 'code', path: '/code/usage', requiresAuth: true, title: 'Usage' },

  // ── Code: session surfaces ────────────────────────────────────────────────
  { slug: 'code-session-detail', kind: 'route', product: 'code', path: '/code/sessions/:sessionId', title: 'Session' },
  { slug: 'code-session-detail-focus', kind: 'route', product: 'code', path: '/code/sessions/:sessionId/focus', title: 'Session' },
  { slug: 'code-session-states', kind: 'state', product: 'code', host: 'code-session-detail', title: 'Session' },
  { slug: 'code-empty-states', kind: 'state', product: 'code', host: 'code-sessions', title: 'Sessions' },
  { slug: 'code-home-sidebar-collapsed', kind: 'state', product: 'code', host: 'code-home', title: 'Code' },

  // ── Code: configuration ───────────────────────────────────────────────────
  { slug: 'code-settings', kind: 'route', product: 'code', path: '/code/settings', title: 'Settings' },
  { slug: 'code-integrations', kind: 'route', product: 'code', path: '/code/settings/integrations', title: 'Integrations' },
  { slug: 'code-secrets', kind: 'route', product: 'code', path: '/code/secrets', title: 'Secrets' },
  { slug: 'code-notifications', kind: 'route', product: 'code', path: '/code/notifications', title: 'Notifications' },
  { slug: 'code-new-automation', kind: 'route', product: 'code', path: '/code/automations/new', requiresAuth: true, title: 'New automation' },
  { slug: 'code-ssh-connect', kind: 'route', product: 'code', path: '/code/runtimes/ssh', requiresAuth: true, title: 'Connect a server' },

  // ── Onboarding and account (drawn on the Code page; serve both products) ──
  { slug: 'code-onboarding', kind: 'route', product: 'code', path: '/onboarding', title: 'Get started' },
  { slug: 'code-auth-sign-in', kind: 'route', product: 'code', path: '/sign-in', title: 'Sign in' },
  { slug: 'code-auth-device-code', kind: 'route', product: 'code', path: '/sign-in/device', title: 'Sign in' },
  { slug: 'code-auth-connect-github', kind: 'route', product: 'code', path: '/sign-in/github', title: 'Connect GitHub' },
  { slug: 'code-auth-workspace-setup', kind: 'route', product: 'code', path: '/sign-in/workspace', title: 'Set up workspace' },

  // ── Overlays and layered states ───────────────────────────────────────────
  { slug: 'code-command-palette', kind: 'overlay', product: 'code', host: 'code-sessions', title: 'Command palette' },
  { slug: 'code-limits-usage-warning', kind: 'state', product: 'code', host: 'code-home', title: 'Code' },
  { slug: 'code-limits-limit-reached', kind: 'state', product: 'code', host: 'code-home', title: 'Code' },
  { slug: 'code-limits-upgrade-modal', kind: 'overlay', product: 'code', host: 'code-usage', title: 'Upgrade' },
] as const;

/** Screens that have their own path. */
export function navigableRoutes(): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((route) => route.kind === 'route');
}

export function routeBySlug(slug: string): ScreenRoute | undefined {
  return SCREEN_ROUTES.find((route) => route.slug === slug);
}

/** Which product's shell frames a pathname. `/code…` is Code; everything else chats. */
export function productForPath(pathname: string): Product {
  return pathname === '/code' || pathname.startsWith('/code/') ? 'code' : 'chat';
}
