/**
 * Extracts the icon set from the Paper file.
 *
 * The design draws every icon as inline SVG whose strokes and fills are bound to design
 * tokens. Redrawing them by hand would guarantee drift, and tracing them from screenshots
 * would lose the sub-pixel coordinates the glyphs are built on (`M5.6 4.2h7.9`), so the
 * geometry is lifted straight out of Paper's JSX export.
 *
 * Icons are deduplicated by *normalised* markup: the same glyph appears at several sizes
 * and in several colours across the screens, and those variations are props, not separate
 * icons. What remains after normalisation is the geometry, hashed to give each glyph a
 * stable key. Semantic names live in a hand-maintained map next to the generated file,
 * because only a human can say that a given path is "the Sessions icon".
 */

import { createHash } from 'node:crypto';

import type { PaperClient } from './mcp-client.ts';

export interface ExtractedIcon {
  /** Stable 8-char key derived from the normalised geometry. */
  key: string;
  /** The viewBox the geometry is authored against. */
  viewBox: string;
  /** Inner markup with colours replaced by `currentColor` and stroke width by a prop. */
  body: string;
  /** Every width x height the glyph is drawn at across the file. */
  sizes: string[];
  /** Every stroke width the glyph is drawn with; the first is the most common. */
  strokeWidths: string[];
  /** Artboards the glyph appears on, for traceability. */
  usedOn: string[];
  /** How many times it appears in total; a proxy for how load-bearing it is. */
  occurrences: number;
}

const SVG_PATTERN = /<svg\b[^>]*>[\s\S]*?<\/svg>/g;
const VIEWBOX_PATTERN = /viewBox="([^"]+)"/;
const DIMENSION_PATTERN = /\b(width|height)="(\d+(?:\.\d+)?)"/g;
const STROKE_WIDTH_PATTERN = /strokeWidth="(\d+(?:\.\d+)?)"/g;

/** Placeholder the renderer substitutes the caller's stroke width into. */
export const STROKE_WIDTH_SLOT = '__STROKE__';

/**
 * Attribute names Paper exports in React's camelCase form, and their SVG spellings.
 *
 * This conversion is not cosmetic. The extracted body is injected with `innerHTML`, and the
 * HTML parser lowercases attribute names — so `strokeWidth` arrives as `strokewidth`, which
 * SVG does not define and the renderer therefore ignores entirely. The result was silent and
 * uniform: every stroked glyph fell back to SVG's default width of 1 instead of the design's
 * 1.2 to 1.8, every line end and corner rendered butt/miter instead of round, the one dashed
 * glyph rendered solid, and the glyphs carrying text lost their size and family.
 *
 * 250 attributes across the set, none of them raising an error anywhere.
 */
const SVG_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  strokeMiterlimit: 'stroke-miterlimit',
  strokeOpacity: 'stroke-opacity',
  fillOpacity: 'fill-opacity',
  fillRule: 'fill-rule',
  clipPath: 'clip-path',
  clipRule: 'clip-rule',
  fontSize: 'font-size',
  fontFamily: 'font-family',
  fontWeight: 'font-weight',
  textAnchor: 'text-anchor',
  letterSpacing: 'letter-spacing',
  dominantBaseline: 'dominant-baseline',
  vectorEffect: 'vector-effect',
  paintOrder: 'paint-order',
};

/** Rewrites every known camelCase attribute name to its SVG spelling. */
function toSvgAttributeNames(markup: string): string {
  return markup.replace(/\b([a-z]+[A-Z][a-zA-Z]*)=/g, (whole, name: string) => {
    const svgName = SVG_ATTRIBUTE_NAMES[name];
    if (svgName) return `${svgName}=`;
    // Loud rather than silently passed through: an unmapped camelCase attribute is exactly
    // the failure above, and it would otherwise be invisible until someone looked closely at
    // a rendered glyph.
    throw new Error(
      `Unmapped camelCase SVG attribute "${name}". Add it to SVG_ATTRIBUTE_NAMES — the HTML ` +
        `parser will lowercase it and the renderer will ignore it.`,
    );
  });
}

/**
 * Colours become `currentColor` and stroke width becomes a slot, so one record can render
 * the glyph in any role at any weight. Both are props rather than identity: the design
 * draws the same glyph at 1.2, 1.5 and 1.6 depending on the size it appears at, which is
 * optical sizing, not a different icon. Layout noise Paper stamps on every node is dropped.
 * What is left is pure geometry.
 */
