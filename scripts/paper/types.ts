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
 * An artboard named `C3 / Code / Session Detail — Dark` describes one screen in one
 * theme. Screen routing and the visual-regression baselines both key off this split.
 */
export interface ParsedArtboardName {
  /** The concept prefix, e.g. `C3`. */
  group: string;
  /** Path below the concept, e.g. `Code / Session Detail` or `Home`. */
  screen: string;
  theme: 'light' | 'dark';
  /**
   * Stable kebab-case identifier built from the WHOLE path below the concept,
   * e.g. `code-session-detail`. The chat product's `C3 / Home` and the code
   * product's `C3 / Code / Home` must not collapse onto one `home` slug — that
   * collision is exactly what slugging only the last segment produced.
   */
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
  const screen = segments.length > 1 ? segments.slice(1).join(' / ') : segments[0]!;

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
