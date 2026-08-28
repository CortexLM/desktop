/**
 * Semantic names for the glyphs extracted from the Paper file (Concept 03).
 *
 * Hand-maintained on purpose: `geometry.generated.ts` can tell you that a set of paths
 * appears 19 times across 16 artboards, but only a person can say those paths are the
 * Review icon. Each entry records the size the design draws the glyph at, so the
 * `Icon` component has a correct default rather than an invented one.
 *
 * Not every extracted key is named. The design draws several glyphs once, inside a single
 * illustration, and naming those would be inventing vocabulary the product does not use.
 * Anything unnamed is still reachable by passing its key to `Icon` directly.
 */

import { iconGeometry, type IconKey } from './geometry.generated.ts';

export interface IconDefinition {
  key: IconKey | ExtraIconKey;
  /** Size in px the design draws this glyph at. */
  size: number;
  /** Stroke width the design draws it with; omitted for fill-only glyphs. */
  strokeWidth?: number;
}

/**
 * Glyphs the design only draws on the Components page, which the extractor does
 * not scan (it reads the screens). Same shape as the generated geometry.
 */
export const extraGeometry = {
  sun: {
    viewBox: '0 0 24 24',
    body: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="__STROKE__" stroke-linecap="round" stroke-linejoin="round" /><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" fill="none" stroke="currentColor" stroke-width="__STROKE__" stroke-linecap="round" stroke-linejoin="round" />',
    strokeWidths: ['1.75'],
  },
  ring: {
    viewBox: '0 0 16 16',
    body: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="__STROKE__" />',
    strokeWidths: ['1.4'],
  },
  bot: {
    viewBox: '0 0 16 16',
    body: '<rect x="3" y="4" width="10" height="9" rx="3" fill="none" stroke="currentColor" stroke-width="__STROKE__" /><circle cx="6.2" cy="8" r="0.9" fill="currentColor" /><circle cx="9.8" cy="8" r="0.9" fill="currentColor" /><path d="M8 2.2v1.8M5.5 12.2c.8.7 2.2.7 3 0" fill="none" stroke="currentColor" stroke-width="__STROKE__" stroke-linecap="round" />',
    strokeWidths: ['1.5'],
  },
} as const;

export type ExtraIconKey = keyof typeof extraGeometry;

/**
 * Where a glyph appears at several sizes, the entry takes the dominant one and callers
 * override per site. Where the design uses visually identical glyphs at genuinely
 * different weights, both are named rather than collapsed, because the weight difference
 * is deliberate optical sizing.
 */