function normaliseBody(svg: string): string {
  const inner = svg.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>$/, '');

  return toSvgAttributeNames(
    inner
      // Token-bound and literal colours alike collapse to currentColor.
      .replace(/(stroke|fill)="var\(--[^)]+\)"/g, '$1="currentColor"')
      .replace(/(stroke|fill)="#[0-9A-Fa-f]{3,8}"/g, '$1="currentColor"')
      // `fill="none"` is structural: it distinguishes an outline glyph from a solid one, so
      // it deliberately survives normalisation.
      .replace(STROKE_WIDTH_PATTERN, `strokeWidth="${STROKE_WIDTH_SLOT}"`)
      // Paper stamps flexShrink on every node; it is layout, not geometry.
      .replace(/\s*style=\{\{[^}]*\}\}/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function hashGeometry(viewBox: string, body: string): string {
  return createHash('sha256').update(`${viewBox}|${body}`).digest('hex').slice(0, 8);
}

function readStrokeWidths(svg: string): string[] {
  return [...new Set([...svg.matchAll(STROKE_WIDTH_PATTERN)].map((match) => match[1]!))];
}

function readSizes(svg: string): string {
  const dimensions: Record<string, string> = {};
  for (const match of svg.matchAll(DIMENSION_PATTERN)) {
    dimensions[match[1]!] = match[2]!;
  }
  return `${dimensions.width ?? '?'}x${dimensions.height ?? '?'}`;
}

export interface ExtractIconsOptions {
  /** Artboards to walk, as `{ id, name }`. Usually the light artboards only. */
  artboards: Array<{ id: string; name: string }>;
  onProgress?: (artboardName: string, found: number) => void;
}

export async function extractIcons(
  client: PaperClient,
  options: ExtractIconsOptions,
): Promise<ExtractedIcon[]> {
  const icons = new Map<string, ExtractedIcon>();

  for (const artboard of options.artboards) {
    const response = await client.callJson<{ jsx?: string; code?: string }>('get_jsx', {
      nodeId: artboard.id,
      format: 'inline-styles',
    });
    const jsx = response.jsx ?? response.code ?? '';
    const matches = jsx.match(SVG_PATTERN) ?? [];

    for (const svg of matches) {
      const viewBox = svg.match(VIEWBOX_PATTERN)?.[1];
      if (!viewBox) continue;

      const body = normaliseBody(svg);
      if (!body) continue;

      const key = hashGeometry(viewBox, body);
      const size = readSizes(svg);
      const strokeWidths = readStrokeWidths(svg);

      const existing = icons.get(key);
      if (existing) {
        existing.occurrences += 1;
        if (!existing.sizes.includes(size)) existing.sizes.push(size);
        for (const width of strokeWidths) {
          if (!existing.strokeWidths.includes(width)) existing.strokeWidths.push(width);
        }
        if (!existing.usedOn.includes(artboard.name)) existing.usedOn.push(artboard.name);
        continue;
      }

      icons.set(key, {
        key,
        viewBox,
        body,
        sizes: [size],
        strokeWidths,
        usedOn: [artboard.name],
        occurrences: 1,
      });
    }

    options.onProgress?.(artboard.name, matches.length);
  }

  // Most-used first: the glyphs that carry the interface come out at the top of the
  // generated file, where they are easiest to name.
  return [...icons.values()].sort((a, b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key));
}

/** Renders the extracted set as a Solid module of `IconGeometry` records. */
export function renderIconModule(icons: ExtractedIcon[]): string {
  const entries = icons
    .map((icon) => {
      const usage = icon.usedOn.slice(0, 3).join(', ');
      const more = icon.usedOn.length > 3 ? `, +${icon.usedOn.length - 3} more` : '';
      const stroke = icon.strokeWidths.length > 0 ? icon.strokeWidths.join('/') : 'fill only';
      return [
        `  /**`,
        `   * ${icon.occurrences}x at ${icon.sizes.join(', ')}, stroke ${stroke}`,
        `   * on ${usage}${more}`,
        `   */`,
        `  '${icon.key}': {`,
        `    viewBox: ${JSON.stringify(icon.viewBox)},`,
        `    body: ${JSON.stringify(icon.body)},`,
        `    strokeWidths: ${JSON.stringify(icon.strokeWidths)},`,
        `  },`,
      ].join('\n');
    })
    .join('\n');

  return `/*
 * GENERATED FILE - DO NOT EDIT.
 *
 * Icon geometry lifted from the Paper file "IDE New 01".
 * Regenerate with: bun run paper:icons
 *
 * Keys are an 8-character hash of the normalised geometry, so a glyph keeps its key across
 * regenerations as long as its paths do not change. Colours are normalised to
 * \`currentColor\` and sizes are dropped, because those are props rather than identity.
 *
 * Semantic names live in \`icon-names.ts\`, which is hand-maintained: only a human can say
 * that a given set of paths is the Sessions icon.
 */

/** Placeholder the renderer substitutes the caller's stroke width into. */
export const STROKE_WIDTH_SLOT = '${STROKE_WIDTH_SLOT}';

export interface IconGeometry {
  viewBox: string;
  /** Markup with \`currentColor\` fills and \`${STROKE_WIDTH_SLOT}\` in place of stroke width. */
  body: string;
  /** Stroke widths the design draws this glyph with; the first is the most common. */
  strokeWidths: string[];
}

export const iconGeometry = {
${entries}
} as const satisfies Record<string, IconGeometry>;

export type IconKey = keyof typeof iconGeometry;
`;
}
