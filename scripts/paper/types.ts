/** Shapes returned by the Paper MCP read tools that the design pipeline depends on. */

export interface PaperArtboard {
  id: string;
  name: string;
  childCount: number;
  width: number;
  height: number;
  worldX: number;
  worldY: number;
}

export interface PaperPage {
  id: string;
  name: string;
  isActive: boolean;
}

export interface PaperTokenSummary {
  name: string;
  value: string;
}

export interface PaperBasicInfo {
  fileName: string;
  pageName: string;
  pageId: string;
  url: string;
  rootNodeId: string;
  nodeCount: number;
  artboardCount: number;
  artboards: PaperArtboard[];
  pages: PaperPage[];
  fontFamilies: string[];
  contentHash: { tokens: string };
  tokens: { items: PaperTokenSummary[] };
}

export type PaperTokenType =
  | 'color'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'letterSpacing'
  | 'spacing'
  | 'radius'
  | (string & {});

export interface PaperToken {
  name: string;
  type: PaperTokenType;
  value: string;
  description?: string;
}

export interface PaperTokensResponse {
  contentHash: { tokens: string };
  tokens: PaperToken[];
}

export interface PaperTreeSummary {
  contentHash: { tokens: string };
  summary: string;
  nodeId: string;
  depth: number;
}

export interface PaperComputedStyles {
  [nodeId: string]: Record<string, string>;
}

/**
 * An artboard named `Screens / Session Detail — Dark` describes one screen in one theme.
 * Screen routing and the visual-regression baselines both key off this split.
 */
export interface ParsedArtboardName {
  group: string;
  screen: string;
  theme: 'light' | 'dark';
  /** Stable kebab-case identifier, e.g. `session-detail`. */
  slug: string;
}

const EM_DASH = '\u2014';

export function parseArtboardName(name: string): ParsedArtboardName | null {
  const themeSplit = name.split(EM_DASH);
  if (themeSplit.length < 2) return null;

  const themeRaw = themeSplit[themeSplit.length - 1]!.trim().toLowerCase();
  if (themeRaw !== 'light' && themeRaw !== 'dark') return null;

  const path = themeSplit.slice(0, -1).join(EM_DASH).trim();
  const segments = path.split('/').map((segment) => segment.trim());
  const group = segments.length > 1 ? segments[0]! : '';
  const screen = segments[segments.length - 1]!;

  return { group, screen, theme: themeRaw, slug: slugify(screen) };
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