export const icons = {
  // Brand. The bird mark is wide (197x100); render through `logo` at its design height
  // and let the svg keep its aspect via the viewBox.
  logo: { key: '946b2447', size: 22 },

  // Product switcher
  chat: { key: '9ccc0f89', size: 14, strokeWidth: 1.75 },
  code: { key: '3c665596', size: 14, strokeWidth: 1.75 },
  bot: { key: 'bot', size: 14, strokeWidth: 1.5 },

  // Workspace navigation (Code product sidebar)
  home: { key: '1ad88b3c', size: 16, strokeWidth: 1.75 },
  sessions: { key: '888d432d', size: 16, strokeWidth: 1.75 },
  automations: { key: '02afebc6', size: 16, strokeWidth: 1.75 },
  review: { key: 'be850ee2', size: 16, strokeWidth: 1.75 },
  usage: { key: 'd4c7620e', size: 16, strokeWidth: 1.75 },

  // Chat apps (Chat product sidebar)
  search: { key: 'f2af8b94', size: 16, strokeWidth: 1.75 },
  research: { key: '03df14a6', size: 16, strokeWidth: 1.75 },
  docs: { key: 'd2fc508d', size: 16, strokeWidth: 1.3 },
  agents: { key: 'a9ea49cb', size: 16, strokeWidth: 1.5 },

  // Runtime and repository pickers
  cloud: { key: 'da6d39a3', size: 11, strokeWidth: 1.5 },
  desktop: { key: '01d290bd', size: 12, strokeWidth: 1.4 },
  server: { key: 'f04ed30a', size: 12, strokeWidth: 1.5 },
  repo: { key: '65bf4ed3', size: 11, strokeWidth: 1.5 },
  branch: { key: 'b8bf3fc5', size: 12, strokeWidth: 1.4 },

  // Composer
  mic: { key: 'e2b831f1', size: 16, strokeWidth: 1.75 },
  send: { key: '9833d472', size: 14, strokeWidth: 1.6 },
  attach: { key: '17a21a37', size: 15, strokeWidth: 1.75 },
  reason: { key: 'd48df3a2', size: 14, strokeWidth: 1.8 },

  // Chrome
  sidebarToggle: { key: '7f4a9043', size: 16, strokeWidth: 1.75 },
  theme: { key: 'sun', size: 15, strokeWidth: 1.75 },
  settings: { key: '92c25a0d', size: 15, strokeWidth: 1.75 },
  back: { key: '4eaf7005', size: 13, strokeWidth: 1.5 },
  bell: { key: '3b9b7907', size: 16, strokeWidth: 1.6 },
  kbd: { key: '01d290bd', size: 12, strokeWidth: 1.4 },
  command: { key: 'e24318f9', size: 14 },

  // Disclosure
  chevronDown: { key: 'e8b91e24', size: 10, strokeWidth: 1.4 },
  chevronDownSmall: { key: 'b6e93a65', size: 9, strokeWidth: 1.3 },
  chevronDownBold: { key: '86e628d0', size: 14, strokeWidth: 2 },
  chevronRight: { key: '7ace8d81', size: 9, strokeWidth: 1.3 },
  chevronUp: { key: '57e14ef0', size: 9, strokeWidth: 1.4 },
  arrowRight: { key: 'a76e5a3f', size: 11, strokeWidth: 1.5 },

  // Actions
  plus: { key: '1397ab3c', size: 15, strokeWidth: 1.75 },
  plusSmall: { key: '75430b8d', size: 10, strokeWidth: 1.5 },
  close: { key: '826453d7', size: 13, strokeWidth: 1.5 },
  closeSmall: { key: 'be0546f1', size: 9, strokeWidth: 1.3 },
  download: { key: 'b7df734c', size: 12, strokeWidth: 1.4 },
  copy: { key: 'f032addc', size: 13, strokeWidth: 1.75 },
  share: { key: '385c7202', size: 11, strokeWidth: 1.4 },
  retry: { key: 'de13f7e7', size: 12, strokeWidth: 1.6 },
  expand: { key: 'a6f9fa77', size: 12, strokeWidth: 1.4 },
  thumbsUp: { key: 'a159cb19', size: 14, strokeWidth: 1.75 },
  thumbsDown: { key: '6d6c8493', size: 14, strokeWidth: 1.75 },

  // Status and plan steps
  check: { key: 'd48df3a2', size: 12, strokeWidth: 1.8 },
  checkSmall: { key: 'ac5505a3', size: 9, strokeWidth: 1.5 },
  checkCircle: { key: '320fd955', size: 12, strokeWidth: 1.4 },
  checkCircleLarge: { key: '320fd955', size: 14, strokeWidth: 1.4 },
  closeCircle: { key: '3ca106b9', size: 12, strokeWidth: 1.4 },
  circle: { key: 'ring', size: 12, strokeWidth: 1.4 },
  checkbox: { key: '5b303801', size: 8, strokeWidth: 1.3 },
  clock: { key: '95c73460', size: 13, strokeWidth: 1.4 },
  spinner: { key: '53ca07eb', size: 14, strokeWidth: 1.75 },

  // Session workbench
  terminal: { key: '817ee314', size: 12, strokeWidth: 1.3 },
  changes: { key: '0514b009', size: 12, strokeWidth: 1.3 },
  pullRequest: { key: 'be61f66a', size: 12, strokeWidth: 1.3 },
  browser: { key: '347800e9', size: 12, strokeWidth: 1.2 },
  merge: { key: '336fafd7', size: 12, strokeWidth: 1.2 },
  file: { key: 'd2fc508d', size: 12, strokeWidth: 1.3 },
  fileLarge: { key: '36516470', size: 14, strokeWidth: 1.4 },
  folder: { key: '02ab986c', size: 12, strokeWidth: 1.4 },
  comment: { key: '9d42deb6', size: 11, strokeWidth: 1.4 },
  eye: { key: '226abc4e', size: 13, strokeWidth: 1.3 },

  // Secrets and security
  lock: { key: '19636e71', size: 10, strokeWidth: 1.4 },
  shield: { key: '5074e1d3', size: 18, strokeWidth: 1.6 },

  /*
   * Identity providers.
   *
   * GitHub's mark is a single silhouette, so `currentColor` renders it correctly and it
   * belongs here. Google's four-colour G collapsed into one shape at extraction; where the
   * brand colours matter the app draws it by hand (see provider-marks).
   */
  github: { key: 'abbd1d8d', size: 16 },
  githubSmall: { key: '4ffb0cc8', size: 15 },
  google: { key: '464222cf', size: 15 },

  // Larger illustrative glyphs
  bolt: { key: '02afebc6', size: 18, strokeWidth: 1.75 },
  chart: { key: '723508c9', size: 18, strokeWidth: 1.8 },
  inbox: { key: '3b9b7907', size: 26, strokeWidth: 1.6 },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof icons;

/** Resolves a semantic name or a raw geometry key to a definition. */
export function resolveIcon(name: IconName | IconKey): IconDefinition {
  if (name in icons) return icons[name as IconName];
  if (name in iconGeometry) return { key: name as IconKey, size: 16 };
  throw new Error(`Unknown icon "${name}"`);
}
