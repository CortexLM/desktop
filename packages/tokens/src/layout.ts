/**
 * Layout dimensions measured off the Paper artboards.
 *
 * Paper's token set covers colour, type, spacing and radii but not structural sizes, so
 * the frame geometry lives here instead. Every value is a frame width or height read from
 * the design; the comment names the frame it came from so it can be re-verified against
 * `design/paper/spec/*.json` without hunting through the canvas.
 *
 * These are exposed as CSS custom properties by `layout.css` so components reference
 * `var(--layout-sidebar)` rather than hard-coding pixels.
 */

export const layout = {
  /** Artboard width for every screen in the file. */
  viewport: 1440,

  sidebar: {
    /** `Sidebar` frame on every C3 screen (BXH-0: 260px, bg-sidebar, hairline right). */
    width: 260,
    /** Inner content width; the 12px inset on each side is the sidebar's padding. */
    content: 236,
    /** Traffic-light row above the workspace switcher. */
    chromeRow: 26,
    /** `Workspace switcher`. */
    workspaceSwitcher: 36,
    /** `Nav` block holding the five primary destinations. */
    nav: 170,
    /** One `Nav` row. */
    navItem: 30,
    /** `Recent runs` block. */
    recentRuns: 176,
    /** `Upgrade card` pinned above the user row. */
    upgradeCard: 46,
    /** `User row` at the bottom. */
    userRow: 44,
  },

  main: {
    /** `Main` frame: viewport minus the sidebar. */
    width: 1180,
    /** Content width on the list screens (Sessions, Automations). */
    listContent: 1120,
    /** Content width on Settings. */
    settingsContent: 960,
    /** Content width on Usage and the Limits screens. */
    usageContent: 1040,
    /** Centred column on Home. */
    homeColumn: 720,
    /** `Page header`. */
    pageHeader: 52,
    /** Session Detail header, taller than the list header to fit the PR action. */
    sessionHeader: 66,
    /** Filter row under the page header. */
    controls: 30,
  },

  sessionDetail: {
    /** Agent timeline pane. Provisional split of the 1180 main pane; re-measure
     * against design/paper/spec/code-session-detail.light.json when it lands. */
    timeline: 440,
    /** Shell / Changes / PR / Browser pane. */
    workbench: 740,
    /** Body height below the session header. */
    body: 834,
  },

  composer: {
    /** Composer shell (GF-0: 720 wide at rest). */
    width: 720,
    height: 104,
    /** Inner width; 20px left and 16px right insets. */
    content: 684,
    /** Prompt line. */
    prompt: 26,
    /** Control row carrying repo, branch, model and runtime chips. */
    footer: 30,
    /** Send button. */
    send: 32,
  },

  card: {
    /** `Get started card` on Home. */
    getStarted: 190,
    /** `Recent sessions` block on Home. */
    recentSessions: 266,
    /** Session/agent card from the UI kit. */
    sessionWidth: 360,
    sessionHeight: 84,
    /** Automation card from the Cards page. */
    automationWidth: 260,
    automationHeight: 253,
  },

  row: {
    /** Inbox row on Sessions. */
    inbox: 59,
    /** Repo group header in the inbox. */
    inboxGroup: 33,
    /** Dropdown menu row. */
    menu: 32,
    /** Runtime picker row. */
    runtime: 28,
  },

  overlay: {
    /** Command palette. */
    paletteWidth: 560,
    paletteHeight: 424,
    /** Notifications popover. */
    notificationsWidth: 330,
    notificationsHeight: 267,
    /** Runtime picker (Local / Cloud / SSH server). */
    runtimeWidth: 196,
    runtimeHeight: 133,
    /** Dropdown menu from the UI kit. */
    menuWidth: 240,
    /** Auth Sign In card. */
    signInWidth: 360,
    signInHeight: 454,
    /** Auth Device Code card. */
    deviceCodeWidth: 440,
    deviceCodeHeight: 420,
    /** SSH Connect sheet. */
    sshWidth: 480,
    sshHeight: 488,
  },

  control: {
    /** Input and select height. */
    field: 36,
    /** Buttons are 36px pills in C3; icon-only buttons are 32. */
    button: 36,
    /** Icon-only ghost button and the round send. */
    buttonSecondary: 32,
    /** Status badge. */
    badge: 22,
    /** Chip with a leading icon. */
    chip: 26,
    /** Tab strip. */
    tabs: 34,
    /** Toast. */
    toast: 40,
    /** Icon slot in nav rows and chips. */
    icon: 14,
    /** Trailing indicator dot in nav rows. */
    dot: 8,
    /** Avatar in the user row. */
    avatar: 26,
    /** Workspace logo tile. */
    logoTile: 24,
    /** Oversized logo tile used as the Home greeting mark. */
    logoTileLarge: 44,
  },
} as const;

export type Layout = typeof layout;

/** Flattened `--layout-*` custom properties, emitted into `layout.css`. */
export const layoutCssVariables = {
  '--layout-viewport': `${layout.viewport}px`,
  '--layout-sidebar': `${layout.sidebar.width}px`,
  '--layout-sidebar-content': `${layout.sidebar.content}px`,
  '--layout-sidebar-nav-item': `${layout.sidebar.navItem}px`,
  '--layout-main': `${layout.main.width}px`,
  '--layout-list-content': `${layout.main.listContent}px`,
  '--layout-settings-content': `${layout.main.settingsContent}px`,
  '--layout-usage-content': `${layout.main.usageContent}px`,
  '--layout-home-column': `${layout.main.homeColumn}px`,
  '--layout-page-header': `${layout.main.pageHeader}px`,
  '--layout-session-header': `${layout.main.sessionHeader}px`,
  '--layout-session-timeline': `${layout.sessionDetail.timeline}px`,
  '--layout-session-workbench': `${layout.sessionDetail.workbench}px`,
  '--layout-composer': `${layout.composer.width}px`,
  '--layout-composer-content': `${layout.composer.content}px`,
  '--layout-inbox-row': `${layout.row.inbox}px`,
  '--layout-menu-row': `${layout.row.menu}px`,
  '--layout-field': `${layout.control.field}px`,
  '--layout-button': `${layout.control.button}px`,
  '--layout-badge': `${layout.control.badge}px`,
  '--layout-chip': `${layout.control.chip}px`,
  '--layout-icon': `${layout.control.icon}px`,
  '--layout-dot': `${layout.control.dot}px`,
  '--layout-avatar': `${layout.control.avatar}px`,
  '--layout-logo-tile': `${layout.control.logoTile}px`,
} as const;

export type LayoutCssVariable = keyof typeof layoutCssVariables;
