/**
 * The route table, keyed by slug.
 *
 * `source: 'paper'` slugs must match `design/paper/screens.json`. The suite
 * checks both directions for those so a Concept 03 screen cannot be forgotten.
 *
 * `source: 'product'` slugs are Chat / Bot destinations that are not on page
 * 6-0 yet (Bot lives on Paper page D-0). They are real routes with honest
 * states; they are not required to have an extracted artboard.
 */

export type ScreenKind = 'route' | 'overlay' | 'state';

export type Product = 'chat' | 'code' | 'bot';

/**
 * Products in this desktop shell's switcher. Cortex is Chat + Code.
 * Bot is a separate app; `/bot` routes stay for the API client and deep links.
 */
export const SHELL_PRODUCTS = [
  { id: 'chat' as const, label: 'Chat', icon: 'chat' as const },
  { id: 'code' as const, label: 'Code', icon: 'code' as const },
];

export type RouteSource = 'paper' | 'product';

export interface ScreenRoute {
  slug: string;
  kind: ScreenKind;
  product: Product;
  source?: RouteSource;
  path?: string;
  host?: string;
  requiresAuth?: boolean;
  title: string;
}

export const SCREEN_ROUTES: readonly ScreenRoute[] = [
  // ── Chat (Paper + product) ───────────────────────────────────────────────
  { slug: 'home', kind: 'route', product: 'chat', path: '/', title: 'Cortex' },
  { slug: 'conversation', kind: 'route', product: 'chat', path: '/chat/:conversationId', title: 'Chat' },
  { slug: 'research', kind: 'route', product: 'chat', source: 'product', path: '/research', title: 'Research' },
  { slug: 'planning', kind: 'route', product: 'chat', source: 'product', path: '/planning', title: 'Planning' },
  { slug: 'projects', kind: 'route', product: 'chat', source: 'product', path: '/projects', title: 'Projects' },
  { slug: 'project', kind: 'route', product: 'chat', source: 'product', path: '/projects/:projectId', title: 'Project' },
  {
    slug: 'project-sources',
    kind: 'route',
    product: 'chat',
    source: 'product',
    path: '/projects/:projectId/sources',
    title: 'Sources',
  },
  { slug: 'library', kind: 'route', product: 'chat', source: 'product', path: '/library', title: 'Library' },
  { slug: 'plugins', kind: 'route', product: 'chat', source: 'product', path: '/plugins', title: 'Plugins' },
  { slug: 'chat-settings', kind: 'route', product: 'chat', source: 'product', path: '/settings', title: 'Settings' },

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
  { slug: 'code-notifications', kind: 'route', product: 'code', path: '/code/notifications', title: 'Notifications' },
  { slug: 'code-new-automation', kind: 'route', product: 'code', path: '/code/automations/new', requiresAuth: true, title: 'New automation' },
  { slug: 'code-ssh-connect', kind: 'route', product: 'code', path: '/code/runtimes/ssh', requiresAuth: true, title: 'Connect a server' },

  // ── Code: where runs happen, and the work queued for them ────────────────
  {
    slug: 'code-runtimes',
    kind: 'route',
    product: 'code',
    source: 'product',
    path: '/code/runtimes',
    requiresAuth: true,
    title: 'Runtimes',
  },
  {
    slug: 'code-tickets',
    kind: 'route',
    product: 'code',
    source: 'product',
    path: '/code/tickets',
    requiresAuth: true,
    title: 'Tickets',
  },
  {
    slug: 'code-ticket-detail',
    kind: 'route',
    product: 'code',
    source: 'product',
    path: '/code/tickets/:ticketId',
    requiresAuth: true,
    title: 'Ticket',
  },

  // ── Bot (Paper page D-0; not on the Concept 03 manifest yet) ─────────────
  { slug: 'bot-home', kind: 'route', product: 'bot', source: 'product', path: '/bot', title: 'Bot' },
  { slug: 'bot-create', kind: 'route', product: 'bot', source: 'product', path: '/bot/new', title: 'New mascot' },
  { slug: 'bot-conversation', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId', title: 'Mascot' },
  { slug: 'bot-messages', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId/messages', title: 'Messages' },
  { slug: 'bot-videos', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId/videos', title: 'Videos' },
  { slug: 'bot-computer', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId/computer', title: 'Computer' },
  { slug: 'bot-memory', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId/memory', title: 'Memory' },
  { slug: 'bot-skills', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId/skills', title: 'Skills' },
  { slug: 'bot-routines', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId/routines', title: 'Routines' },
  { slug: 'bot-groups', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId/groups', title: 'Groups' },
  { slug: 'bot-settings', kind: 'route', product: 'bot', source: 'product', path: '/bot/:mascotId/settings', title: 'Mascot settings' },

  // ── Onboarding and account ────────────────────────────────────────────────
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

export function paperRoutes(): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((route) => route.source !== 'product');
}

export function navigableRoutes(): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((route) => route.kind === 'route');
}

export function routeBySlug(slug: string): ScreenRoute | undefined {
  return SCREEN_ROUTES.find((route) => route.slug === slug);
}

export function productHome(product: Product): string {
  if (product === 'code') return '/code';
  if (product === 'bot') return '/bot';
  return '/';
}

/** Which product's shell frames a pathname. */
export function productForPath(pathname: string): Product {
  if (pathname === '/code' || pathname.startsWith('/code/')) return 'code';
  if (pathname === '/bot' || pathname.startsWith('/bot/')) return 'bot';
  return 'chat';
}
