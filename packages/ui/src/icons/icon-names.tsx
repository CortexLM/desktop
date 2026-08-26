/**
 * Semantic names for the glyphs extracted from the Paper file.
 *
 * Hand-maintained on purpose: `geometry.generated.ts` can tell you that a set of paths
 * appears 52 times across 18 artboards, but only a person can say those paths are the
 * cloud runtime icon. Each entry records the size the design draws the glyph at, so the
 * `Icon` component has a correct default rather than an invented one.
 *
 * Not every extracted key is named. The design draws several glyphs once, inside a single
 * illustration, and naming those would be inventing vocabulary the product does not use.
 * Anything unnamed is still reachable by passing its key to `Icon` directly.
 */

import { iconGeometry, type IconKey } from './geometry.generated.ts';

export interface IconDefinition {
  key: IconKey;
  /** Size in px the design draws this glyph at. */
  size: number;
  /** Stroke width the design draws it with; omitted for fill-only glyphs. */
  strokeWidth?: number;
}

/**
 * Where a glyph appears at several sizes, the entry takes the dominant one and callers
 * override per site. Where the design uses visually identical glyphs at genuinely
 * different weights, both are named rather than collapsed, because the weight difference
 * is deliberate optical sizing.
 */
export const icons = {
  // Brand
  logo: { key: 'a4a81f0a', size: 16 },

  // Primary navigation, read off the Sessions sidebar
  home: { key: '1ba2b365', size: 16, strokeWidth: 1.5 },
  sessions: { key: '1e76aca9', size: 16, strokeWidth: 1.5 },
  automations: { key: '9ceafc6c', size: 16, strokeWidth: 1.5 },
  review: { key: 'c75a609a', size: 16, strokeWidth: 1.5 },
  usage: { key: '2bf57453', size: 16, strokeWidth: 1.5 },

  // Runtime picker
  cloud: { key: '3c3bad64', size: 11, strokeWidth: 1.6 },
  desktop: { key: '3657c7ca', size: 14, strokeWidth: 1.5 },
  server: { key: '3ad2deec', size: 12, strokeWidth: 1.5 },

  // Composer chips
  repo: { key: '6bc7cc4c', size: 11, strokeWidth: 1.5 },
  branch: { key: '1ce61d71', size: 12, strokeWidth: 1.4 },
  mic: { key: 'bfcfa124', size: 15, strokeWidth: 1.5 },
  send: { key: '6b9f4103', size: 14, strokeWidth: 1.6 },
  attach: { key: 'da8b097f', size: 15, strokeWidth: 1.5 },

  // Chrome
  sidebarToggle: { key: '676fac87', size: 16, strokeWidth: 1.2 },
  theme: { key: '10d1f809', size: 14, strokeWidth: 1.5 },
  search: { key: 'c1c31bf0', size: 13, strokeWidth: 1.5 },
  back: { key: '18239af0', size: 14, strokeWidth: 1.5 },

  // Disclosure
  chevronDown: { key: 'e99ff70c', size: 12, strokeWidth: 1.5 },
  chevronDownSmall: { key: '457636e2', size: 8, strokeWidth: 1.2 },
  chevronDownBold: { key: '6356e2e2', size: 10, strokeWidth: 1.8 },
  chevronRight: { key: '31361e52', size: 8, strokeWidth: 1.2 },

  // Actions
  plus: { key: 'da8b097f', size: 16, strokeWidth: 1.5 },
  plusSmall: { key: '93a9b756', size: 10, strokeWidth: 1.2 },
  close: { key: '09088fbe', size: 10, strokeWidth: 1.4 },
  closeSmall: { key: '21bffe61', size: 10, strokeWidth: 1.2 },
  download: { key: '33208285', size: 12, strokeWidth: 1.3 },

  // Status and plan steps
  check: { key: '946b2aee', size: 12, strokeWidth: 1.8 },
  checkSmall: { key: '6fa3deba', size: 10, strokeWidth: 1.5 },
  checkCircle: { key: 'e8e5526d', size: 11, strokeWidth: 1.2 },
  checkCircleLarge: { key: '50f29dca', size: 14, strokeWidth: 1.4 },
  circle: { key: 'a0f88c29', size: 14, strokeWidth: 1.2 },
  checkbox: { key: '4c35a17d', size: 8, strokeWidth: 1.2 },

  // Session workbench
  terminal: { key: '5a506b24', size: 12, strokeWidth: 1.3 },
  changes: { key: '5cf69c47', size: 12, strokeWidth: 1.3 },
  pullRequest: { key: '8de87d37', size: 13, strokeWidth: 1.3 },
  browser: { key: '587759fb', size: 12, strokeWidth: 1.2 },
  merge: { key: 'cf598808', size: 12, strokeWidth: 1.2 },
  file: { key: '8e127c23', size: 16, strokeWidth: 1.3 },
  folder: { key: '5975f71b', size: 11, strokeWidth: 1.1 },
  comment: { key: '9357af00', size: 10, strokeWidth: 1.1 },
  eye: { key: '3bef17f7', size: 13, strokeWidth: 1.4 },

  // Secrets and security
  lock: { key: 'f6885b53', size: 11, strokeWidth: 1.2 },
  shield: { key: '101ff2d3', size: 13, strokeWidth: 1.2 },

  /*
   * Identity providers.
   *
   * GitHub's mark is a single silhouette, so `currentColor` renders it correctly and it
   * belongs here. Google's four-colour G does not: the extractor collapsed its fills into one
   * shape, and nothing at the call site can recover them. Multi-colour brand marks are drawn
   * by hand in the app instead - see packages/app/src/shell/provider-marks.tsx.
   */
  github: { key: 'dffea0c6', size: 16 },
  githubSmall: { key: '734654f9', size: 12 },
  google: { key: '5673120d', size: 16 },

  // Automation card illustrations
  bolt: { key: '9fd7aa7c', size: 18, strokeWidth: 1.5 },
  parallelAgents: { key: '9d80309f', size: 18, strokeWidth: 1.5 },
  chart: { key: 'a36568c9', size: 14, strokeWidth: 1.5 },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof icons;

/** Resolves a semantic name or a raw geometry key to a definition. */
export function resolveIcon(name: IconName | IconKey): IconDefinition {
  if (name in icons) return icons[name as IconName];
  if (name in iconGeometry) return { key: name as IconKey, size: 16 };
  throw new Error(`Unknown icon "${name}"`);
}
